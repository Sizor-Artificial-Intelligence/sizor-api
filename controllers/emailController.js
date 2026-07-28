const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const { APP_NAME } = require("../utils/functions");

// Leer y personalizar la plantilla HTML
function getEmailTemplate(type, params) {
  const templatePath = path.join(__dirname, "../templates", `${type}.html`);
  let template = fs.readFileSync(templatePath, "utf8");

  // Procesar bloques {{#each}} antes de otros reemplazos
  template = processEachBlocks(template, params);

  const paramsKeys = Object.keys(params);
  paramsKeys.forEach((key) => {
    // Saltar 'data' si es un array, ya fue procesado en processEachBlocks
    if (Array.isArray(params[key])) {
      return;
    }
    // Usar expresión regular con bandera global para reemplazar todas las ocurrencias
    const regex = new RegExp(`{{${key}}}`, "g");
    template = template.replace(regex, params[key]);
  });

  // variables estaticas
  template = template.replace(/{{current_year}}/g, new Date().getFullYear());
  template = template.replace(/{{support_email}}/g, process.env.SUPPORT_EMAIL);
  template = template.replace(/{{app_name}}/g, APP_NAME);

  return template;
}

// Procesar bloques {{#each}} en el template
function processEachBlocks(template, params) {
  // Buscar bloques {{#each data}} ... {{/each}}
  const eachBlockRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;

  return template.replace(eachBlockRegex, (match, arrayKey, blockContent) => {
    const array = params[arrayKey];

    // Si no es un array, retornar string vacío
    if (!Array.isArray(array)) {
      return "";
    }

    // Procesar cada elemento del array
    return array
      .map((item) => {
        let itemTemplate = blockContent;

        // Reemplazar {{this.property}} con los valores del item
        const thisPropertyRegex = /{{this\.(\w+)}}/g;
        itemTemplate = itemTemplate.replace(
          thisPropertyRegex,
          (propMatch, propKey) => {
            return item[propKey] || "";
          }
        );

        // También soportar {{property}} directamente (sin this.)
        Object.keys(item).forEach((key) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          itemTemplate = itemTemplate.replace(regex, item[key] || "");
        });

        return itemTemplate;
      })
      .join("");
  });
}

// Enviar correos electrónicos
async function sendEmail(to, type, subject, params) {
  const emailHtml = getEmailTemplate(type, params);
  const recipients = Array.isArray(to) ? to : [to];

  try {
    const resend = new Resend(process.env.USER_PASSWORD);
    const result = await resend.emails.send({
      from: process.env.USER_EMAIL,
      to: recipients,
      subject,
      html: emailHtml,
    });
    console.log("Email sent:", result);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

module.exports = { sendEmail };
