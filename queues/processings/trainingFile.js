const { updateTrainingFileStatus } = require("../../controllers/database/matudb");
const {
  extractFileContent,
  splitTextForEmbeddings,
  createEmbeddingsForFragments,
  deleteEmbeddingsForFiles,
} = require("../../controllers/fileController");
const wsManager = require("../../services/websocket");

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

async function markError(fileUrl, companyId, userId) {
  try {
    if (fileUrl) {
      await updateTrainingFileStatus(fileUrl, "error", companyId || null);
    }
  } catch (err) {
    console.error("No se pudo marcar training file como error:", err);
  }
  await notifyRefresh(userId);
}

async function processTrainingFile(message) {
  const { fileUrl, extension, tenantId, companyId, userId, action } = message || {};

  try {
    if (action === "create") {
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

      await updateTrainingFileStatus(fileUrl, status, companyId || null);
      await notifyRefresh(userId);
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
    await markError(fileUrl, companyId, userId);
    return { status: "failed", error: error.message };
  }
}

module.exports = { processTrainingFile };
