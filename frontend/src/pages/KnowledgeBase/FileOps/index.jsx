import React, { useCallback, useEffect, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import {
  PencilSimple,
  FolderOpen,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Clock,
  Check,
  X,
  Files,
} from "@phosphor-icons/react";

export default function KnowledgeBaseFileOps() {
  const [tab, setTab] = useState("operations"); // 'operations' | 'rename' | 'move'
  const [operations, setOperations] = useState([]);
  const [loadingOps, setLoadingOps] = useState(true);

  // For inline rename/move
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [actionTarget, setActionTarget] = useState(null); // { file, type: 'rename'|'move' }
  const [actionValue, setActionValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchOperations = async () => {
    setLoadingOps(true);
    const { success, operations: ops } = await KnowledgeBase.getOperations();
    if (success) setOperations(ops || []);
    setLoadingOps(false);
  };

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    const { success, files: fs } = await KnowledgeBase.getFiles({ limit: 100 });
    if (success) setFiles(fs || []);
    setLoadingFiles(false);
  }, []);

  useEffect(() => {
    fetchOperations();
  }, []);

  useEffect(() => {
    if (tab === "rename" || tab === "move") {
      fetchFiles();
    }
  }, [tab, fetchFiles]);

  const handleRollback = async (id) => {
    const { success, error } = await KnowledgeBase.rollbackOperation(id);
    if (success) {
      showToast("操作已回滚", "success");
      fetchOperations();
    } else {
      showToast(error || "回滚失败", "error");
    }
  };

  const handleAction = async () => {
    if (!actionTarget || !actionValue.trim()) return;
    setSaving(true);
    let result;
    if (actionTarget.type === "rename") {
      result = await KnowledgeBase.renameFile(
        actionTarget.file.id,
        actionValue.trim()
      );
    } else {
      result = await KnowledgeBase.moveFile(
        actionTarget.file.id,
        actionValue.trim()
      );
    }
    setSaving(false);
    if (result.success) {
      showToast(
        actionTarget.type === "rename" ? "文件已重命名" : "文件已移动",
        "success"
      );
      setActionTarget(null);
      setActionValue("");
      fetchFiles();
      fetchOperations();
    } else {
      showToast(result.error || "操作失败", "error");
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      !search ||
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.file_path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <KBLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">文件操作</h2>
          <p className="text-white/50 text-sm mt-1">
            重命名、移动文件，以及查看和回滚历史操作
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-x-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {[
            { key: "operations", label: "操作历史", icon: Clock },
            { key: "rename", label: "重命名文件", icon: PencilSimple },
            { key: "move", label: "移动文件", icon: FolderOpen },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Operations History */}
        {tab === "operations" && (
          <div>
            {loadingOps ? (
              <div className="text-center py-8 text-white/30">加载中...</div>
            ) : operations.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                暂无操作历史
              </div>
            ) : (
              <div className="space-y-2">
                {operations.map((op) => (
                  <div
                    key={op.id}
                    className={`bg-white/5 rounded-xl px-4 py-3 flex items-center gap-x-3 ${
                      op.rolled_back ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2">
                        <span className="text-xs font-medium text-white/70 bg-white/10 px-1.5 py-0.5 rounded uppercase">
                          {op.operation}
                        </span>
                        {op.rolled_back ? (
                          <span className="text-xs text-white/30">已回滚</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-white/40 truncate">
                        {formatOpDetail(op)}
                      </div>
                      <p className="text-xs text-white/20 mt-0.5">
                        {new Date(op.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!op.rolled_back && (
                      <button
                        onClick={() => handleRollback(op.id)}
                        className="flex items-center gap-x-1 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition-colors flex-shrink-0"
                      >
                        <ArrowCounterClockwise className="h-3.5 w-3.5" />
                        回滚
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rename / Move File */}
        {(tab === "rename" || tab === "move") && (
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索文件名或路径..."
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {loadingFiles ? (
              <div className="text-center py-8 text-white/30">加载中...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">
                暂无文件
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white/5 rounded-xl px-4 py-2.5"
                  >
                    {actionTarget?.file.id === file.id ? (
                      /* Inline action editor */
                      <div className="flex items-center gap-x-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/40 truncate mb-1">
                            {file.file_path}
                          </p>
                          <input
                            autoFocus
                            value={actionValue}
                            onChange={(e) => setActionValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAction();
                              if (e.key === "Escape") {
                                setActionTarget(null);
                                setActionValue("");
                              }
                            }}
                            placeholder={
                              actionTarget.type === "rename"
                                ? "输入新文件名..."
                                : "输入目标目录路径..."
                            }
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <button
                          onClick={handleAction}
                          disabled={saving || !actionValue.trim()}
                          className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 disabled:opacity-30 text-green-400 transition-colors flex-shrink-0"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setActionTarget(null);
                            setActionValue("");
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 transition-colors flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-x-3">
                        <Files className="h-4 w-4 text-white/30 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {file.file_name}
                          </p>
                          <p className="text-xs text-white/30 truncate">
                            {file.file_path}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setActionTarget({ file, type: tab });
                            setActionValue(
                              tab === "rename" ? file.file_name : ""
                            );
                          }}
                          className="flex items-center gap-x-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white text-xs transition-colors flex-shrink-0"
                        >
                          {tab === "rename" ? (
                            <>
                              <PencilSimple className="h-3.5 w-3.5" />
                              重命名
                            </>
                          ) : (
                            <>
                              <FolderOpen className="h-3.5 w-3.5" />
                              移动
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </KBLayout>
  );
}

function formatOpDetail(op) {
  try {
    const old = op.old_value || {};
    const nw = op.new_value || {};
    if (op.operation === "rename") {
      return `${old.file_name || old.file_path || ""} → ${nw.file_name || nw.file_path || ""}`;
    }
    if (op.operation === "move") {
      return `${old.file_path || ""} → ${nw.file_path || ""}`;
    }
    return JSON.stringify(old);
  } catch {
    return "";
  }
}
