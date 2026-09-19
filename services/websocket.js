const { WebSocketServer } = require("ws");

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.connections = new Map(); // companyId -> [connections]
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const companyId = url.searchParams.get("companyId");
      const userId = url.searchParams.get("userId");

      if (!companyId) {
        ws.close(1008, "Company ID requerido");
        return;
      }

      // Agregar conexión
      this.addConnection(companyId, ws, userId);

      // Manejar mensajes del cliente
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(companyId, data);
        } catch (error) {
          console.error("Error procesando mensaje WebSocket:", error);
        }
      });

      // Manejar desconexión
      ws.on("close", () => {
        this.removeConnection(companyId, ws);
      });

      // Enviar mensaje de bienvenida
      ws.send(
        JSON.stringify({
          type: "connected",
          message: "Conectado al servidor de tiempo real",
        })
      );
    });

    console.log("Servidor WebSocket iniciado en /ws");
  }

  addConnection(companyId, ws, userId = null) {
    if (!this.connections.has(companyId)) {
      this.connections.set(companyId, []);
    }
    this.connections.get(companyId).push({ ws, companyId, userId });
  }

  removeConnection(companyId, ws) {
    const connections = this.connections.get(companyId);
    if (connections) {
      const index = connections.findIndex((conn) => conn.ws === ws);
      if (index > -1) {
        connections.splice(index, 1);
        if (connections.length === 0) {
          this.connections.delete(companyId);
        }
      }
    }
  }

  handleMessage(companyId, data) {
    console.log("Mensaje recibido:", data);
  }

  // Enviar mensaje a todos los clientes de una empresa
  broadcastToCompany(companyId, message) {
    const connections = this.connections.get(companyId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      let sentCount = 0;

      connections.forEach(({ ws }) => {
        if (ws.readyState === 1) {
          try {
            ws.send(messageStr);
            sentCount++;
          } catch (error) {
            console.error("Error enviando mensaje WebSocket:", error);
          }
        }
      });
    }
  }

  // El front espera tipos con guión (new-contact). También se acepta underscore.
  eventPayload(type, extra) {
    return {
      type,
      ...extra,
      timestamp: new Date().toISOString(),
    };
  }

  // Notificar nuevo mensaje
  notifyNewMessage(companyId, contactId, message) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("new-message", { contactId, message })
    );
  }

  // Notificar mensaje leído
  notifyMessageRead(companyId, contactId, messageIds) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("message-read", { contactId, messageIds })
    );
  }

  // Notificar actualización de contactos
  notifyContactsUpdate(companyId, contacts) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("contacts-update", { contacts })
    );
  }

  // Notificar nuevo contacto
  notifyNewContact(companyId, contact) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("new-contact", { contact })
    );
  }

  // Notificar actualización de reacción
  notifyReactionUpdate(companyId, contactId, messageId, reaction) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("reaction-update", { contactId, messageId, reaction })
    );
  }

  // Notificar actualización de tokens
  notifyTokensUpdate(companyId, tokensData) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("tokens-update", { tokensData })
    );
  }

  // Notificar nueva notificación
  notifyNewNotification(companyId, notification) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("new-notification", { notification })
    );
  }

  // Notificar actualización de contador de notificaciones
  notifyNotificationsCountUpdate(companyId, unreadCount) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("notifications-count-update", { unreadCount })
    );
  }

  // Notificar actualización de smart inbox
  notifySmartInboxUpdate(companyId, unreadCount) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("smart-inbox-update", { unreadCount })
    );
  }

  // Notificar actualización de asignación de chat
  notifyChatAssignmentUpdate(
    companyId,
    contactId,
    assignedUserId,
    assignedUserName,
    assignedUser,
    reason
  ) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("chat-assignment-update", {
        contactId,
        assignedUserId,
        assignedUserName,
        reason,
        assignedUser,
      })
    );
  }

  // Notificar mensaje del sistema
  notifySystemMessage(companyId, contactId, message) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("system-message", { contactId, message })
    );
  }

  // Notificar actualización de análisis de sentimiento
  notifySentimentAnalysisUpdate(
    companyId,
    contactId,
    sentiment,
    leadTemperature,
    confidence
  ) {
    this.broadcastToCompany(
      companyId,
      this.eventPayload("sentiment-analysis-update", {
        contactId,
        sentiment,
        leadTemperature,
        confidence,
      })
    );
  }

  // Enviar mensaje a un usuario específico
  sendToUser(userId, message) {
    if (!this.wss) {
      console.warn("⚠️ WebSocket Server no está inicializado");
      return;
    }

    if (!userId) {
      console.warn("⚠️ userId es requerido para enviar mensaje a usuario");
      return;
    }

    const data =
      typeof message === "string" ? message : JSON.stringify(message);
    let sentCount = 0;
    const connectedUserIds = [];

    // Iterar sobre todas las conexiones agrupadas por companyId
    for (const [companyId, connections] of this.connections) {
      connections.forEach((conn) => {
        connectedUserIds.push({
          userId: conn.userId,
          companyId: conn.companyId,
          readyState: conn.ws.readyState,
        });

        if (conn.ws.readyState === 1 && conn.userId === userId) {
          // WebSocket.OPEN
          try {
            conn.ws.send(data);
            sentCount++;
          } catch (error) {
            console.error("Error enviando mensaje WebSocket:", error);
          }
        }
      });
    }

    console.log(
      `📤 Mensaje enviado a usuario ${userId} - ${sentCount} conexión(es)`
    );

    if (sentCount === 0) {
      console.warn(
        `⚠️ No se encontró ningún cliente conectado con userId: ${userId}`
      );
    }

    return sentCount;
  }

  // Obtener estadísticas
  getStats() {
    const stats = {};
    for (const [companyId, connections] of this.connections) {
      stats[companyId] = connections.length;
    }
    return stats;
  }
}

// Instancia singleton
const wsManager = new WebSocketManager();

module.exports = wsManager;
