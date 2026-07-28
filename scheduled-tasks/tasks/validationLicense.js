const { getDatabaseConnection } = require("../../controllers/database");
const {
  getDateTime,
  getTimeElapsed,
  getDateForMySQL,
} = require("../../utils/functions");

/**
 * Valida las licencias de los clientes
 * Verifica el estado de las licencias y actualiza su estado si es necesario
 */
async function validationLicense() {
  const dbAdmin = getDatabaseConnection(null, true);
  try {
    const clients = await dbAdmin.query(
      "SELECT * FROM clients WHERE parentTenantId IS NULL"
    );
    for (const client of clients) {
      const dbTenant = getDatabaseConnection(client.tenantId);

      // Consultar plan
      const plans = await dbTenant.query("SELECT * FROM Plan");

      // Consultar licencia
      const license = await dbTenant.query("SELECT * FROM License LIMIT 1");

      // Recorrer planes
      for (const plan of plans) {
        // Valido si hay que pagar la mensualidad
        const timeElapsedSubscription = getTimeElapsed(
          plan?.datePay || plan?.dateStartSubscription
        );
        if (
          timeElapsedSubscription.totalDays >=
          (plan?.daysToExpireSubscription || 30)
        ) {
          console.log("🔧 Vencimiento de mensualidad");

          const isFree = plan?.isFree;
          // Marco plan como pendiente de pago
          if (!license?.isSon) {
            await dbTenant.execute(
              "UPDATE Plan SET tokensUsed = ?, pendingPayment = ? WHERE id = ?",
              [isFree ? 0 : plan?.tokensUsed, isFree ? false : true, plan?.id]
            );
          }

          // Actualizo fecha de suscripción
          if (isFree) {
            await dbTenant.execute(
              "UPDATE Plan SET dateStartSubscription = ? WHERE id = ?",
              [getDateForMySQL(), plan?.id]
            );
          }

          // Busco todas las licencias hijas para bloquearlas
          if (license?.isEnterprise) {
            console.log("🔧 Bloqueo de licencias hijas");
            const licensesChildren = await dbAdmin.query(
              "SELECT tenantId FROM clients WHERE parentTenantId = ?",
              [client.tenantId]
            );
            for (const tenantId of licensesChildren) {
              const dbTenantChild = getDatabaseConnection(tenantId);
              await dbTenantChild.execute(
                "UPDATE Plan SET pendingPayment = ? WHERE tenantId = ?",
                [true, tenantId]
              );
            }
          }
        }

        // Valido si los tokens adicionales han expirado
        if (
          plan?.additionalTokensType === "one-time" &&
          plan?.additionalTokensExpiry
        ) {
          const currentDate = new Date(getDateTime());
          if (currentDate >= new Date(plan?.additionalTokensExpiry)) {
            console.log("🔧 Vencimiento de tokens adicionales");

            const newMaxTokens = plan?.maxTokens - plan?.additionalTokens;
            const newUsedTokens = plan?.tokensUsed - plan?.additionalTokensUsed;

            await dbTenant.execute(
              "UPDATE Plan SET additionalTokens = ?, additionalTokensExpiry = ?, additionalTokensType = ?, additionalTokensPrice = ?, maxTokens = ?, tokensUsed = ?, additionalTokensUsed = ? WHERE id = ?",
              [0, null, null, 0, newMaxTokens, newUsedTokens, 0, plan?.id]
            );
            // TODO: Notificar al usuario ADMINISTRADOR de la empresa que ya se le vencieron los tokens adicionales
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error en validación de licencias:", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = validationLicense;
