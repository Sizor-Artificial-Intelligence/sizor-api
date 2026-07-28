const amqp = require("amqplib");
const { processQueueEmail } = require("./processings/email");
const { processAIResponse } = require("./processings/aiResponse");
const { getRabbitMQConection } = require("../utils/functions");
const { processTrainingFile } = require("./processings/trainingFile");
const {
  processAISentimentAnalysis,
} = require("./processings/aISentimentAnalysis");

const connectionOptions = getRabbitMQConection();

// Lista de colas principales
const queues = [
  "EMAIL",
  "AI_RESPONSE",
  "TRAINING_FILE",
  "AI_SENTIMENT_ANALYSIS",
];
const MAX_RETRIES = 3; // Número máximo de reintentos antes de diferir

// ### CREAR PERSISTENCIA DE CONSULTAS #####
async function safeAssertQueue(channel, name, options = { durable: true }) {
  try {
    await channel.assertQueue(name, options);
    console.log(`✅ Cola "${name}" verificada/creada correctamente.`);
  } catch (err) {
    console.error(`💥 Error al asegurar la cola "${name}":`, err.message);
    throw err;
  }
}

async function setupQueues(channel) {
  const queuesToCreate = [
    { name: "EMAIL" },
    { name: "AI_RESPONSE" },
    { name: "TRAINING_FILE" },
    { name: "AI_SENTIMENT_ANALYSIS" },
  ];

  for (const queue of queuesToCreate) {
    await safeAssertQueue(channel, queue.name, queue.options);
  }
}

async function connect() {
  // Validar configuración antes de intentar conectar
  if (!connectionOptions.hostname) {
    throw new Error(
      "⚠️ Configuración de RabbitMQ incompleta: hostname no definido.\n" +
        "   Verifica las variables de entorno (IP_ADDRESS_VPS_DEV o IP_ADDRESS_VPS)"
    );
  }

  if (!connectionOptions.username || !connectionOptions.password) {
    throw new Error(
      "⚠️ Configuración de RabbitMQ incompleta: credenciales no definidas.\n" +
        "   Verifica las variables de entorno (RABBITMQ_USERNAME_DEV y RABBITMQ_PASSWORD_DEV)"
    );
  }

  try {
    console.log("🔌 Intentando conectar a RabbitMQ...", {
      hostname: connectionOptions.hostname,
      port: connectionOptions.port,
      vhost: connectionOptions.vhost,
      username: connectionOptions.username ? "***" : "undefined",
    });

    const connection = await amqp.connect(connectionOptions);

    // Manejar eventos de cierre de conexión
    connection.on("error", (err) => {
      console.error("❌ Error en la conexión de RabbitMQ:", err.message);
    });

    connection.on("close", () => {
      console.warn(
        "⚠️ Conexión de RabbitMQ cerrada. Se intentará reconectar..."
      );
    });

    const channel = await connection.createChannel();
    console.log("✅ Conexión a RabbitMQ establecida correctamente");

    return { connection, channel };
  } catch (error) {
    // Si el error tiene información sobre el cierre de conexión, extraerla
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `❌ No se puede conectar a RabbitMQ en ${connectionOptions.hostname}:${connectionOptions.port}.\n` +
          `   Verifica que el servidor esté ejecutándose y sea accesible.`
      );
    }

    // Si hay un mensaje de error de amqplib sobre ConnectionClose, proporcionar ayuda detallada
    if (error.message && error.message.includes("ConnectionClose")) {
      let errorDetails = error.message;
      let solution = "";

      // Detectar el tipo de error basado en el mensaje
      if (
        error.message.includes("403") ||
        error.message.includes("ACCESS_REFUSED")
      ) {
        solution =
          `   Soluciones:\n` +
          `   1. Verifica que el usuario "${connectionOptions.username}" tenga permisos para el vhost "${connectionOptions.vhost}"\n` +
          `   2. Asigna permisos: rabbitmqctl set_permissions -p ${connectionOptions.vhost} ${connectionOptions.username} ".*" ".*" ".*"\n` +
          `   3. Verifica que las credenciales sean correctas`;
      } else if (
        error.message.includes("404") ||
        error.message.includes("NOT_FOUND")
      ) {
        solution =
          `   Soluciones:\n` +
          `   1. Crea el vhost: rabbitmqctl add_vhost ${connectionOptions.vhost}\n` +
          `   2. Asigna permisos: rabbitmqctl set_permissions -p ${connectionOptions.vhost} ${connectionOptions.username} ".*" ".*" ".*"`;
      } else {
        solution =
          `   Soluciones posibles:\n` +
          `   - Verifica que el vhost "${connectionOptions.vhost}" exista\n` +
          `   - Verifica que el usuario "${connectionOptions.username}" tenga permisos\n` +
          `   - Verifica las credenciales en las variables de entorno\n` +
          `   - Intenta crear el vhost: rabbitmqctl add_vhost ${connectionOptions.vhost}`;
      }

      throw new Error(
        `❌ RabbitMQ rechazó la conexión:\n` +
          `   Host: ${connectionOptions.hostname}:${connectionOptions.port}\n` +
          `   VHost: ${connectionOptions.vhost}\n` +
          `   Usuario: ${connectionOptions.username}\n` +
          `   Error: ${errorDetails}\n` +
          `\n${solution}`
      );
    }

    throw error;
  }
}

async function consumeAllMessages() {
  let connection = null;
  let channel = null;

  while (true) {
    try {
      if (!connection || !channel) {
        ({ connection, channel } = await connect());
      }
      await setupQueues(channel);

      for (const queue of queues) {
        await channel.assertQueue(queue, { durable: true });

        console.log(`Esperando mensajes en cola |${queue}|...`);

        channel.consume(queue, async (msg) => {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            const headers = msg.properties.headers || {};
            const retries = headers.retries || 0;

            console.log(
              `Mensaje recibido en |${queue}| (Intento: ${retries}):`,
              content
            );

            try {
              const result = await processMessage(queue, content);

              if (result.status === "success") {
                channel.ack(msg);
                console.log(`✅ Mensaje procesado con éxito en |${queue}|`);
              } else if (result.status === "failed") {
                if (retries < MAX_RETRIES) {
                  requeueNow(channel, queue, content, msg, retries);
                } else {
                  console.log(
                    `❌ Fallo definitivo tras ${MAX_RETRIES} intentos en |${queue}|. Descartando.`
                  );
                  channel.ack(msg);
                }
              } else if (result.status === "pending") {
                if (retries < MAX_RETRIES - 1) {
                  // Normal requeue para los primeros 2 intentos
                  console.log(
                    `🕒 Proceso en curso (reintento ${
                      retries + 1
                    }) en |${queue}|`
                  );
                  requeueNow(channel, queue, content, msg, retries);
                } else {
                  // Tercer intento, va a delay
                  console.log(
                    `⏳ Proceso sigue pendiente después de ${MAX_RETRIES} intentos. Reencolando a 20 minutos en |${queue}|`
                  );
                  channel.ack(msg);
                  channel.sendToQueue(
                    "DELAY_QUEUE_20M",
                    Buffer.from(JSON.stringify(content)),
                    {
                      persistent: true,
                      headers: { retries: 0 }, // Se reinicia el contador
                    }
                  );
                }
              } else {
                console.warn(`⚠️ Resultado desconocido en |${queue}|:`, result);
                channel.nack(msg, false, false);
              }
            } catch (error) {
              console.error(
                `💥 Error procesando mensaje en |${queue}|:`,
                error
              );
              channel.nack(msg, false, false);
            }
          }
        });
      }

      break; // Sale del loop principal si se conectó todo bien
    } catch (error) {
      // Limpiar conexión y canal en caso de error
      if (connection) {
        try {
          await connection.close();
        } catch (e) {
          // Ignorar errores al cerrar
        }
      }
      connection = null;
      channel = null;

      console.error("🔁 Error en el consumidor, reintentando en 5s:");
      console.error("   Detalle:", error.message);
      if (error.stack) {
        console.error("   Stack:", error.stack.split("\n")[0]);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

function requeueNow(channel, queue, content, msg, retries) {
  channel.nack(msg, false, false); // Rechazar mensaje actual
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(content)), {
    persistent: true,
    headers: { retries: retries + 1 },
  });
}

// Procesador de mensajes centralizado
async function processMessage(queue, message) {
  console.log(`🔧 Procesando mensaje de ${queue}:`, message);
  switch (queue) {
    case "EMAIL":
      return await processQueueEmail(message);
    case "AI_RESPONSE":
      return await processAIResponse(message);
    case "TRAINING_FILE":
      return await processTrainingFile(message);
    case "AI_SENTIMENT_ANALYSIS":
      return await processAISentimentAnalysis(message);
    default:
      console.warn(`⚠️ Cola desconocida: ${queue}`);
      return { status: "failed" };
  }
}

consumeAllMessages().catch((err) =>
  console.error("Error general consumiendo mensajes:", err)
);

module.exports = {
  consumeAllMessages,
};
