require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const routes = require("./routes");
const { consumeAllMessages } = require("./queues/consumer");
const wsManager = require("./services/websocket");
const { initializeScheduler } = require("./scheduled-tasks");

const isVercel = Boolean(process.env.VERCEL);
const isServerless = isVercel || process.env.SERVERLESS === "true";

function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cors({ origin: "*" }));

  app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send("OK");
  });

  function checkApiKey(req, res, next) {
    if (req.url.startsWith("/ws") || req.url.startsWith("/health")) {
      return next();
    }

    const apiKey = req.header("X-API-KEY");
    if (apiKey && apiKey === process.env.SIZOR_API_KEY) {
      next();
    } else {
      res.status(403).json({ message: "Access forbidden: Invalid API Key" });
    }
  }

  app.use(checkApiKey);
  routes(app);
  return app;
}

async function startBackgroundServices() {
  // En Vercel/serverless no hay proceso persistente: sin WS attach, RabbitMQ consumer ni cron in-process
  if (isServerless) {
    console.warn(
      "⚠️ Modo serverless (Vercel): RabbitMQ consumer, WebSocket y scheduler in-process deshabilitados."
    );
    return;
  }

  await Promise.all([startConsumer(), initializeScheduler()]);
}

async function startConsumer() {
  const enabled = process.env.RABBITMQ_ENABLED !== "false";
  if (!enabled) {
    console.warn(
      "⚠️ RabbitMQ deshabilitado (RABBITMQ_ENABLED=false). Colas en pausa; HTTP/WS siguen activos."
    );
    return;
  }

  try {
    console.log("Iniciando el consumidor de RabbitMQ...");
    await consumeAllMessages();
    console.log("Consumidor listo y escuchando colas.");
  } catch (error) {
    console.error("Error al iniciar el consumidor de RabbitMQ:", error);
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ Continuando sin RabbitMQ en desarrollo. Arranca RabbitMQ o pon RABBITMQ_ENABLED=false."
      );
      return;
    }
    process.exit(1);
  }
}

const app = createApp();

// Export para Vercel (@vercel/node)
module.exports = app;

// Arranque local / VPS (no en Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  const HOST = process.env.HOST || "0.0.0.0";
  const server = http.createServer(app);

  if (!isServerless) {
    wsManager.initialize(server);
  }

  server.listen(PORT, HOST, async () => {
    console.log(`🚀 Servidor API en ejecución en ${HOST}:${PORT}`);
    if (!isServerless) {
      console.log(`🔌 WebSocket disponible en: ws://${HOST}:${PORT}/ws`);
    }
    await startBackgroundServices();
  });
}
