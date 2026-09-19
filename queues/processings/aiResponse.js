const axios = require("axios");

// Cache para consolidar mensajes por contacto
const contactMessageCache = new Map();

// Configuración de consolidación
const CONSOLIDATION_DELAY = 3000; // 3 segundos para consolidar mensajes

function cacheKeyFor(tenantId, companyId, contactId) {
  // Separador que no aparece en UUIDs ni en tenant "main"
  return `${tenantId}::${companyId}::${contactId}`;
}

function parseCacheKey(cacheKey) {
  const [tenantId, companyId, contactId] = cacheKey.split("::");
  return { tenantId, companyId, contactId };
}

function toAiMessage(messageData, timestamp) {
  const text = messageData?.text || messageData?.content || null;
  return {
    role: "user",
    content: text,
    text,
    attachments: messageData?.attachments || null,
    // type del adjunto/mensaje (TEXT/IMAGE/…) — no usar como role del LLM
    messageType: messageData?.messageType || messageData?.type || "TEXT",
    timestamp: timestamp || Date.now(),
  };
}

/**
 * Procesa mensajes de IA con consolidación inteligente
 * @param {Object} message - Mensaje de la cola
 * @returns {Object} Resultado del procesamiento
 */
async function processAIResponse(message) {
  try {
    const {
      tenantId,
      companyId,
      contactId,
      messageData,
      timestamp,
      socialNetwork,
    } = message;

    const cacheKey = cacheKeyFor(tenantId, companyId, contactId);
    const incoming = toAiMessage(messageData, timestamp);

    if (contactMessageCache.has(cacheKey)) {
      const existingProcess = contactMessageCache.get(cacheKey);

      if (socialNetwork) {
        existingProcess.socialNetwork = socialNetwork;
      }

      // Consolidando: sumar al batch actual
      if (existingProcess.status === "consolidating") {
        existingProcess.messages.push(incoming);
        clearTimeout(existingProcess.timeoutId);
        existingProcess.timeoutId = setTimeout(() => {
          processConsolidatedMessages(cacheKey);
        }, CONSOLIDATION_DELAY);

        return {
          status: "success",
          message: "Mensaje agregado a consolidación",
        };
      }

      // Procesando (LLM/envío): no reencolar a DELAY_QUEUE — guardar para el siguiente turno
      if (existingProcess.status === "processing") {
        existingProcess.queuedMessages = existingProcess.queuedMessages || [];
        existingProcess.queuedMessages.push(incoming);
        return {
          status: "success",
          message: "Mensaje encolado para el siguiente turno de IA",
        };
      }
    }

    const consolidationProcess = {
      status: "consolidating",
      messages: [incoming],
      queuedMessages: [],
      socialNetwork: socialNetwork || null,
      timeoutId: null,
      createdAt: Date.now(),
    };

    contactMessageCache.set(cacheKey, consolidationProcess);
    consolidationProcess.timeoutId = setTimeout(() => {
      processConsolidatedMessages(cacheKey);
    }, CONSOLIDATION_DELAY);

    return { status: "success", message: "Consolidación iniciada" };
  } catch (error) {
    console.error(`Error procesando respuesta de IA:`, error);
    return { status: "failed", error: error.message };
  }
}

/**
 * Procesa todos los mensajes consolidados para un contacto
 * @param {string} cacheKey - Clave del cache para el contacto
 */
async function processConsolidatedMessages(cacheKey) {
  try {
    const process = contactMessageCache.get(cacheKey);
    if (!process || process.status !== "consolidating") {
      return;
    }

    process.status = "processing";

    const messages = process.messages;
    const { tenantId, companyId, contactId } = parseCacheKey(cacheKey);
    const socialNetwork = process.socialNetwork || null;
    const consolidatedContent = consolidateMessages(messages);

    await sendAIResponseToMainSystem({
      tenantId,
      companyId,
      contactId,
      originalMessagesCount: messages.length,
      messages,
      consolidatedContent,
      socialNetwork,
    });

    const queued = process.queuedMessages || [];
    contactMessageCache.delete(cacheKey);

    // Si llegaron mensajes mientras se generaba la respuesta, procesarlos ya
    if (queued.length > 0) {
      const next = {
        status: "consolidating",
        messages: queued,
        queuedMessages: [],
        socialNetwork,
        timeoutId: null,
        createdAt: Date.now(),
      };
      contactMessageCache.set(cacheKey, next);
      next.timeoutId = setTimeout(() => {
        processConsolidatedMessages(cacheKey);
      }, CONSOLIDATION_DELAY);
    }
  } catch (error) {
    console.error(`Error procesando mensajes consolidados:`, error);
    const process = contactMessageCache.get(cacheKey);
    if (process) {
      contactMessageCache.delete(cacheKey);
    }
  }
}

/**
 * Consolida múltiples mensajes en un contexto coherente
 * @param {Array} messages - Array de mensajes
 * @returns {Object} Contenido consolidado
 */
function consolidateMessages(messages) {
  const sortedMessages = [...messages].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const textMessages = [];
  const attachments = [];

  sortedMessages.forEach((msg, index) => {
    if (msg.text || msg.content) {
      textMessages.push({
        order: index + 1,
        text: msg.text || msg.content,
        timestamp: new Date(msg.timestamp).toLocaleTimeString(),
      });
    }

    if (msg.attachments && Array.isArray(msg.attachments)) {
      msg.attachments.forEach((attachment) => {
        attachments.push({
          type: attachment.type,
          url: attachment.url || attachment.payload?.url,
          order: index + 1,
        });
      });
    }
  });

  const start = sortedMessages[0]?.timestamp || Date.now();
  const end =
    sortedMessages[sortedMessages.length - 1]?.timestamp || Date.now();

  return {
    messageCount: messages.length,
    textMessages,
    attachments,
    timeRange: {
      start: new Date(start),
      end: new Date(end),
    },
    isMultipleMessages: messages.length > 1,
  };
}

/**
 * Envía la respuesta de IA al sistema principal
 * @param {Object} data - Datos de la respuesta
 */
async function sendAIResponseToMainSystem(data) {
  try {
    const {
      tenantId,
      companyId,
      contactId,
      originalMessagesCount,
      messages,
      consolidatedContent,
      socialNetwork,
    } = data;

    const API_URL = (process.env.API_URL || "").replace(/\/+$/, "");
    const API_KEY = process.env.SIZOR_API_KEY;

    if (!API_KEY) {
      console.warn("API_KEY no configurada para enviar respuesta de IA");
      return;
    }
    if (!API_URL) {
      console.warn("API_URL no configurada para enviar respuesta de IA");
      return;
    }

    const response_data = await axios.post(
      `${API_URL}/api/ai-response`,
      {
        tenantId,
        companyId,
        contactId,
        metadata: {
          originalMessagesCount,
          messages,
          consolidatedMessages: consolidatedContent.messageCount,
          hasAttachments: consolidatedContent.attachments.length > 0,
          processingTime:
            Date.now() - consolidatedContent.timeRange.start.getTime(),
        },
        socialNetwork,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
        },
        timeout: 120000,
      }
    );

    if (response_data.status === 200) {
      const body = response_data.data;
      if (body && body.success === false) {
        console.warn(
          `Front devolvió success:false en /ai-response:`,
          body.message || body
        );
      } else {
        console.log(
          `Respuesta de IA enviada exitosamente al sistema principal`
        );
      }
    } else {
      throw new Error(`Error del servidor: ${response_data.status}`);
    }
  } catch (error) {
    console.error(`Error enviando respuesta al sistema principal:`, error);
    throw error;
  }
}

module.exports = {
  processAIResponse,
};
