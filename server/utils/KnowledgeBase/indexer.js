const { prisma } = require("./db");

const KBIndexer = {
  // ─── Config (via system_settings) ────────────────────────────────────────
  async getConfig(key) {
    const row = await prisma.system_settings.findUnique({
      where: { label: `kb_${key}` },
    });
    return row ? row.value : null;
  },

  async setConfig(key, value) {
    await prisma.system_settings.upsert({
      where: { label: `kb_${key}` },
      update: { value: String(value), lastUpdatedAt: new Date() },
      create: { label: `kb_${key}`, value: String(value) },
    });
  },

  async getAllConfig() {
    const rows = await prisma.system_settings.findMany({
      where: { label: { startsWith: "kb_" } },
    });
    return rows.reduce(
      (acc, r) => ({ ...acc, [r.label.replace("kb_", "")]: r.value }),
      {}
    );
  },

  // ─── File CRUD ────────────────────────────────────────────────────────────
  async upsertFile(data) {
    const existing = await prisma.kb_files.findUnique({
      where: { file_path: data.file_path },
    });
    if (existing) {
      await prisma.kb_files.update({
        where: { file_path: data.file_path },
        data: {
          file_hash: data.file_hash,
          file_name: data.file_name,
          file_type: data.file_type,
          file_size: data.file_size,
          status: "pending",
          error_msg: null,
          lastUpdatedAt: new Date(),
        },
      });
      return existing.id;
    } else {
      const created = await prisma.kb_files.create({
        data: {
          file_path: data.file_path,
          file_hash: data.file_hash,
          file_name: data.file_name,
          file_type: data.file_type,
          file_size: data.file_size,
          status: "pending",
        },
      });
      return created.id;
    }
  },

  async updateFileStatus(id, status, extra = {}) {
    const data = { status, lastUpdatedAt: new Date() };
    if (extra.error_msg !== undefined) data.error_msg = extra.error_msg;
    if (extra.category !== undefined) data.category = extra.category;
    if (extra.sub_category !== undefined)
      data.sub_category = extra.sub_category;
    if (extra.summary !== undefined) data.summary = extra.summary;
    if (extra.keywords !== undefined)
      data.keywords = JSON.stringify(extra.keywords);
    if (extra.doc_location !== undefined)
      data.doc_location = extra.doc_location;
    if (extra.workspace_slug !== undefined)
      data.workspace_slug = extra.workspace_slug;
    if (status === "indexed") data.indexed_at = new Date();
    if (status === "embedded") data.embedded_at = new Date();
    await prisma.kb_files.update({ where: { id }, data });
  },

  async getFileByPath(filePath) {
    const row = await prisma.kb_files.findUnique({
      where: { file_path: filePath },
    });
    if (!row) return null;
    return { ...row, keywords: JSON.parse(row.keywords || "[]") };
  },

  async getFileById(id) {
    const row = await prisma.kb_files.findUnique({ where: { id } });
    if (!row) return null;
    return { ...row, keywords: JSON.parse(row.keywords || "[]") };
  },

  async getFilesByStatus(status) {
    const rows = await prisma.kb_files.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      ...r,
      keywords: JSON.parse(r.keywords || "[]"),
    }));
  },

  async getFilesByCategory(category) {
    const rows = await prisma.kb_files.findMany({
      where: { category },
      orderBy: { indexed_at: "desc" },
    });
    return rows.map((r) => ({
      ...r,
      keywords: JSON.parse(r.keywords || "[]"),
    }));
  },

  async getAllFiles({
    page = 1,
    limit = 50,
    status = null,
    category = null,
  } = {}) {
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    const [rows, total] = await Promise.all([
      prisma.kb_files.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.kb_files.count({ where }),
    ]);
    return {
      files: rows.map((r) => ({
        ...r,
        keywords: JSON.parse(r.keywords || "[]"),
      })),
      total,
      page,
      limit,
    };
  },

  async getCategories() {
    const rows = await prisma.kb_files.findMany({
      where: { category: { not: null } },
      select: { category: true, sub_category: true },
    });
    // Roll up by top-level category, collect sub_categories
    const map = {};
    for (const r of rows) {
      if (!map[r.category])
        map[r.category] = {
          category: r.category,
          count: 0,
          sub_categories: new Set(),
        };
      map[r.category].count++;
      if (r.sub_category) map[r.category].sub_categories.add(r.sub_category);
    }
    return Object.values(map)
      .map((c) => ({ ...c, sub_categories: [...c.sub_categories] }))
      .sort((a, b) => a.category.localeCompare(b.category));
  },

  async renameCategory(oldName, newName) {
    await prisma.kb_files.updateMany({
      where: { category: oldName },
      data: { category: newName },
    });
  },

  async mergeCategories(sourceCategory, targetCategory) {
    await prisma.kb_files.updateMany({
      where: { category: sourceCategory },
      data: { category: targetCategory },
    });
  },

  async moveFileToCategory(fileId, category, subCategory = null) {
    await prisma.kb_files.update({
      where: { id: fileId },
      data: { category, sub_category: subCategory },
    });
  },

  async deleteFile(fileId) {
    await prisma.kb_files.delete({
      where: { id: fileId },
    });
  },

  async getStats() {
    const [total, pending, processing, indexed, embedded, error] =
      await Promise.all([
        prisma.kb_files.count(),
        prisma.kb_files.count({ where: { status: "pending" } }),
        prisma.kb_files.count({ where: { status: "processing" } }),
        prisma.kb_files.count({ where: { status: "indexed" } }),
        prisma.kb_files.count({ where: { status: "embedded" } }),
        prisma.kb_files.count({ where: { status: "error" } }),
      ]);
    return { total, pending, processing, indexed, embedded, error };
  },

  // ─── Operation log ────────────────────────────────────────────────────────
  async logOperation(operation, fileId, oldValue, newValue) {
    await prisma.kb_operations.create({
      data: {
        operation,
        file_id: fileId,
        old_value: JSON.stringify(oldValue),
        new_value: JSON.stringify(newValue),
      },
    });
  },

  async getOperations(limit = 50) {
    const rows = await prisma.kb_operations.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      ...r,
      old_value: JSON.parse(r.old_value || "null"),
      new_value: JSON.parse(r.new_value || "null"),
    }));
  },
};

module.exports = { KBIndexer };
