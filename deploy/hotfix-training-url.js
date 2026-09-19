/**
 * Hotfix VPS: file_type=url debe leerse como texto desde MatuDB.
 * Uso:
 *   cd /root/SizorAI/sizor-api
 *   node deploy/hotfix-training-url.js
 *   pm2 restart sizor-api --update-env
 */
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "controllers", "fileController.js");
let src = fs.readFileSync(target, "utf8");
const before = src;

// 1) Asegurar que "url" se normaliza a "txt"
if (!src.includes('"url", "html"') && !src.includes("'url', 'html'")) {
  src = src.replace(
    /\["txt", "text", "text\/plain"(?:, "html", "text\/html")?\]/,
    '["txt", "text", "text/plain", "url", "html", "text/html"]'
  );
}

// 2) Asegurar case "url" junto a txt/html
if (!/case\s+["']url["']/.test(src)) {
  src = src.replace(
    /case\s+["']html["']\s*:\s*\n(\s*)content = await extractTextContent/,
    'case "html":\n      case "url":\n$1content = await extractTextContent'
  );
}

// 3) Fallback en default si el tipo queda como "url"
if (!src.includes('fileType === "url"') && !src.includes("fileType === 'url'")) {
  src = src.replace(
    /default:\s*\n\s*content = null;\s*\n\s*break;/,
    `default: {
        const lowerUrl = String(fileUrl || "").split("?")[0].toLowerCase();
        if (
          fileType === "url" ||
          lowerUrl.endsWith(".txt") ||
          lowerUrl.endsWith(".html") ||
          lowerUrl.endsWith(".htm")
        ) {
          content = await extractTextContent(fileUrl);
        } else {
          content = null;
        }
        break;
      }`
  );
}

// 4) Log de tamaño de contenido
if (!src.includes("DEBUG: Contenido del archivo")) {
  src = src.replace(
    /return \{\s*\n\s*text: content\?\.text \|\| null,/,
    `const text = content?.text || null;
    console.log(
      "DEBUG: Contenido del archivo ->",
      text ? text.length + " chars" : null,
    );
    return {
      text,`
  );
}

if (src === before) {
  console.log("Sin cambios automáticos. Mostrando pistas:");
} else {
  fs.writeFileSync(target, src);
  console.log("OK: parche aplicado en", target);
}

console.log("case url:", /case\s+["']url["']/.test(src) ? "sí" : "NO");
console.log(
  'lista con "url":',
  /\[([^\]]*url[^\]]*)\]/.test(src) ? "sí" : "NO"
);
