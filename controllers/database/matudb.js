/**
 * Cliente MatuDB — misma config que sizor (schema main, aislamiento por company_id).
 * Reemplaza el acceso multi-DB MySQL para lecturas/escrituras nuevas.
 */
const { createClient } = require("@devjuanes/matuclient");

let _client = null;

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}`);
  }
  return value;
}

function getMatuDB() {
  if (_client) return _client;
  _client = createClient({
    url: requireEnv("MATUDB_URL"),
    projectId: requireEnv("MATUDB_PROJECT_ID"),
    apiKey: requireEnv("MATUDB_API_KEY"),
    schema: process.env.MATUDB_SCHEMA || "main",
    useSupabase: process.env.MATUDB_USE_SUPABASE === "true",
  });
  return _client;
}

/**
 * Ejecuta SQL raw vía MatuDB rpc.
 * @param {string} sql
 * @param {Record<string, any>} [params]
 */
async function matuSql(sql, params) {
  const db = getMatuDB();
  const { data, error } = await db.rpc(sql, params);
  if (error) {
    const err = new Error(error.message || "MatuDB SQL error");
    err.details = error;
    throw err;
  }
  return data;
}

/**
 * Query builder sobre una tabla.
 * @param {string} table
 */
function matuFrom(table) {
  return getMatuDB().from(table);
}

/**
 * Actualiza training_files.status por file_url (reemplazo del UPDATE TrainingFile MySQL).
 */
async function updateTrainingFileStatus(
  fileUrl,
  status,
  companyId = null,
  fileId = null
) {
  let q = matuFrom("training_files");
  if (fileId) {
    q = q.eq("id", fileId);
  } else {
    q = q.eq("file_url", fileUrl);
  }
  if (companyId) {
    q = q.eq("company_id", companyId);
  }
  const { error } = await q.update({
    status,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(error.message || "No se pudo actualizar training_files");
  }
}

module.exports = {
  getMatuDB,
  matuSql,
  matuFrom,
  updateTrainingFileStatus,
  MATUDB_SESSION_TENANT: "main",
};
