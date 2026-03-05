const path = require("path");
const fs = require("fs");
const { KBIndexer } = require("./indexer");
const { classifyDocument } = require("./classifier");
const { CollectorApi } = require("../collectorApi");

/**
 * Process a single pending file:
 *  1. Copy to collector hotdir
 *  2. Call collector to parse
 *  3. Call LLM to classify
 *  4. Update index
 */
async function processFile(fileId) {
  const file = await KBIndexer.getFileById(fileId);
  if (!file) throw new Error("File not found");

  await KBIndexer.updateFileStatus(fileId, "processing");

  const collector = new CollectorApi();
  const isOnline = await collector.online();
  if (!isOnline) {
    await KBIndexer.updateFileStatus(fileId, "error", {
      error_msg: "Collector service offline",
    });
    return { success: false, reason: "Collector offline" };
  }

  // Copy file to collector hotdir
  const hotdir = path.join(__dirname, "../../../collector/hotdir");
  fs.mkdirSync(hotdir, { recursive: true });
  const destFile = path.join(hotdir, path.basename(file.file_path));
  fs.copyFileSync(file.file_path, destFile);

  // Parse via collector
  const result = await collector.processDocument(
    path.basename(file.file_path),
    {
      title: file.file_name,
      docSource: `kb:${file.file_path}`,
      chunkSource: `kb-file://${file.file_path}`,
    }
  );

  if (!result || !result.success || !result.documents?.length) {
    await KBIndexer.updateFileStatus(fileId, "error", {
      error_msg: result?.reason || "Collector returned no documents",
    });
    return { success: false, reason: result?.reason };
  }

  const doc = result.documents[0];
  const content = doc.pageContent || "";

  // Classify via LLM
  const classification = await classifyDocument(content, file.file_name);

  await KBIndexer.updateFileStatus(fileId, "indexed", {
    category: classification.category,
    sub_category: classification.sub_category,
    summary: classification.summary,
    keywords: classification.keywords,
    doc_location: doc.location || doc.filename || "",
  });

  return { success: true, classification, doc_location: doc.location };
}

/**
 * Process a batch of pending files with SSE progress
 * @param {string[]} fileIds - if empty, process all pending
 * @param {function} onProgress - (current, total, fileName, result) => void
 */
async function processBatch(fileIds = [], onProgress = null) {
  const files = fileIds.length
    ? await Promise.all(fileIds.map((id) => KBIndexer.getFileById(id)))
    : await KBIndexer.getFilesByStatus("pending");

  const total = files.filter(Boolean).length;
  let done = 0;
  const errors = [];

  for (const file of files) {
    if (!file) continue;
    try {
      const result = await processFile(file.id);
      done++;
      if (!result.success)
        errors.push({ file: file.file_name, reason: result.reason });
      if (onProgress) onProgress(done, total, file.file_name, result);
    } catch (err) {
      await KBIndexer.updateFileStatus(file.id, "error", {
        error_msg: err.message,
      });
      errors.push({ file: file.file_name, reason: err.message });
      if (onProgress)
        onProgress(done, total, file.file_name, {
          success: false,
          reason: err.message,
        });
    }
  }

  return { done, total, errors };
}

module.exports = { processFile, processBatch };
