const { getDatabaseConnection } = require("./controllers/database");

async function rollback() {
  const dbAdmin = await getDatabaseConnection(null, true);
  const DATABASES = ["sizor-0001", "sizor-0002", "sizor-0003"];

  // Eliminar clientes
  await dbAdmin.execute(`DELETE FROM clients`);

  // Resetear config
  await dbAdmin.execute(`UPDATE config SET nextLicenseCode = '0001'`);

  // Eliminar formularios
  await dbAdmin.execute(`DELETE FROM \`form-slugs\``);

  // Eliminar referencia de pago
  await dbAdmin.execute(`DELETE FROM \`payment_preferences\``);

  // Eliminar subdominios
  await dbAdmin.execute(`DELETE FROM \`subdomains\``);

  // Eliminarn usuarios
  await dbAdmin.execute(`DELETE FROM users`);

  // Borrar bases de datos clientes
  for (const database of DATABASES) {
    await dbAdmin.execute(`DROP DATABASE IF EXISTS \`${database}\``);
  }
}

(async () => {
  try {
    await rollback();
    console.log("Rollback completado");
  } catch (error) {
    console.error("Error al realizar el rollback:", error);
  }
  process.exit(0);
})();
