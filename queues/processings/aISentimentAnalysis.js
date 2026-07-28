const { getDatabaseConnection } = require("../../controllers/database");
const wsManager = require("../../services/websocket");

async function processAISentimentAnalysis(message) {
  return { sentiment: "neutral", confidence: 0 };
}

module.exports = { processAISentimentAnalysis };
