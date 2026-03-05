const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { KBIndexer } = require("../utils/KnowledgeBase/indexer");
const { scanDirectories } = require("../utils/KnowledgeBase/scanner");
const { KBWatcher } = require("../utils/KnowledgeBase/watcher");
const {
  processBatch,
  processFile,
} = require("../utils/KnowledgeBase/processor");
const { embedCategory } = require("../utils/KnowledgeBase/embedder");
const { search } = require("../utils/KnowledgeBase/searcher");
const {
  renameFile,
  moveFile,
  rollbackOperation,
} = require("../utils/KnowledgeBase/fileOps");
const { reqBody } = require("../utils/http");

// In-memory job tracking for SSE progress
const activeJobs = new Map();

function knowledgeBaseEndpoints(app) {
  if (!app) return;

  // ─── Config ──────────────────────────────────────────────────────────────
  app.get("/knowledge-base/config", [validatedRequest], async (req, res) => {
    try {
      const config = await KBIndexer.getAllConfig();
      res.json({ success: true, config });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post(
    "/knowledge-base/config",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { storage_dir, watch_dir, auto_scan_interval } = reqBody(req);
        if (storage_dir !== undefined)
          await KBIndexer.setConfig("storage_dir", storage_dir);
        if (watch_dir !== undefined)
          await KBIndexer.setConfig("watch_dir", watch_dir);
        if (auto_scan_interval !== undefined)
          await KBIndexer.setConfig("auto_scan_interval", auto_scan_interval);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Watcher ──────────────────────────────────────────────────────────────
  app.post(
    "/knowledge-base/watcher/start",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        await KBWatcher.start();
        const status = KBWatcher.getStatus();
        res.json({ success: true, status });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/watcher/stop",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        await KBWatcher.stop();
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/watcher/restart",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        await KBWatcher.restart();
        const status = KBWatcher.getStatus();
        res.json({ success: true, status });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.get(
    "/knowledge-base/watcher/status",
    [validatedRequest],
    async (req, res) => {
      try {
        const status = KBWatcher.getStatus();
        res.json({ success: true, status });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Stats ────────────────────────────────────────────────────────────────
  app.get("/knowledge-base/stats", [validatedRequest], async (req, res) => {
    try {
      const stats = await KBIndexer.getStats();
      res.json({ success: true, stats });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── Files ────────────────────────────────────────────────────────────────
  app.get("/knowledge-base/files", [validatedRequest], async (req, res) => {
    try {
      const { page = 1, limit = 50, status, category } = req.query;
      const result = await KBIndexer.getAllFiles({
        page: Number(page),
        limit: Number(limit),
        status,
        category,
      });
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── Categories ───────────────────────────────────────────────────────────
  app.get(
    "/knowledge-base/categories",
    [validatedRequest],
    async (req, res) => {
      try {
        const categories = await KBIndexer.getCategories();
        res.json({ success: true, categories });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/categories/rename",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { old_name, new_name } = reqBody(req);
        await KBIndexer.renameCategory(old_name, new_name);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/categories/merge",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { source, target } = reqBody(req);
        await KBIndexer.mergeCategories(source, target);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/files/:id/move-category",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { category, sub_category } = reqBody(req);
        await KBIndexer.moveFileToCategory(
          req.params.id,
          category,
          sub_category
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Scan (SSE) ───────────────────────────────────────────────────────────
  app.post(
    "/knowledge-base/scan",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const config = await KBIndexer.getAllConfig();
        const dirs = [config.storage_dir, config.watch_dir].filter(Boolean);
        if (!dirs.length)
          return res
            .status(400)
            .json({ success: false, error: "No directories configured" });

        // SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        const result = await scanDirectories(
          dirs,
          (current, total, filePath) => {
            send({ type: "progress", current, total, file: filePath });
          }
        );

        send({ type: "complete", ...result });
        res.end();
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Process / Classify (SSE) ─────────────────────────────────────────────
  app.post(
    "/knowledge-base/process",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { file_ids } = reqBody(req);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        const result = await processBatch(
          file_ids || [],
          (current, total, fileName, fileResult) => {
            send({
              type: "progress",
              current,
              total,
              file: fileName,
              success: fileResult.success,
            });
          }
        );

        send({ type: "complete", ...result });
        res.end();
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Embed (SSE) ──────────────────────────────────────────────────────────
  app.post(
    "/knowledge-base/embed",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { category } = reqBody(req); // null = embed all

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        const result = await embedCategory(
          category || null,
          (current, total, fileName) => {
            send({ type: "progress", current, total, file: fileName });
          }
        );

        send({ type: "complete", ...result });
        res.end();
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  // ─── Search ───────────────────────────────────────────────────────────────
  app.post("/knowledge-base/search", [validatedRequest], async (req, res) => {
    try {
      const { query, category, mode = "both", limit = 20 } = reqBody(req);
      if (!query)
        return res
          .status(400)
          .json({ success: false, error: "query is required" });
      const results = await search(query, {
        category,
        mode,
        limit: Number(limit),
      });
      res.json({ success: true, results });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── File Operations ──────────────────────────────────────────────────────
  app.post(
    "/knowledge-base/files/:id/rename",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { new_name } = reqBody(req);
        const result = await renameFile(req.params.id, new_name);
        res.json({ success: true, ...result });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/files/:id/move",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const { target_dir } = reqBody(req);
        const result = await moveFile(req.params.id, target_dir);
        res.json({ success: true, ...result });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.get(
    "/knowledge-base/operations",
    [validatedRequest],
    async (req, res) => {
      try {
        const ops = await KBIndexer.getOperations(50);
        res.json({ success: true, operations: ops });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post(
    "/knowledge-base/operations/:id/rollback",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (req, res) => {
      try {
        const result = await rollbackOperation(req.params.id);
        res.json({ success: true, ...result });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );
}

module.exports = { knowledgeBaseEndpoints };
