const mysql = require("mysql2/promise");
require("dotenv").config();

// Cache de pools de conexión para reutilizar conexiones
const connectionPools = new Map();

/**
 * Obtiene la configuración de conexión a la base de datos
 * @param {boolean} isAdmin - Si es true, usa la base de datos administrativa
 * @param {string|null} databaseName - Nombre de la base de datos (si no es admin)
 * @returns {object} Configuración de conexión
 */
function getDatabaseConfig(isAdmin = false, databaseName = null) {
  const config = {
    host: process.env.DATABASE_HOST || "localhost",
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };

  if (isAdmin) {
    config.database = process.env.DATABASE_ADMIN || "fymapp-admin";
  } else if (databaseName) {
    config.database = databaseName;
  }

  return config;
}

/**
 * Crea o obtiene un pool de conexiones para una base de datos
 * @param {string|null} databaseName - Nombre de la base de datos (null para admin)
 * @param {boolean} isAdmin - Si es true, usa la base de datos administrativa
 * @returns {Promise<mysql.Pool>} Pool de conexiones
 */
function getConnectionPool(databaseName = null, isAdmin = false) {
  const poolKey = isAdmin ? "admin" : databaseName;

  if (!connectionPools.has(poolKey)) {
    const config = getDatabaseConfig(isAdmin, databaseName);
    const pool = mysql.createPool(config);
    connectionPools.set(poolKey, pool);

    // Manejar errores del pool
    pool.on("error", (err) => {
      console.error(`Error en el pool de conexiones ${poolKey}:`, err);
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        connectionPools.delete(poolKey);
      }
    });
  }

  return connectionPools.get(poolKey);
}

/**
 * Obtiene una conexión a la base de datos con métodos para ejecutar consultas
 * @param {string|null} databaseName - Nombre de la base de datos (null para admin)
 * @param {boolean} isAdmin - Si es true, usa la base de datos administrativa
 * @returns {object} Objeto con métodos para ejecutar consultas
 */
function getDatabaseConnection(databaseName = null, isAdmin = false) {
  const pool = getConnectionPool(databaseName, isAdmin);

  return {
    /**
     * Ejecuta una consulta SQL con parámetros
     * @param {string} sql - Query SQL con ? como placeholders
     * @param {array} params - Array de parámetros para reemplazar los ?
     * @returns {Promise<array>} Resultados de la consulta
     */
    async query(sql, params = []) {
      try {
        const [rows] = await pool.execute(sql, params);
        return rows;
      } catch (error) {
        console.error("Error ejecutando query:", error);
        throw error;
      }
    },

    /**
     * Ejecuta una consulta SQL con parámetros (alias de query)
     * @param {string} sql - Query SQL con ? como placeholders
     * @param {array} params - Array de parámetros para reemplazar los ?
     * @returns {Promise<array>} Resultados de la consulta
     */
    async execute(sql, params = []) {
      return this.query(sql, params);
    },

    /**
     * Ejecuta una consulta SQL y retorna también los metadatos
     * @param {string} sql - Query SQL con ? como placeholders
     * @param {array} params - Array de parámetros para reemplazar los ?
     * @returns {Promise<object>} Objeto con rows y fields
     */
    async queryWithFields(sql, params = []) {
      try {
        const [rows, fields] = await pool.execute(sql, params);
        return { rows, fields };
      } catch (error) {
        console.error("Error ejecutando query:", error);
        throw error;
      }
    },

    /**
     * Obtiene una conexión del pool directamente (para transacciones)
     * @returns {Promise<mysql.PoolConnection>} Conexión del pool
     */
    async getConnection() {
      try {
        return await pool.getConnection();
      } catch (error) {
        console.error("Error obteniendo conexión:", error);
        throw error;
      }
    },

    /**
     * Cierra todas las conexiones del pool
     * @returns {Promise<void>}
     */
    async close() {
      try {
        const poolKey = isAdmin ? "admin" : databaseName;
        await pool.end();
        connectionPools.delete(poolKey);
      } catch (error) {
        console.error("Error cerrando pool:", error);
        throw error;
      }
    },

    /**
     * Retorna el pool directamente (para casos avanzados)
     * @returns {mysql.Pool} Pool de conexiones
     */
    getPool() {
      return pool;
    },
  };
}

/**
 * Cierra todos los pools de conexión
 * @returns {Promise<void>}
 */
async function closeAllConnections() {
  const closePromises = Array.from(connectionPools.values()).map((pool) =>
    pool.end().catch((err) => console.error("Error cerrando pool:", err))
  );
  await Promise.all(closePromises);
  connectionPools.clear();
}

// Cerrar todas las conexiones al terminar la aplicación
process.on("SIGINT", async () => {
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeAllConnections();
  process.exit(0);
});

module.exports = {
  getDatabaseConnection,
  getConnectionPool,
  closeAllConnections,
};
