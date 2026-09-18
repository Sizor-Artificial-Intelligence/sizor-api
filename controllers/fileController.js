const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const officeParser = require("officeparser");
const JSZip = require("jszip");
const axios = require("axios");
const {
  createEmbedding,
  deleteEmbeddingsByParams,
} = require("./embeddingController");

// Convertir fechas de forma segura
function safeDateToISO(dateValue) {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

// Filtrar propiedades null o undefined
function filterNullUndefined(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }

  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      // Si el valor es un objeto, filtrarlo recursivamente
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        const filteredValue = filterNullUndefined(value);
        // Solo agregar si el objeto filtrado tiene propiedades
        if (filteredValue && Object.keys(filteredValue).length > 0) {
          filtered[key] = filteredValue;
        }
      } else {
        filtered[key] = value;
      }
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

function normalizeFileType(fileType = "", fileUrl = "") {
  const normalizedType = String(fileType || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  if (
    [
      "pdf",
      "application/pdf",
      "application/x-pdf",
      "application/acrobat",
      "applications/vnd.pdf",
      "text/pdf",
      "text/x-pdf",
    ].includes(normalizedType)
  ) {
    return "pdf";
  }

  if (
    [
      "doc",
      "docx",
      "application/msword",
      "application/doc",
      "application/vnd.ms-word",
      "application/vnd.msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(normalizedType)
  ) {
    return normalizedType === "doc" ? "doc" : "docx";
  }

  if (["txt", "text", "text/plain", "url", "html", "text/html"].includes(normalizedType)) {
    return normalizedType === "html" || normalizedType === "text/html"
      ? "html"
      : "txt";
  }

  const urlWithoutQuery = String(fileUrl || "")
    .split("?")[0]
    .toLowerCase();

  if (urlWithoutQuery.endsWith(".pdf")) {
    return "pdf";
  }

  if (urlWithoutQuery.endsWith(".doc")) {
    return "doc";
  }

  if (urlWithoutQuery.endsWith(".docx")) {
    return "docx";
  }

  if (urlWithoutQuery.endsWith(".txt") || urlWithoutQuery.endsWith(".html") || urlWithoutQuery.endsWith(".htm")) {
    return urlWithoutQuery.endsWith(".txt") ? "txt" : "html";
  }

  return normalizedType;
}

// Extraer el contenido del archivo
async function extractFileContent(fileUrl, fileType) {
  try {
    let content = null;
    const normalizedFileType = normalizeFileType(fileType, fileUrl);
    console.log(
      "DEBUG: Tipo de archivo",
      fileType,
      normalizedFileType,
      fileUrl,
    );

    switch (normalizedFileType) {
      case "pdf":
        content = await extractPdfContent(fileUrl);
        break;
      case "docx":
      case "doc":
        content = await extractDocContent(fileUrl);
        break;
      case "txt":
      case "html":
      case "url":
        content = await extractTextContent(fileUrl);
        break;
      default:
        content = null;
        break;
    }

    return {
      text: content?.text || null,
      metadata: content?.metadata || null,
    };
  } catch (error) {
    console.log(error);
    return {
      text: null,
      metadata: null,
    };
  }
}

async function extractTextContent(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 5 * 1024 * 1024,
    });
    const text = Buffer.from(response.data).toString("utf8");
    return {
      text: text || null,
      metadata: { Fuente: "url/txt" },
    };
  } catch (error) {
    console.error("Error al extraer contenido de texto:", error);
    return { text: null, metadata: null };
  }
}

// Extraer el contenido del PDF
async function extractPdfContent(url) {
  let parser = null;

  try {
    // Descargar el PDF
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });

    // Convertir a Uint8Array (PDFParse requiere este formato)
    // Crear una copia del buffer para evitar problemas de transferencia
    const uint8Array = new Uint8Array(response.data);

    // Crear una sola instancia y usar secuencialmente
    parser = new PDFParse({ data: uint8Array });

    // Extraer texto primero
    const textResult = await parser.getText();

    // Luego extraer metadatos (usando la misma instancia)
    const infoResult = await parser.getInfo({ parsePageInfo: false });

    // Extraer fechas XMP/XAP de forma segura
    let dateNode = null;
    try {
      if (typeof infoResult?.getDateNode === "function") {
        dateNode = infoResult.getDateNode();
      }
    } catch (error) {
      console.log("Error al obtener fechas XMP:", error);
    }

    // Construir objeto de metadatos con toda la información disponible
    // Solo incluir valores primitivos para evitar problemas de serialización
    const metadata = {
      // Información básica del documento
      title: infoResult?.info?.Title || null,
      author: infoResult?.info?.Author || null,
      subject: infoResult?.info?.Subject || null,
      keywords: infoResult?.info?.Keywords || null,
      creator: infoResult?.info?.Creator || null,
      producer: infoResult?.info?.Producer || null,
      creationDate: safeDateToISO(infoResult?.info?.CreationDate),
      modificationDate: safeDateToISO(infoResult?.info?.ModDate),
      totalPages: infoResult?.total || null,

      // Metadatos XMP (si están disponibles)
      xmpCreateDate: safeDateToISO(dateNode?.XmpCreateDate),
      xmpModifyDate: safeDateToISO(dateNode?.XmpModifyDate),
      xmpMetadataDate: safeDateToISO(dateNode?.XmpMetadataDate),
      xapCreateDate: safeDateToISO(dateNode?.XapCreateDate),
      xapModifyDate: safeDateToISO(dateNode?.XapModifyDate),
      xapMetadataDate: safeDateToISO(dateNode?.XapMetadataDate),

      // Información de permisos (convertir a objeto serializable)
      permissions: infoResult?.permission
        ? JSON.parse(JSON.stringify(infoResult.permission))
        : null,

      // Fingerprints del documento (convertir a array serializable)
      fingerprints: infoResult?.fingerprints
        ? Array.isArray(infoResult.fingerprints)
          ? infoResult.fingerprints
          : [infoResult.fingerprints]
        : null,

      // Outline (tabla de contenidos)
      hasOutline: !!infoResult?.outline?.length,
      outlineItems: infoResult?.outline?.length || 0,
    };

    // Limpiar el parser
    await parser.destroy();
    parser = null;

    // Filtrar propiedades null o undefined del metadata
    const filteredMetadata = filterNullUndefined(metadata);

    return {
      text: textResult?.text || null,
      metadata: {
        Autor: filteredMetadata?.author || "N/A",
        Creador: filteredMetadata?.creator || "N/A",
        Productor: filteredMetadata?.producer || "N/A",
        Páginas: filteredMetadata?.totalPages || "N/A",
      },
    };
  } catch (error) {
    console.error("Error al extraer contenido del PDF:", error);

    // Asegurarse de limpiar el parser en caso de error
    try {
      if (parser) await parser.destroy();
    } catch (cleanupError) {
      console.error("Error al limpiar parser:", cleanupError);
    }

    return {
      text: null,
      metadata: null,
    };
  }
}

// Detectar si es DOCX o DOC basándose en los magic numbers
function detectDocType(buffer) {
  // DOCX es un archivo ZIP, empieza con PK (50 4B)
  // DOC antiguo tiene magic numbers específicos
  const firstBytes = buffer.slice(0, 8);

  // DOCX: PK (ZIP signature)
  if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4b) {
    return "docx";
  }

  // DOC: Magic numbers comunes de archivos DOC antiguos
  // 0xD0CF11E0A1B11AE1 (Microsoft Office compound document)
  if (
    firstBytes[0] === 0xd0 &&
    firstBytes[1] === 0xcf &&
    firstBytes[2] === 0x11 &&
    firstBytes[3] === 0xe0
  ) {
    return "doc";
  }

  // Por defecto, intentar como DOCX
  return "docx";
}

// Extraer metadatos de DOCX desde los archivos XML internos
async function extractDocxMetadata(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const metadata = {};

    // Leer docProps/core.xml (metadatos principales)
    const coreXml = zip.file("docProps/core.xml");
    if (coreXml) {
      const coreContent = await coreXml.async("string");
      // Extraer información básica usando expresiones regulares simples
      const titleMatch = coreContent.match(
        /<dc:title[^>]*>([^<]*)<\/dc:title>/i,
      );
      const creatorMatch = coreContent.match(
        /<dc:creator[^>]*>([^<]*)<\/dc:creator>/i,
      );
      const subjectMatch = coreContent.match(
        /<dc:subject[^>]*>([^<]*)<\/dc:subject>/i,
      );
      const keywordsMatch = coreContent.match(
        /<cp:keywords[^>]*>([^<]*)<\/cp:keywords>/i,
      );

      // Las fechas pueden venir con atributos, extraer el contenido
      const createdMatch = coreContent.match(
        /<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/i,
      );
      const modifiedMatch = coreContent.match(
        /<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/i,
      );

      // También buscar en formato alternativo
      const createdAltMatch = coreContent.match(
        /<dcterms:created[^>]*xsi:type="dcterms:W3CDTF"[^>]*>([^<]*)<\/dcterms:created>/i,
      );
      const modifiedAltMatch = coreContent.match(
        /<dcterms:modified[^>]*xsi:type="dcterms:W3CDTF"[^>]*>([^<]*)<\/dcterms:modified>/i,
      );

      if (titleMatch && titleMatch[1].trim())
        metadata.title = titleMatch[1].trim();
      if (creatorMatch && creatorMatch[1].trim())
        metadata.author = creatorMatch[1].trim();
      if (subjectMatch && subjectMatch[1].trim())
        metadata.subject = subjectMatch[1].trim();
      if (keywordsMatch && keywordsMatch[1].trim())
        metadata.keywords = keywordsMatch[1].trim();

      // Procesar fechas (pueden venir en formato ISO 8601)
      const createdDate = createdAltMatch?.[1] || createdMatch?.[1];
      if (createdDate) {
        // Las fechas pueden venir como "2023-01-01T00:00:00Z" o similar
        metadata.creationDate = safeDateToISO(createdDate.trim());
      }

      const modifiedDate = modifiedAltMatch?.[1] || modifiedMatch?.[1];
      if (modifiedDate) {
        metadata.modificationDate = safeDateToISO(modifiedDate.trim());
      }
    }

    // Leer docProps/app.xml (información de la aplicación)
    const appXml = zip.file("docProps/app.xml");
    if (appXml) {
      const appContent = await appXml.async("string");
      const applicationMatch = appContent.match(
        /<Application[^>]*>([^<]*)<\/Application>/i,
      );
      const pagesMatch = appContent.match(/<Pages[^>]*>([^<]*)<\/Pages>/i);
      const wordsMatch = appContent.match(/<Words[^>]*>([^<]*)<\/Words>/i);
      const charactersMatch = appContent.match(
        /<Characters[^>]*>([^<]*)<\/Characters>/i,
      );

      if (applicationMatch) metadata.application = applicationMatch[1].trim();
      if (pagesMatch)
        metadata.totalPages = parseInt(pagesMatch[1].trim()) || null;
      if (wordsMatch)
        metadata.wordCount = parseInt(wordsMatch[1].trim()) || null;
      if (charactersMatch)
        metadata.characterCount = parseInt(charactersMatch[1].trim()) || null;
    }

    return filterNullUndefined(metadata);
  } catch (error) {
    console.error("Error al extraer metadatos del DOCX:", error);
    return null;
  }
}

// Extraer el contenido del DOC/DOCX
async function extractDocContent(url) {
  try {
    // Descargar el archivo como arraybuffer
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(response.data);
    const docType = detectDocType(buffer);

    // Intentar con mammoth primero (solo funciona con DOCX)
    if (docType === "docx") {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const metadata = await extractDocxMetadata(buffer);

        return {
          text: result?.value || null,
          metadata: {
            Autor: metadata?.author || "N/A",
            Asunto: metadata?.subject || "N/A",
            "Palabras Claves": metadata?.keywords || "N/A",
            "Fecha de Creación": metadata?.creationDate || "N/A",
            "Fecha de Modificación": metadata?.modificationDate || "N/A",
            "Total de Páginas": metadata?.totalPages || "N/A",
            "Total de Palabras": metadata?.wordCount || "N/A",
            "Total de Caracteres": metadata?.characterCount || "N/A",
          },
        };
      } catch (mammothError) {
        console.error(
          "Error con mammoth, intentando con officeparser:",
          mammothError.message,
        );
        // Si falla mammoth, intentar con officeparser como fallback
        try {
          const text = await officeParser.parseOfficeAsync(buffer);
          // Intentar extraer metadatos aunque officeparser no los devuelva directamente
          const metadata = await extractDocxMetadata(buffer);

          return {
            text: text || null,
            metadata: metadata,
          };
        } catch (officeParserError) {
          console.error(
            "Error con officeparser también:",
            officeParserError.message,
          );
          return {
            text: null,
            metadata: null,
            error:
              "No se pudo extraer el contenido del archivo. El archivo puede estar corrupto o en un formato no soportado.",
          };
        }
      }
    }

    return {
      text: null,
      metadata: null,
      error: "Formato de archivo no reconocido o corrupto",
    };
  } catch (error) {
    console.error("Error al extraer contenido del documento:", error);
    return {
      text: null,
      metadata: null,
      error: error.message || "Error desconocido al procesar el archivo",
    };
  }
}

// Dividir el texto en fragmentos para embeddings
function splitTextForEmbeddings(
  text,
  {
    chunkSize = 3000, // caracteres
    chunkOverlap = 600, // overlap
    separators = ["\n\n", "\n", ". ", " ", ""],
  } = {},
) {
  function recursiveSplit(text, separatorsIndex) {
    const separator = separators[separatorsIndex];

    // última opción: cortar fijo
    if (!separator) {
      return fixedSplit(text);
    }

    let parts = text.split(separator);

    // si no es necesario dividir: devolvemos tal cual
    if (parts.length === 1) {
      return recursiveSplit(text, separatorsIndex + 1);
    }

    let chunks = [];
    let current = "";

    for (let part of parts) {
      let candidate = current ? current + separator + part : part;

      if (candidate.length > chunkSize) {
        if (current) {
          chunks.push(current);
        }
        current = part;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);

    // si un chunk todavía es muy grande, dividirlo más con el siguiente separador
    let finalChunks = [];
    for (let c of chunks) {
      if (c.length > chunkSize) {
        finalChunks.push(...recursiveSplit(c, separatorsIndex + 1));
      } else {
        finalChunks.push(c.trim());
      }
    }

    return finalChunks;
  }

  // fallback: división dura con overlap
  function fixedSplit(t) {
    let result = [];
    let start = 0;

    while (start < t.length) {
      let end = Math.min(start + chunkSize, t.length);
      result.push(t.slice(start, end).trim());
      start = end - chunkOverlap;
      if (start < 0) start = 0;
    }

    return result;
  }

  return recursiveSplit(text, 0);
}

// Crear embeddings para los fragmentos
async function createEmbeddingsForFragments(fragments = [], tenantId, fileUrl) {
  try {
    console.log(`Creating embeddings for ${fragments.length} fragments`);
    for (const fragment of fragments) {
      const referenceId = crypto.randomUUID();
      console.log("Creating embedding for fragment", referenceId);
      await createEmbedding(tenantId, fragment, "file", referenceId, {
        fileUrl,
      });
      console.log("Embedding created for fragment", referenceId);
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

// Eliminar embeddings para los archivos
async function deleteEmbeddingsForFiles(tenantId, fileUrls = []) {
  try {
    for (const fileUrl of fileUrls) {
      console.log("Eliminando embeddings para el archivo:", fileUrl);
      await deleteEmbeddingsByParams(tenantId, {
        fileUrl: fileUrl,
        type: "file",
      });
      console.log("Embeddings eliminados para el archivo:", fileUrl);
    }
    console.log("Embeddings eliminados para los archivos:", fileUrls);
    return true;
  } catch (error) {
    console.log("Error al eliminar embeddings para los archivos:", error);
    return false;
  }
}

module.exports = {
  extractFileContent,
  splitTextForEmbeddings,
  createEmbeddingsForFragments,
  deleteEmbeddingsForFiles,
};
