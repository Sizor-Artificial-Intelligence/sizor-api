require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const routes = require("./routes");
const { consumeAllMessages } = require("./queues/consumer");
const wsManager = require("./services/websocket");
const { initializeScheduler } = require("./scheduled-tasks");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" }));

// Middleware para verificar la API Key (excluir WebSocket)
function checkApiKey(req, res, next) {
  // Excluir la ruta del WebSocket del middleware de autenticación
  if (req.url.startsWith("/ws")) {
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

// Iniciar el consumidor de RabbitMQ
async function startConsumer() {
  try {
    console.log("Iniciando el consumidor de RabbitMQ...");
    await consumeAllMessages();
    console.log("Consumidor listo y escuchando colas.");
  } catch (error) {
    console.error("Error al iniciar el consumidor de RabbitMQ:", error);
    process.exit(1);
  }
}

// Configuración del puerto
const PORT = process.env.PORT || 3001;

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar WebSocket
wsManager.initialize(server);

// Iniciar servidor
server.listen(PORT, async () => {
  console.log(`🚀 Servidor API en ejecución en el puerto: ${PORT}`);
  console.log(`🔌 WebSocket disponible en: ws://localhost:${PORT}/ws`);

  // Iniciar servicios en paralelo
  await Promise.all([startConsumer(), initializeScheduler()]);
});
