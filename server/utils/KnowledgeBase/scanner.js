const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { KBIndexer } = require("./indexer");

// File extensions supported by AnythingLLM collector
const SUPPORTED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".org",
  ".adoc",
  ".rst",
  ".csv",
  ".json",
  ".html",
  ".pdf",
  ".docx",
  ".pptx",
  ".odt",
  ".xlsx",
  ".epub",
  ".mbox",
  ".mp3",
  ".wav",
  ".mp4",
  ".mpeg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

function hashFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(buf).digest("hex");
  } catch {
    return null;
  }
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Scan directories and queue new/changed files for processing.
 * @param {string[]} dirs - Directories to scan
 * @param {function} onProgress - Optional callback(current, total, filePath)
 * @returns {{ added: number, updated: number, skipped: number, total: number }}
 */
async function scanDirectories(dirs, onProgress = null) {
  const allFiles = [];
  for (const dir of dirs) {
    walkDir(dir, allFiles);
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < uniqueFiles.length; i++) {
    const filePath = uniqueFiles[i];
    if (onProgress) onProgress(i + 1, uniqueFiles.length, filePath);

    try {
      const stat = fs.statSync(filePath);
      const hash = hashFile(filePath);
      if (!hash) continue;

      const existing = await KBIndexer.getFileByPath(filePath);

      if (
        existing &&
        existing.file_hash === hash &&
        existing.status !== "error"
      ) {
        skipped++;
        continue;
      }

      await KBIndexer.upsertFile({
        file_path: filePath,
        file_hash: hash,
        file_name: path.basename(filePath),
        file_type: path.extname(filePath).toLowerCase().replace(".", ""),
        file_size: stat.size,
      });
      if (existing) updated++;
      else added++;
    } catch (err) {
      console.error(`[KBScanner] Error processing ${filePath}:`, err.message);
    }
  }

  return { added, updated, skipped, total: uniqueFiles.length };
}

module.exports = { scanDirectories, SUPPORTED_EXTENSIONS };
