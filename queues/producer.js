const amqp = require("amqplib");
const { getRabbitMQConection } = require("../utils/functions");

const connectionOptions = getRabbitMQConection();

let connection = null;
let channel = null;

async function getChannel() {
  if (channel) return channel;

  connection = await amqp.connect(connectionOptions);
  channel = await connection.createChannel();
  return channel;
}

async function addToQueue(queueName, data) {
  if (process.env.RABBITMQ_ENABLED === "false") {
    const err = new Error(
      `RabbitMQ deshabilitado (RABBITMQ_ENABLED=false); no se encoló |${queueName}|`
    );
    console.warn(`⚠️ ${err.message}`);
    throw err;
  }

  try {
    const channel = await getChannel();
    const queueOptions = { durable: true };
    await channel.assertQueue(queueName, queueOptions);

    const message = JSON.stringify(data);
    channel.sendToQueue(queueName, Buffer.from(message), {
      persistent: true,
    });
    console.log(`Mensaje enviado a la cola |${queueName}|`);
  } catch (error) {
    console.error("Error enviando mensaje a la cola:", error);
    throw error;
  }
}

module.exports = { addToQueue };
