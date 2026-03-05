import React, { useEffect, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import { PencilSimple, GitMerge, Files, X, Check } from "@phosphor-icons/react";

export default function KnowledgeBaseCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(null); // { name, newName }
  const [merging, setMerging] = useState(null); // { source }
  const [mergeTarget, setMergeTarget] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    const { success, categories: cats } = await KnowledgeBase.getCategories();
    if (success) setCategories(cats || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleRename = async () => {
    if (!renaming || !renaming.newName.trim()) return;
    const { success, error } = await KnowledgeBase.renameCategory(
      renaming.name,
      renaming.newName.trim()
    );
    if (success) {
      showToast("分类已重命名", "success");
      setRenaming(null);
      fetchCategories();
    } else {
      showToast(error || "重命名失败", "error");
    }
  };

  const handleMerge = async () => {
    if (!merging || !mergeTarget) return;
    if (merging.source === mergeTarget) {
      showToast("源分类和目标分类不能相同", "error");
      return;
    }
    const { success, error } = await KnowledgeBase.mergeCategories(
      merging.source,
      mergeTarget
    );
    if (success) {
      showToast(`已将 "${merging.source}" 合并到 "${mergeTarget}"`, "success");
      setMerging(null);
      setMergeTarget("");
      fetchCategories();
    } else {
      showToast(error || "合并失败", "error");
    }
  };

  return (
    <KBLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">分类管理</h2>
          <p className="text-white/50 text-sm mt-1">
            LLM 自动分类后的结果，可以重命名或合并分类
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-white/5 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            暂无分类数据。请先在文件列表页扫描并运行 AI 分类。
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.category}
                className="bg-white/5 rounded-xl px-4 py-3 flex items-center gap-x-3"
              >
                {renaming?.name === cat.category ? (
                  /* Inline rename */
                  <div className="flex-1 flex items-center gap-x-2">
                    <input
                      autoFocus
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      value={renaming.newName}
                      onChange={(e) =>
                        setRenaming((r) => ({ ...r, newName: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                    />
                    <button
                      onClick={handleRename}
                      className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setRenaming(null)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : merging?.source === cat.category ? (
                  /* Inline merge */
                  <div className="flex-1 flex items-center gap-x-2">
                    <span className="text-sm text-white/50 flex-shrink-0">
                      合并 "{cat.category}" 到:
                    </span>
                    <select
                      autoFocus
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                    >
                      <option value="">选择目标分类...</option>
                      {categories
                        .filter((c) => c.category !== cat.category)
                        .map((c) => (
                          <option key={c.category} value={c.category}>
                            {c.category} ({c.count})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleMerge}
                      disabled={!mergeTarget}
                      className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-30 text-blue-400 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setMerging(null);
                        setMergeTarget("");
                      }}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  /* Normal display */
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {cat.category}
                      </p>
                      {cat.sub_categories?.length > 0 && (
                        <p className="text-xs text-white/40 truncate">
                          子分类: {cat.sub_categories.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="flex items-center gap-x-1 text-xs text-white/40 flex-shrink-0">
                      <Files className="h-3 w-3" />
                      {cat.count}
                    </span>
                    <button
                      onClick={() =>
                        setRenaming({
                          name: cat.category,
                          newName: cat.category,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                      title="重命名"
                    >
                      <PencilSimple className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMerging({ source: cat.category })}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                      title="合并到其他分类"
                    >
                      <GitMerge className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </KBLayout>
  );
}
