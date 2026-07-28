const express = require("express");
const router = express.Router();

// Ruta
router.post("/generate", async (req, res) => {
  const { model, messages } = req.body;

  // TODO: Manejar en un archivo o controller aparte, la url en el .env
  const response = await fetch("http://157.245.177.232:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "qwen2.5:0.5b",
      messages,
      stream: false,
    }),
  });

  const data = await response.json();
  const message = data.message.content;

  res.json({
    status: "success",
    message,
  });
});

module.exports = router;
