const { KBIndexer } = require("./indexer");
const { Workspace } = require("../../models/workspace");
const { Document } = require("../../models/documents");

const ALL_WORKSPACE_NAME = "知识库-全库";
const ALL_WORKSPACE_SLUG = "kb-all";

/**
 * Ensure a workspace exists for a given category, return workspace object
 */
async function ensureWorkspace(name, slug) {
  let ws = await Workspace.get({ slug });
  if (!ws) {
    ws = await Workspace.new(name);
  }
  return ws;
}

/**
 * Embed all indexed files in a category into the corresponding workspace.
 * @param {string|null} category - null means embed ALL indexed files into 全库
 * @param {function} onProgress - callback(current, total, fileName)
 */
async function embedCategory(category = null, onProgress = null) {
  const files = category
    ? await KBIndexer.getFilesByCategory(category)
    : await KBIndexer.getFilesByStatus("indexed");

  const wsName = category ? `知识库-${category}` : ALL_WORKSPACE_NAME;
  const wsSlug = category
    ? `kb-${category.replace(/\s+/g, "-").toLowerCase()}`
    : ALL_WORKSPACE_SLUG;

  const workspace = await ensureWorkspace(wsName, wsSlug);
  if (!workspace) {
    throw new Error(`Failed to create workspace: ${wsName}`);
  }

  const total = files.length;
  let done = 0;
  const errors = [];

  for (const file of files) {
    if (!file.doc_location) {
      errors.push({
        file: file.file_name,
        reason: "No doc_location — run Process/Classify first",
      });
      done++;
      if (onProgress) onProgress(done, total, file.file_name);
      continue;
    }
    try {
      // doc_location is the relative path inside the documents storage folder
      const { failedToEmbed = [] } = await Document.addDocuments(workspace, [
        file.doc_location,
      ]);
      if (failedToEmbed.length > 0) {
        throw new Error(`Failed to embed: ${failedToEmbed.join(", ")}`);
      }
      await KBIndexer.updateFileStatus(file.id, "embedded", {
        workspace_slug: wsSlug,
      });
      done++;
    } catch (err) {
      await KBIndexer.updateFileStatus(file.id, "error", {
        error_msg: err.message,
      });
      errors.push({ file: file.file_name, reason: err.message });
      done++;
    }
    if (onProgress) onProgress(done, total, file.file_name);
  }

  return { done, total, errors, workspace_slug: wsSlug };
}

module.exports = { embedCategory, ALL_WORKSPACE_SLUG, ALL_WORKSPACE_NAME };
