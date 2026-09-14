const { getMatuDB } = require("../../controllers/database/matudb");
const {
  getDateTime,
  getTimeElapsed,
} = require("../../utils/functions");

/**
 * Valida planes/licencias en MatuDB (schema main).
 * Reemplaza el barrido MySQL multi-tenant.
 */
async function validationLicense() {
  if (process.env.SCHEDULER_ENABLED === "false") {
    console.warn("⚠️ Scheduler deshabilitado (SCHEDULER_ENABLED=false)");
    return { skipped: true };
  }

  const db = getMatuDB();
  try {
    const { data: plans, error } = await db
      .from("plans")
      .select("*")
      .limit(500);

    if (error) {
      throw new Error(error.message || "Error leyendo plans en MatuDB");
    }

    const list = Array.isArray(plans) ? plans : plans ? [plans] : [];
    console.log(`🔧 validationLicense MatuDB: ${list.length} planes`);

    for (const plan of list) {
      const timeElapsedSubscription = getTimeElapsed(
        plan?.date_pay || plan?.date_start_subscription
      );
      if (
        timeElapsedSubscription.totalDays >=
        (plan?.days_to_expire_subscription || 30)
      ) {
        console.log("🔧 Vencimiento de mensualidad", plan.id);
        const isFree = plan?.is_free;

        await db
          .from("plans")
          .eq("id", plan.id)
          .update({
            tokens_used: isFree ? 0 : plan?.tokens_used,
            pending_payment: isFree ? false : true,
            ...(isFree
              ? { date_start_subscription: new Date().toISOString() }
              : {}),
          });
      }

      if (
        plan?.additional_tokens_type === "one-time" &&
        plan?.additional_tokens_expiry
      ) {
        const currentDate = new Date(getDateTime());
        if (currentDate >= new Date(plan.additional_tokens_expiry)) {
          console.log("🔧 Vencimiento de tokens adicionales", plan.id);
          await db
            .from("plans")
            .eq("id", plan.id)
            .update({
              additional_tokens: 0,
              additional_tokens_used: 0,
              additional_tokens_type: null,
              additional_tokens_expiry: null,
              additional_tokens_price: 0,
            });
        }
      }
    }

    return { ok: true, plans: list.length };
  } catch (error) {
    console.error("❌ validationLicense MatuDB:", error.message || error);
    throw error;
  }
}

module.exports = validationLicense;
