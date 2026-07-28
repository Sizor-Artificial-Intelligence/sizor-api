const cron = require("node-cron");

/**
 * Gestor de tareas programadas
 * Permite registrar tareas que se ejecutan en horarios específicos
 * y también ejecutarlas manualmente al inicio
 */
class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.cronJobs = new Map();
  }

  /**
   * Registra una tarea programada
   * @param {string} name - Nombre único de la tarea
   * @param {Function} taskFunction - Función async que se ejecutará
   * @param {string} cronExpression - Expresión cron (ej: "0 0 * * *" para medianoche)
   * @param {boolean} runOnStart - Si es true, ejecuta la tarea al iniciar
   */
  registerTask(name, taskFunction, cronExpression, runOnStart = false) {
    if (this.tasks.has(name)) {
      console.warn(`⚠️  La tarea "${name}" ya está registrada. Se reemplazará.`);
    }

    this.tasks.set(name, {
      name,
      taskFunction,
      cronExpression,
      runOnStart,
    });

    // Programar la tarea con cron
    if (cronExpression && cron.validate(cronExpression)) {
      const cronJob = cron.schedule(cronExpression, async () => {
        await this.executeTask(name);
      });
      this.cronJobs.set(name, cronJob);
      console.log(`✅ Tarea "${name}" programada con cron: ${cronExpression}`);
    } else if (cronExpression) {
      console.error(
        `❌ Expresión cron inválida para la tarea "${name}": ${cronExpression}`
      );
    }
  }

  /**
   * Ejecuta una tarea manualmente
   * @param {string} name - Nombre de la tarea
   */
  async executeTask(name) {
    const task = this.tasks.get(name);
    if (!task) {
      console.error(`❌ Tarea "${name}" no encontrada`);
      return;
    }

    const startTime = Date.now();
    console.log(`🔄 Ejecutando tarea: ${name}...`);

    try {
      await task.taskFunction();
      const duration = Date.now() - startTime;
      console.log(
        `✅ Tarea "${name}" completada exitosamente en ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Error ejecutando tarea "${name}" (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Ejecuta todas las tareas marcadas para ejecutarse al inicio
   */
  async runStartupTasks() {
    console.log("🚀 Ejecutando tareas de inicio...");
    const startupTasks = Array.from(this.tasks.values()).filter(
      (task) => task.runOnStart
    );

    if (startupTasks.length === 0) {
      console.log("ℹ️  No hay tareas configuradas para ejecutarse al inicio");
      return;
    }

    // Ejecutar tareas en paralelo
    const promises = startupTasks.map((task) => this.executeTask(task.name));
    await Promise.allSettled(promises);
  }

  /**
   * Detiene una tarea programada
   * @param {string} name - Nombre de la tarea
   */
  stopTask(name) {
    const cronJob = this.cronJobs.get(name);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(name);
      console.log(`⏹️  Tarea "${name}" detenida`);
    }
  }

  /**
   * Detiene todas las tareas programadas
   */
  stopAll() {
    this.cronJobs.forEach((cronJob, name) => {
      cronJob.stop();
      console.log(`⏹️  Tarea "${name}" detenida`);
    });
    this.cronJobs.clear();
  }

  /**
   * Obtiene el estado de todas las tareas
   * @returns {Array} Lista de tareas con su estado
   */
  getTasksStatus() {
    return Array.from(this.tasks.values()).map((task) => ({
      name: task.name,
      cronExpression: task.cronExpression,
      runOnStart: task.runOnStart,
      isScheduled: this.cronJobs.has(task.name),
    }));
  }
}

// Instancia singleton
const scheduler = new Scheduler();

module.exports = scheduler;

