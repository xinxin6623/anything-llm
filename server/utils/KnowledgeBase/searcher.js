const { prisma } = require("./db");
const { getVectorDbClass } = require("../helpers");
const { getEmbeddingEngineSelection } = require("../helpers");
const { Workspace } = require("../../models/workspace");

/**
 * Keyword search against the index database via Prisma
 */
async function keywordSearch(query, { category = null, limit = 20 } = {}) {
  const where = {
    AND: [
      {
        OR: [
          { summary: { contains: query } },
          { keywords: { contains: query } },
          { file_name: { contains: query } },
        ],
      },
    ],
  };
  if (category) where.AND.push({ category });

  const rows = await prisma.kb_files.findMany({
    where,
    take: limit,
    orderBy: { indexed_at: "desc" },
    select: {
      id: true,
      file_path: true,
      file_name: true,
      file_type: true,
      category: true,
      sub_category: true,
      summary: true,
      keywords: true,
      status: true,
      indexed_at: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    keywords: JSON.parse(r.keywords || "[]"),
    score: null,
    match_type: "keyword",
    snippet: highlightSnippet(r.summary, query),
  }));
}

/**
 * Semantic search via vector DB
 */
async function semanticSearch(query, { category = null, topN = 10 } = {}) {
  try {
    const VectorDb = getVectorDbClass();
    const Embedder = getEmbeddingEngineSelection();

    // Determine namespaces to search
    let namespaces = [];
    if (category) {
      namespaces = [`kb-${category.replace(/\s+/g, "-")}`];
    } else {
      // Search global kb workspace
      namespaces = ["kb-all"];
    }

    const results = [];
    for (const ns of namespaces) {
      const ws = await Workspace.get({ slug: ns });
      if (!ws) continue;
      const { contextTexts, sources } = await VectorDb.performSimilaritySearch({
        namespace: ns,
        input: query,
        LLMConnector: Embedder,
        similarityThreshold: 0.3,
        topN,
        filterIdentifiers: [],
      });
      sources.forEach((src, i) => {
        results.push({
          file_path: src.metadata?.source || src.chunkSource || "",
          file_name: src.title || "",
          snippet: contextTexts[i] || src.text || "",
          score: src.score || null,
          match_type: "semantic",
          category: src.metadata?.category || null,
        });
      });
    }
    return results;
  } catch (err) {
    console.error("[KBSearcher] Semantic search error:", err.message);
    return [];
  }
}

/**
 * Combined search: keyword + semantic, deduplicated by file_path
 */
async function search(
  query,
  { category = null, mode = "both", limit = 20 } = {}
) {
  let results = [];

  if (mode === "keyword" || mode === "both") {
    const kw = await keywordSearch(query, { category, limit });
    results = results.concat(kw);
  }
  if (mode === "semantic" || mode === "both") {
    const semantic = await semanticSearch(query, { category, topN: limit });
    results = results.concat(semantic);
  }

  // Deduplicate by file_path, prefer semantic score
  const seen = new Map();
  for (const r of results) {
    const key = r.file_path || r.file_name;
    if (!seen.has(key) || r.match_type === "semantic") {
      seen.set(key, r);
    }
  }

  return [...seen.values()].slice(0, limit);
}

function highlightSnippet(text, query) {
  if (!text || !query) return text || "";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "**$1**");
}

module.exports = { search, keywordSearch, semanticSearch };
