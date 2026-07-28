const { default: axios } = require("axios");

/**
 * Buscar un embedding por referenceId
 */
async function getEmbeddingByReferenceId(tenantId, referenceId) {
  try {
    const API_URL = process.env.API_URL;
    const response = await axios.get(`${API_URL}/qdrant/${referenceId}`, {
      headers: {
        "x-tenant-id": tenantId,
        "X-API-KEY": process.env.SIZOR_API_KEY,
      },
    });
    return response?.data || null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

/**
 * Generar un embedding para un texto
 */
async function createEmbedding(tenantId, text, type, referenceId, params = {}) {
  try {
    const API_URL = process.env.API_URL;
    const response = await axios.post(
      `${API_URL}/qdrant`,
      {
        text,
        type,
        referenceId,
        params,
      },
      {
        headers: {
          "x-tenant-id": tenantId,
          "X-API-KEY": process.env.SIZOR_API_KEY,
        },
      },
    );
    return response?.data || null;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

/**
 * Actualizar un embedding por referenceId
 */
async function updateEmbeddingByReferenceId(
  tenantId,
  type,
  referenceId,
  text,
  params = {},
) {
  try {
    const API_URL = process.env.API_URL;
    const response = await axios.post(
      `${API_URL}/qdrant/${referenceId}`,
      {
        text,
        type,
        params,
      },
      {
        headers: {
          "x-tenant-id": tenantId,
          "X-API-KEY": process.env.SIZOR_API_KEY,
        },
      },
    );
    return response?.data || null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

/**
 * Eliminar embeddings por parámetros dinámicos
 */
async function deleteEmbeddingsByParams(tenantId, params = {}) {
  try {
    const API_URL = process.env.API_URL;
    const response = await axios.post(
      `${API_URL}/qdrant`,
      {
        action: "delete",
        params,
      },
      {
        headers: {
          "x-tenant-id": tenantId,
          "X-API-KEY": process.env.SIZOR_API_KEY,
        },
      },
    );
    return response?.data || null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = {
  getEmbeddingByReferenceId,
  createEmbedding,
  updateEmbeddingByReferenceId,
  deleteEmbeddingsByParams,
};
