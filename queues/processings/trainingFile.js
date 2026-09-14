const { updateTrainingFileStatus } = require("../../controllers/database/matudb");
const {
  extractFileContent,
  splitTextForEmbeddings,
  createEmbeddingsForFragments,
  deleteEmbeddingsForFiles,
} = require("../../controllers/fileController");
const wsManager = require("../../services/websocket");

async function processTrainingFile(message) {
  try {
    const { fileUrl, extension, tenantId, companyId, userId, action } = message;

    // Crear embeddings para el archivo
    if (action === "create") {
      let status = "ready";

      // # Extraer contenido del archivo
      const dataContent = await extractFileContent(fileUrl, extension);
      let content = dataContent?.text || null;

      // Eliminar marcas de paginación solo si content no es null
      if (content && typeof content === "string") {
        content = content.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "");
      }

      console.log("DEBUG: Contenido del archivo -> " + content);

      // # Si no se pudo extraer el contenido, cambiar estado del archivo a error
      if (!content) {
        status = "error";
      } else {
        // # Dividir el contenido en fragmentos para embeddings
        const fragments = splitTextForEmbeddings(content);

        // # Crear embeddings para los fragmentos
        if (fragments.length > 0) {
          await createEmbeddingsForFragments(fragments, tenantId, fileUrl);
        }
      }

      // Actualizar el estado del archivo en MatuDB (schema main)
      await updateTrainingFileStatus(
        fileUrl,
        status,
        companyId || null
      );

      // Realtime update
      wsManager.sendToUser(userId, {
        timestamp: new Date().toISOString(),
        type: "refreshLoaders",
      });
    }

    // Eliminar embeddings para el archivo
    if (action === "delete") {
      await deleteEmbeddingsForFiles(tenantId, [fileUrl]);
    }

    return {
      status: "success",
      message: "Archivo de entrenamiento procesado correctamente",
    };
  } catch (error) {
    console.error("Error al procesar el archivo de entrenamiento:", error);
    return { status: "failed", error: error.message };
  }
}

module.exports = { processTrainingFile };
