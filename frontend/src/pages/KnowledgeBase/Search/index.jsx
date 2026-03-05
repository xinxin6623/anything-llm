import React, { useEffect, useRef, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import {
  MagnifyingGlass,
  Spinner,
  FileText,
  FolderSimple,
} from "@phosphor-icons/react";

const MODES = [
  { value: "both", label: "混合（推荐）" },
  { value: "semantic", label: "语义搜索" },
  { value: "keyword", label: "关键词搜索" },
];

export default function KnowledgeBaseSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("both");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(20);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    KnowledgeBase.getCategories().then(({ success, categories: cats }) => {
      if (success) setCategories(cats || []);
    });
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults(null);
    const {
      success,
      results: res,
      error,
    } = await KnowledgeBase.search(query.trim(), {
      category: category || undefined,
      mode,
      limit,
    });
    setSearching(false);
    if (success) {
      setResults(res || []);
    } else {
      showToast(error || "搜索失败", "error");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <KBLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">智能搜索</h2>
          <p className="text-white/50 text-sm mt-1">
            使用自然语言或关键词搜索知识库内容，返回内容片段和源文件路径
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入搜索内容，例如：关于项目管理的文档"
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-11 pr-32 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {searching ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <MagnifyingGlass className="h-4 w-4" />
              )}
              搜索
            </button>
          </div>
        </form>

        {/* Search options */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-6">
          <div className="flex items-center gap-x-2">
            <label className="text-xs text-white/40">搜索模式</label>
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    mode === m.value
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-x-2">
            <label className="text-xs text-white/40">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-x-2">
            <label className="text-xs text-white/40">结果数</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {searching && (
          <div className="flex items-center justify-center py-16 gap-x-2 text-white/50">
            <Spinner className="h-5 w-5 animate-spin" />
            <span className="text-sm">搜索中...</span>
          </div>
        )}

        {!searching && results !== null && (
          <>
            <p className="text-xs text-white/40 mb-3">
              找到 {results.length} 条结果
            </p>
            {results.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                没有找到相关内容
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r, i) => (
                  <SearchResult key={i} result={r} />
                ))}
              </div>
            )}
          </>
        )}

        {!searching && results === null && (
          <div className="text-center py-20 text-white/20 text-sm">
            输入关键词开始搜索
          </div>
        )}
      </div>
    </KBLayout>
  );
}

function SearchResult({ result }) {
  const [expanded, setExpanded] = useState(false);
  const snippet = result.snippet || result.summary || "";
  const isLong = snippet.length > 200;

  return (
    <div className="bg-white/5 hover:bg-white/8 rounded-xl p-4 transition-colors">
      <div className="flex items-start justify-between gap-x-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 mb-1">
            <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <p className="text-sm font-medium text-white truncate">
              {result.file_name}
            </p>
            {result.score !== undefined && (
              <span className="text-xs text-white/30 flex-shrink-0">
                {(result.score * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-x-2 text-xs text-white/40">
            <FolderSimple className="h-3 w-3 flex-shrink-0" />
            <span className="truncate" title={result.file_path}>
              {result.file_path}
            </span>
          </div>
        </div>
        {result.category && (
          <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
            {result.category}
          </span>
        )}
      </div>

      {snippet && (
        <div className="mt-2">
          <p
            className={`text-xs text-white/60 leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}
          >
            {snippet}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
            >
              {expanded ? "收起" : "展开全文"}
            </button>
          )}
        </div>
      )}

      {result.keywords && result.keywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(typeof result.keywords === "string"
            ? JSON.parse(result.keywords)
            : result.keywords
          )
            .slice(0, 5)
            .map((kw, i) => (
              <span
                key={i}
                className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded"
              >
                {kw}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
