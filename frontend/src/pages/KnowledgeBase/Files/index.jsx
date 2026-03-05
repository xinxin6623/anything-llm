import React, { useCallback, useEffect, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import {
  ArrowClockwise,
  Play,
  FunnelSimple,
  Spinner,
  X,
} from "@phosphor-icons/react";

const STATUS_LABELS = {
  pending: { label: "待处理", color: "text-yellow-400 bg-yellow-400/10" },
  processing: { label: "处理中", color: "text-blue-400 bg-blue-400/10" },
  indexed: { label: "已分类", color: "text-green-400 bg-green-400/10" },
  embedded: { label: "已向量化", color: "text-purple-400 bg-purple-400/10" },
  error: { label: "失败", color: "text-red-400 bg-red-400/10" },
};

export default function KnowledgeBaseFiles() {
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const limit = 50;

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const result = await KnowledgeBase.getFiles({
      page,
      limit,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
    });
    if (result.success) {
      setFiles(result.files || []);
      setTotal(result.total || 0);
    }
    setLoading(false);
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    KnowledgeBase.getCategories().then(({ success, categories: cats }) => {
      if (success) setCategories(cats || []);
    });
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setProgressMsg("开始扫描目录...");
    await KnowledgeBase.scan(
      (data) => {
        if (data.type === "progress") {
          setProgressMsg(
            `扫描中 ${data.current}/${data.total}: ${data.file || ""}`
          );
        }
      },
      (data) => {
        setProgressMsg(
          `扫描完成：新增 ${data.added ?? 0} 个，更新 ${data.updated ?? 0} 个，跳过 ${data.skipped ?? 0} 个`
        );
        setScanning(false);
        fetchFiles();
        showToast(
          `扫描完成：发现 ${(data.added ?? 0) + (data.updated ?? 0)} 个文件变更`,
          "success"
        );
      }
    );
  };

  const handleProcess = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : [];
    setProcessing(true);
    setProgressMsg("开始处理文件...");
    await KnowledgeBase.process(
      ids,
      (data) => {
        if (data.type === "progress") {
          setProgressMsg(
            `处理中 ${data.current}/${data.total}: ${data.file || ""} ${data.success ? "✓" : "✗"}`
          );
        }
      },
      (data) => {
        setProgressMsg(
          `处理完成：${data.done}/${data.total}，失败 ${data.errors?.length ?? 0} 个`
        );
        setProcessing(false);
        setSelectedIds([]);
        fetchFiles();
        showToast(`LLM 分类完成：${data.done} 个文件`, "success");
      }
    );
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map((f) => f.id));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <KBLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">文件列表</h2>
            <p className="text-white/50 text-sm mt-0.5">共 {total} 个文件</p>
          </div>
          <div className="flex items-center gap-x-2">
            <button
              onClick={handleScan}
              disabled={scanning || processing}
              className="flex items-center gap-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {scanning ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowClockwise className="h-4 w-4" />
              )}
              扫描目录
            </button>
            <button
              onClick={handleProcess}
              disabled={scanning || processing}
              className="flex items-center gap-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {processing ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {selectedIds.length > 0
                ? `AI 分类 (${selectedIds.length})`
                : "AI 分类全部待处理"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {(scanning || processing) && progressMsg && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-x-2">
            <Spinner className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-300 truncate">{progressMsg}</p>
          </div>
        )}
        {!scanning && !processing && progressMsg && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
            <p className="text-sm text-green-300">{progressMsg}</p>
            <button onClick={() => setProgressMsg("")}>
              <X className="h-4 w-4 text-green-400" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-x-3 mb-4">
          <div className="relative">
            <FunnelSimple className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <FunnelSimple className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select>
          </div>
          {selectedIds.length > 0 && (
            <span className="text-xs text-white/50">
              已选 {selectedIds.length} 个文件
            </span>
          )}
        </div>

        {/* Table */}
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      files.length > 0 && selectedIds.length === files.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-3 text-left text-white/50 font-medium">
                  文件名
                </th>
                <th className="px-3 py-3 text-left text-white/50 font-medium hidden md:table-cell">
                  分类
                </th>
                <th className="px-3 py-3 text-left text-white/50 font-medium">
                  状态
                </th>
                <th className="px-3 py-3 text-left text-white/50 font-medium hidden lg:table-cell">
                  摘要
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-white/30"
                  >
                    加载中...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-12 text-center text-white/30"
                  >
                    暂无文件，请先扫描目录
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      selectedIds.includes(file.id) ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(file.id)}
                        onChange={() => toggleSelect(file.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p
                        className="text-white font-medium truncate max-w-[200px]"
                        title={file.file_name}
                      >
                        {file.file_name}
                      </p>
                      <p
                        className="text-white/30 text-xs truncate max-w-[200px]"
                        title={file.file_path}
                      >
                        {file.file_path}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-white/70 text-xs">
                        {file.category || "—"}
                        {file.sub_category ? ` / ${file.sub_category}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={file.status} />
                      {file.error_msg && (
                        <p
                          className="text-xs text-red-400 mt-0.5 max-w-[120px] truncate"
                          title={file.error_msg}
                        >
                          {file.error_msg}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <p
                        className="text-white/40 text-xs truncate max-w-[200px]"
                        title={file.summary}
                      >
                        {file.summary || "—"}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-white/40">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </KBLayout>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || {
    label: status,
    color: "text-white/50 bg-white/10",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}
    >
      {s.label}
    </span>
  );
}
