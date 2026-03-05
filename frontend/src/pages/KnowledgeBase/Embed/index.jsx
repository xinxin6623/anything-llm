import React, { useEffect, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import { Spinner, X, Play } from "@phosphor-icons/react";

export default function KnowledgeBaseEmbed() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(""); // empty = all
  const [embedding, setEmbedding] = useState(false);
  const [progressLines, setProgressLines] = useState([]);
  const [stats, setStats] = useState(null);
  const progressRef = React.useRef(null);

  useEffect(() => {
    KnowledgeBase.getCategories().then(({ success, categories: cats }) => {
      if (success) setCategories(cats || []);
    });
    KnowledgeBase.getStats().then(({ success, stats: s }) => {
      if (success) setStats(s);
    });
  }, []);

  // Auto-scroll progress
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [progressLines]);

  const handleEmbed = async () => {
    setEmbedding(true);
    setProgressLines([]);

    const category = selectedCategory || null;
    const label = category ? `"${category}"` : "全部分类";
    addLine(`开始向量化 ${label}...`);

    await KnowledgeBase.embed(
      category,
      (data) => {
        if (data.type === "progress") {
          addLine(`[${data.current}/${data.total}] ${data.file || ""}`);
        }
      },
      (data) => {
        addLine(
          `✓ 完成：成功 ${data.done} 个，失败 ${data.errors?.length ?? 0} 个`
        );
        setEmbedding(false);
        // Refresh stats
        KnowledgeBase.getStats().then(({ success, stats: s }) => {
          if (success) setStats(s);
        });
        showToast(`向量化完成：${data.done} 个文件`, "success");
      }
    );
  };

  const addLine = (text) => {
    setProgressLines((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        text,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

  return (
    <KBLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">向量化管理</h2>
          <p className="text-white/50 text-sm mt-1">
            将已分类的文件嵌入向量数据库，启用语义搜索
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{stats.total ?? 0}</p>
              <p className="text-xs text-white/40">总文件</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-400">
                {stats.embedded ?? 0}
              </p>
              <p className="text-xs text-white/40">已向量化</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-yellow-400">
                {stats.indexed ?? 0}
              </p>
              <p className="text-xs text-white/40">待向量化（已分类）</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white/5 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-white mb-3">
            选择向量化范围
          </h3>
          <div className="flex items-center gap-x-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={embedding}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count} 个文件)
                </option>
              ))}
            </select>
            <button
              onClick={handleEmbed}
              disabled={embedding}
              className="flex items-center gap-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            >
              {embedding ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {embedding ? "向量化中..." : "开始向量化"}
            </button>
          </div>
          <p className="text-xs text-white/30 mt-2">
            每个分类会创建一个独立的 AnythingLLM Workspace 用于存储向量数据
          </p>
        </div>

        {/* Progress log */}
        {progressLines.length > 0 && (
          <div className="bg-black/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                进度日志
              </h3>
              <button
                onClick={() => setProgressLines([])}
                className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div
              ref={progressRef}
              className="space-y-1 max-h-64 overflow-y-auto text-xs font-mono"
            >
              {progressLines.map((line) => (
                <div key={line.id} className="flex items-start gap-x-2">
                  <span className="text-white/20 flex-shrink-0">
                    {line.time}
                  </span>
                  <span
                    className={
                      line.text.startsWith("✓")
                        ? "text-green-400"
                        : "text-white/70"
                    }
                  >
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </KBLayout>
  );
}
