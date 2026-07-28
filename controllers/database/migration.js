const { getDatabaseConnection } = require(".");
const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");

const execAsync = promisify(exec);

/**
 * Ejecuta una migración para un tenant específico
 * @param {string} tenantDbName - Nombre de la base de datos del tenant
 * @param {string} prismaProjectPath - Ruta al proyecto Prisma
 * @param {string} databaseUrl - URL de conexión a la base de datos
 * @returns {Promise<object>} Resultado de la migración
 */
async function migrateTenant(tenantDbName, prismaProjectPath, databaseUrl) {
    const tenantResult = {
        tenantId: tenantDbName,
        success: false,
        error: null,
        duration: null,
    };

    const startTime = Date.now();

    try {
        console.log(`📦 Migrando tenant: ${tenantDbName}`);

        await execAsync(`npx prisma migrate deploy`, {
            cwd: prismaProjectPath,
            env: {
                ...process.env,
                DATABASE_URL: databaseUrl,
            },
            // Timeout por tenant (5 minutos por migración)
            timeout: 5 * 60 * 1000,
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Migración aplicada en ${tenantDbName} (${duration}s)`);
        tenantResult.success = true;
        tenantResult.duration = `${duration}s`;
    } catch (tenantError) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(
            `❌ Error migrando ${tenantDbName} (${duration}s)`,
            tenantError.message
        );
        tenantResult.error = tenantError.message;
        tenantResult.duration = `${duration}s`;
    }

    return tenantResult;
}

/**
 * Procesa un array de tareas con un límite de concurrencia
 * @param {Array} items - Array de items a procesar
 * @param {Function} fn - Función async a ejecutar para cada item
 * @param {number} concurrency - Número máximo de tareas simultáneas
 * @returns {Promise<Array>} Array de resultados
 */
async function processInParallel(items, fn, concurrency = 5) {
    const results = [];
    const executing = [];

    for (const item of items) {
        const promise = Promise.resolve().then(() => fn(item));
        results.push(promise);

        // Si alcanzamos el límite, esperamos a que al menos una termine
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }

        // Agregamos la promesa al array de ejecutando y la removemos cuando termine
        executing.push(promise);
        promise.finally(() => {
            const index = executing.indexOf(promise);
            if (index > -1) {
                executing.splice(index, 1);
            }
        });
    }

    // Esperamos a que todas las promesas pendientes terminen
    await Promise.all(executing);

    return Promise.all(results);
}

async function executeMigration() {
    try {
        const db = getDatabaseConnection(null, true);

        const licenses = await db.query(
            "SELECT tenantId FROM clients"
        );
        const tenants = licenses.map((l) => l.tenantId);

        if (tenants.length === 0) {
            return {
                success: true,
                migratedTenants: 0,
                result: [],
                message: "No hay tenants para migrar",
            };
        }

        const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST } = process.env;
        if (!DATABASE_USER || !DATABASE_PASSWORD || !DATABASE_HOST) {
            throw new Error("Variables de entorno de base de datos incompletas");
        }

        // Ruta al proyecto donde vive Prisma
        const prismaProjectPath =
            process.env.NODE_ENV === "production"
                ? path.join(__dirname, "..", "..", "..", "app")
                : path.join(__dirname, "..", "..", "..", "sizor");

        console.log(
            `🚀 Iniciando migración de ${tenants.length} tenants en paralelo (máx 5 simultáneos)`
        );

        // Procesar en paralelo con límite de concurrencia (5 a la vez)
        // Esto evita saturar el sistema mientras acelera el proceso
        const concurrency = parseInt(process.env.MIGRATION_CONCURRENCY || "5", 10);
        const result = await processInParallel(
            tenants,
            async (tenantDbName) => {
                const databaseUrl = `mysql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:3306/${tenantDbName}`;
                return migrateTenant(tenantDbName, prismaProjectPath, databaseUrl);
            },
            concurrency
        );

        const successful = result.filter((r) => r.success).length;
        const failed = result.filter((r) => !r.success).length;

        console.log(
            `✨ Migración completada: ${successful} exitosas, ${failed} fallidas`
        );

        return {
            success: true,
            migratedTenants: tenants.length,
            successful,
            failed,
            result: result,
        };
    } catch (error) {
        console.error("🔥 Error executing migration docs:", error);
        throw error;
    }
}

module.exports = {
    executeMigration,
};
