const express = require("express");
const {
  getPaymentMethods,
  createPaymentLink,
  getTransactionStatus,
} = require("../controllers/paymentController");
const router = express.Router();

// Ruta para obtener métodos de pago
router.get("/payment_methods", getPaymentMethods);

// Ruta para crear un enlace de pago
router.post("/create", createPaymentLink);

// Ruta para obtener el estado de la transacción
router.get("/link/:link_id", getTransactionStatus);

module.exports = router;
