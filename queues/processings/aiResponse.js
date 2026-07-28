const axios = require("axios");

// Cache para consolidar mensajes por contacto
const contactMessageCache = new Map();

// Configuración de consolidación
const CONSOLIDATION_DELAY = 3000; // 3 segundos para consolidar mensajes
const MAX_CONSOLIDATION_TIME = 10000; // Máximo 10 segundos esperando

/**
 * Procesa mensajes de IA con consolidación inteligente
 * @param {Object} message - Mensaje de la cola
 * @returns {Object} Resultado del procesamiento
 */
async function processAIResponse(message) {
  try {
    const { tenantId, companyId, contactId, messageData, timestamp } = message;

    // Generar clave única para el contacto
    const cacheKey = `${tenantId}_${companyId}_${contactId}`;

    // Verificar si ya hay un procesamiento en curso para este contacto
    if (contactMessageCache.has(cacheKey)) {
      const existingProcess = contactMessageCache.get(cacheKey);

      // Si el proceso existente está en consolidación, agregar este mensaje
      if (existingProcess.status === "consolidating") {
        existingProcess.messages.push({
          ...messageData,
          timestamp: timestamp || Date.now(),
        });

        // Extender el tiempo de consolidación si es necesario
        clearTimeout(existingProcess.timeoutId);
        existingProcess.timeoutId = setTimeout(() => {
          processConsolidatedMessages(cacheKey);
        }, CONSOLIDATION_DELAY);

        return {
          status: "success",
          message: "Mensaje agregado a consolidación",
        };
      }

      // Si ya hay un procesamiento activo, rechazar este mensaje (se reencolará)
      if (existingProcess.status === "processing") {
        return {
          status: "pending",
          message: "Procesamiento en curso, reencolando",
        };
      }
    }

    // Crear nuevo proceso de consolidación
    const consolidationProcess = {
      status: "consolidating",
      messages: [
        {
          ...messageData,
          timestamp: timestamp || Date.now(),
        },
      ],
      timeoutId: null,
      createdAt: Date.now(),
    };

    contactMessageCache.set(cacheKey, consolidationProcess);

    // Configurar timeout para procesar mensajes consolidados
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

    // Marcar como procesando
    process.status = "processing";

    const messages = process.messages;
    const [tenantId, companyId, contactId] = cacheKey.split("_");

    // Consolidar el contenido de todos los mensajes
    const consolidatedContent = consolidateMessages(messages);

    // Enviar respuesta al sistema principal
    await sendAIResponseToMainSystem({
      tenantId,
      companyId,
      contactId,
      response: null,
      originalMessagesCount: messages.length,
      messages,
      consolidatedContent,
    });

    // Limpiar cache
    contactMessageCache.delete(cacheKey);
  } catch (error) {
    console.error(`Error procesando mensajes consolidados:`, error);

    // Limpiar cache en caso de error
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
  // Ordenar mensajes por timestamp
  const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

  const textMessages = [];
  const attachments = [];

  sortedMessages.forEach((msg, index) => {
    if (msg.text) {
      textMessages.push({
        order: index + 1,
        text: msg.text,
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

  return {
    messageCount: messages.length,
    textMessages,
    attachments,
    timeRange: {
      start: new Date(sortedMessages[0].timestamp),
      end: new Date(sortedMessages[sortedMessages.length - 1].timestamp),
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

    const API_URL = process.env.API_URL;
    const API_KEY = process.env.SIZOR_API_KEY;

    if (!API_KEY) {
      console.warn("API_KEY no configurada para enviar respuesta de IA");
      return;
    }

    // Enviar respuesta al sistema principal
    const response_data = await axios.post(
      `${API_URL}/ai-response`,
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
        timeout: 60000,
      },
    );

    if (response_data.status === 200) {
      console.log(`Respuesta de IA enviada exitosamente al sistema principal`);
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
