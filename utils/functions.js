const APP_NAME = "Sizor AI";

// Mensajes en consola - DEBUG
function debug_log(message) {
  console.log(`[DEBUG]: ${message}`);
}

// conexion a rabbitMQ
function getRabbitMQConection() {
  const NODE_ENV = process.env.NODE_ENV;
  if (NODE_ENV == "production") {
    return {
      protocol: "amqp",
      hostname: process.env.IP_ADDRESS_VPS,
      port: 5672,
      username: process.env.RABBITMQ_USERNAME,
      password: process.env.RABBITMQ_PASSWORD,
      vhost: "/",
    };
  } else {
    return {
      protocol: "amqp",
      hostname: process.env.IP_ADDRESS_VPS_DEV,
      port: 5672,
      username: process.env.RABBITMQ_USERNAME_DEV,
      password: process.env.RABBITMQ_PASSWORD_DEV,
      vhost: "/",
    };
  }
}

// Obtener fecha actual en formato ISSO segun la zona horaria actual
function getDateTime(date = null, daysToSubtract = 0) {
  const currentDate = new Date();

  // Calcula la nueva fecha restando los días especificados
  currentDate.setDate(currentDate.getDate() - daysToSubtract);

  // Obtiene el offset de la zona horaria en minutos y conviérte a milisegundos
  const timeZoneOffset = currentDate.getTimezoneOffset() * 60000;

  // Resta el offset para obtener la fecha UTC
  const localDate = new Date(currentDate.getTime() - timeZoneOffset);

  // Convierte la fecha a una cadena en formato ISO 8601 con la letra 'Z' al final para indicar UTC
  let formattedDate = localDate.toISOString();

  if (date)
    formattedDate = `${date?.substring(0, 10)}${formattedDate.substring(
      10,
      24
    )}`;

  return formattedDate;
}

/**
 * Calcula el tiempo transcurrido desde una fecha ISO hasta la fecha actual.
 * Retorna un objeto con días, horas y minutos transcurridos.
 */
function getTimeElapsed(isoDate = null) {
  if (!isoDate) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      totalHours: 0,
      totalDays: 0,
    };
  }
  const now = new Date(getDateTime());
  const pastDate = new Date(isoDate);

  // Calcular la diferencia en milisegundos
  const diffInMs = now.getTime() - pastDate.getTime();

  // Si la fecha es futura, retornar valores en 0
  if (diffInMs < 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      totalHours: 0,
      totalDays: 0,
    };
  }

  // Convertir a diferentes unidades
  const totalMinutes = Math.floor(diffInMs / (1000 * 60));
  const totalHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const totalDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Calcular días, horas y minutos restantes
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  return {
    days,
    hours,
    minutes,
    totalMinutes,
    totalHours,
    totalDays,
  };
}

function getDateForMySQL() {
  return getDateTime().substring(0, 10) + " " + getDateTime().substring(11, 19);
}

module.exports = {
  debug_log,
  getRabbitMQConection,
  getDateTime,
  getTimeElapsed,
  getDateForMySQL,
  APP_NAME,
};
