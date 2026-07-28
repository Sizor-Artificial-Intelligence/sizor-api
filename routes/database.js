const express = require("express");
const router = express.Router();
const {
    executeMigration
} = require("../controllers/database/migration");

// Timeout de 30 minutos (1800000 ms) solo para la ruta de migración
const MIGRATION_TIMEOUT = 30 * 60 * 1000;

// Middleware para aumentar timeout solo para la ruta de migración
router.post(
    "/migration",
    (req, res, next) => {
        // Configurar timeout del socket para este request específico (30 minutos)
        if (req.socket) {
            req.socket.setTimeout(MIGRATION_TIMEOUT);

            // Manejar timeout del socket
            req.socket.once("timeout", () => {
                if (!res.headersSent) {
                    console.error(
                        "⏱️ Timeout en migración de docs después de 30 minutos"
                    );
                    res.status(504).json({
                        success: false,
                        error:
                            "Request timeout: La migración está tomando más de 30 minutos. Verifica el estado de las migraciones manualmente.",
                    });
                }
                req.socket.destroy();
            });

            // Prevenir que el socket se cierre por inactividad
            req.socket.setKeepAlive(true);
        }

        next();
    },
    async (req, res) => {
        try {
            const response = await executeMigration();

            if (!res.headersSent) {
                return res.json({
                    ...response,
                });
            }
        } catch (error) {
            console.error("Error en ruta de migración:", error);

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: error.message || "Error interno del servidor",
                });
            }
        }
    }
);

module.exports = router;
