const express = require("express");
const router = express.Router();
const wsManager = require("../services/websocket");

// Notificar nuevo mensaje
router.post("/new-message", (req, res) => {
  try {
    const { companyId, contactId, message } = req.body;

    if (!companyId || !contactId || !message) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contactId, message",
      });
    }

    wsManager.notifyNewMessage(companyId, contactId, message);

    res.json({
      success: true,
      message: "Notificación de nuevo mensaje enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/new-message:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar mensaje leído
router.post("/message-read", (req, res) => {
  try {
    const { companyId, contactId, messageIds } = req.body;

    if (!companyId || !contactId || !messageIds) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contactId, messageIds",
      });
    }

    wsManager.notifyMessageRead(companyId, contactId, messageIds);

    res.json({
      success: true,
      message: "Notificación de mensaje leído enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/message-read:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de contactos
router.post("/contacts-update", (req, res) => {
  try {
    const { companyId, contacts } = req.body;

    if (!companyId || !contacts) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contacts",
      });
    }

    wsManager.notifyContactsUpdate(companyId, contacts);

    res.json({
      success: true,
      message: "Notificación de actualización de contactos enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/contacts-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar nuevo contacto
router.post("/new-contact", (req, res) => {
  try {
    const { companyId, contact } = req.body;

    if (!companyId || !contact) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contact",
      });
    }

    wsManager.notifyNewContact(companyId, contact);

    res.json({
      success: true,
      message: "Notificación de nuevo contacto enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/new-contact:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de reacción
router.post("/reaction-update", (req, res) => {
  try {
    const { companyId, contactId, messageId, reaction } = req.body;

    if (!companyId || !contactId || !messageId || !reaction) {
      return res.status(400).json({
        success: false,
        error:
          "Faltan parámetros requeridos: companyId, contactId, messageId, reaction",
      });
    }

    wsManager.notifyReactionUpdate(companyId, contactId, messageId, reaction);

    res.json({
      success: true,
      message: "Notificación de actualización de reacción enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/reaction-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de tokens
router.post("/tokens-update", (req, res) => {
  try {
    const { companyId, tokensUsed, maxTokens, isFree } = req.body;

    if (!companyId || tokensUsed === undefined || maxTokens === undefined) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, tokensUsed, maxTokens",
      });
    }

    wsManager.notifyTokensUpdate(companyId, {
      tokensUsed,
      maxTokens,
      isFree,
    });

    res.json({
      success: true,
      message: "Notificación de actualización de tokens enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/tokens-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar nueva notificación
router.post("/new-notification", (req, res) => {
  try {
    const { companyId, notification } = req.body;

    if (!companyId || !notification) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, notification",
      });
    }

    wsManager.notifyNewNotification(companyId, notification);

    res.json({
      success: true,
      message: "Notificación de nueva notificación enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/new-notification:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de contador de notificaciones
router.post("/notifications-count-update", (req, res) => {
  try {
    const { companyId, unreadCount } = req.body;

    if (!companyId || unreadCount === undefined) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, unreadCount",
      });
    }

    wsManager.notifyNotificationsCountUpdate(companyId, unreadCount);

    res.json({
      success: true,
      message: "Notificación de contador de notificaciones enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/notifications-count-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de smart inbox
router.post("/smart-inbox-update", (req, res) => {
  try {
    const { companyId, unreadCount } = req.body;

    if (!companyId || unreadCount === undefined) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, unreadCount",
      });
    }

    wsManager.notifySmartInboxUpdate(companyId, unreadCount);

    res.json({
      success: true,
      message: "Notificación de smart inbox enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/smart-inbox-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar actualización de asignación de chat
router.post("/chat-assignment-update", (req, res) => {
  try {
    const {
      companyId,
      contactId,
      assignedUserId,
      assignedUserName,
      assignedUser,
      reason,
    } = req.body;

    if (!companyId || !contactId) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contactId",
      });
    }

    wsManager.notifyChatAssignmentUpdate(
      companyId,
      contactId,
      assignedUserId,
      assignedUserName,
      assignedUser,
      reason
    );

    res.json({
      success: true,
      message: "Notificación de actualización de asignación de chat enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/chat-assignment-update:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Notificar mensaje del sistema
router.post("/system-message", (req, res) => {
  try {
    const { companyId, contactId, message } = req.body;

    if (!companyId || !contactId || !message) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros requeridos: companyId, contactId, message",
      });
    }

    wsManager.notifySystemMessage(companyId, contactId, message);

    res.json({
      success: true,
      message: "Notificación de mensaje del sistema enviada",
    });
  } catch (error) {
    console.error("Error en /realtime/system-message:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Obtener estadísticas de conexiones
router.get("/stats", (req, res) => {
  try {
    const stats = wsManager.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error en /realtime/stats:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

module.exports = router;
