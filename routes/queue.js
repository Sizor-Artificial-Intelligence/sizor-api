const express = require("express");
const { addToQueue } = require("../queues/producer");
const router = express.Router();

// Ruta
router.post("/", async (req, res) => {
  const { name, data } = req.body;

  if (!name || !data) {
    return res.status(400).json({ error: "Faltan parámetros en la solicitud" });
  }
  await addToQueue(name, data);

  res.json({
    status: "success",
    message: `Mensaje enviado a la cola: ${name}`,
  });
});

module.exports = router;
