const { updateTrainingFileStatus } = require("../../controllers/database/matudb");
const {
  extractFileContent,
  splitTextForEmbeddings,
  createEmbeddingsForFragments,
  deleteEmbeddingsForFiles,
} = require("../../controllers/fileController");
const wsManager = require("../../services/websocket");

const PROCESS_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutos máx por archivo

async function notifyRefresh(userId) {
  if (!userId) return;
  try {
    wsManager.sendToUser(userId, {
      timestamp: new Date().toISOString(),
      type: "refreshLoaders",
    });
  } catch (err) {
    console.warn("No se pudo notificar refreshLoaders:", err?.message || err);
  }
}

async function markStatus(fileUrl, companyId, userId, status, fileId = null) {
  try {
    if (fileId || fileUrl) {
      await updateTrainingFileStatus(
        fileUrl,
        status,
        companyId || null,
        fileId || null
      );
    }
  } catch (err) {
    console.error("No se pudo actualizar training file status:", err);
  }
  await notifyRefresh(userId);
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout (${ms}ms) en ${label}`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function processTrainingFile(message) {
  const {
    fileUrl,
    fileId,
    extension,
    tenantId,
    companyId,
    userId,
    action,
  } = message || {};

  try {
    if (action === "create") {
      const run = async () => {
        let status = "ready";

        const dataContent = await extractFileContent(fileUrl, extension);
        let content = dataContent?.text || null;

        if (content && typeof content === "string") {
          content = content.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "");
        }

        if (!content) {
          status = "error";
        } else {
          const fragments = splitTextForEmbeddings(content);
          if (fragments.length > 0) {
            const embedded = await createEmbeddingsForFragments(
              fragments,
              tenantId,
              fileUrl
            );
            if (!embedded) {
              status = "error";
            }
          }
        }

        await updateTrainingFileStatus(
          fileUrl,
          status,
          companyId || null,
          fileId || null
        );
        await notifyRefresh(userId);
      };

      await withTimeout(run(), PROCESS_TIMEOUT_MS, "processTrainingFile");
    }

    if (action === "delete") {
      await deleteEmbeddingsForFiles(tenantId, [fileUrl]);
    }

    return {
      status: "success",
      message: "Archivo de entrenamiento procesado correctamente",
    };
  } catch (error) {
    console.error("Error al procesar el archivo de entrenamiento:", error);
    await markStatus(fileUrl, companyId, userId, "error", fileId);
    return { status: "failed", error: error.message };
  }
}

module.exports = { processTrainingFile };
