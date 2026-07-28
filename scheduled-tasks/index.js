const scheduler = require("./scheduler");
const validationLicense = require("./tasks/validationLicense");

/**
 * Registra todas las tareas programadas
 * Este archivo centraliza el registro de todas las tareas
 */
function registerAllTasks() {
  // Tarea: Validación de licencias
  // Se ejecuta cada día a las 12:00 AM (medianoche)
  // También se ejecuta al iniciar el proyecto
  scheduler.registerTask(
    "validationLicense",
    validationLicense,
    "0 0 * * *", // Cada día a las 12:00 AM
    true // Ejecutar al inicio
  );

  console.log("📋 Todas las tareas programadas han sido registradas");
}

/**
 * Inicializa el sistema de tareas programadas
 * Registra todas las tareas y ejecuta las que deben correr al inicio
 */
async function initializeScheduler() {
  try {
    registerAllTasks();
    await scheduler.runStartupTasks();
    console.log("✅ Sistema de tareas programadas inicializado");
  } catch (error) {
    console.error("❌ Error inicializando scheduler:", error);
    throw error;
  }
}

module.exports = {
  scheduler,
  initializeScheduler,
  registerAllTasks,
};
