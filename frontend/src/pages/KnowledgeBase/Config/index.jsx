import React, { useEffect, useState } from "react";
import KBLayout from "../layout";
import KnowledgeBase from "@/models/knowledgeBase";
import showToast from "@/utils/toast";
import { 
  FloppyDisk, 
  FolderOpen, 
  QuestionCircle,
  Info,
  Clock,
  Lightning,
  FileText,
  CheckCircle
} from "@phosphor-icons/react";

// 预设目录示例
const PRESET_PATHS = [
  { 
    label: "📁 文档文件夹", 
    value: "/Users/你的用户名/Documents",
    hint: "macOS 文档目录"
  },
  { 
    label: "📝 笔记目录", 
    value: "/Users/你的用户名/Notes",
    hint: "自定义笔记文件夹"
  },
  { 
    label: "🏠 主目录", 
    value: "/Users/你的用户名",
    hint: "用户主目录（谨慎选择）"
  },
  { 
    label: "🖥️ 下载目录", 
    value: "/Users/你的用户名/Downloads",
    hint: "下载文件夹"
  },
];

export default function KnowledgeBaseConfig() {
  const [config, setConfig] = useState({
    storage_dir: "",
    watch_dir: "",
    auto_scan_interval: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    KnowledgeBase.getConfig().then(({ success, config: cfg }) => {
      if (success && cfg) {
        setConfig({
          storage_dir: cfg.storage_dir || "",
          watch_dir: cfg.watch_dir || "",
          auto_scan_interval: cfg.auto_scan_interval || "",
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { success, error } = await KnowledgeBase.saveConfig(config);
    setSaving(false);
    if (success) {
      showToast("配置已保存", "success");
    } else {
      showToast(error || "保存失败", "error");
    }
  };

  const applyPreset = (path) => {
    setConfig(c => ({ ...c, storage_dir: path }));
    showToast("已应用预设路径，请修改为你的实际用户名", "info");
  };

  if (loading) {
    return (
      <KBLayout>
        <div className="flex items-center justify-center h-32 text-white/50">
          加载中...
        </div>
      </KBLayout>
    );
  }

  return (
    <KBLayout>
      <div className="max-w-4xl mx-auto">
        {/* 标题区域 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">目录配置</h2>
              <p className="text-white/50 text-sm mt-1">
                配置知识库的文件存储路径和监听目录
              </p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-x-2 px-3 py-1.5 text-white/60 hover:text-white transition-colors"
            >
              <QuestionCircle className="h-4 w-4" />
              <span className="text-sm">{showHelp ? "隐藏帮助" : "显示帮助"}</span>
            </button>
          </div>
        </div>

        {/* 帮助卡片 */}
        {showHelp && (
          <HelpCard />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 主配置表单 */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="space-y-5">
              <ConfigField
                label="存储目录（必填）"
                name="storage_dir"
                value={config.storage_dir}
                onChange={(v) => setConfig((c) => ({ ...c, storage_dir: v }))}
                placeholder="/path/to/your/knowledge-base"
                hint="已有文件的主存储目录，知识库将从此目录扫描文件"
                icon={<FolderOpen className="h-5 w-5 text-white/40" />}
                required
              />

              <ConfigField
                label="监听目录（可选）"
                name="watch_dir"
                value={config.watch_dir}
                onChange={(v) => setConfig((c) => ({ ...c, watch_dir: v }))}
                placeholder="/path/to/watch/folder"
                hint="新增文件的监听目录，扫描时将同时扫描此目录"
                icon={<Lightning className="h-5 w-5 text-white/40" />}
              />

              <ConfigField
                label="自动扫描间隔（分钟）"
                name="auto_scan_interval"
                value={config.auto_scan_interval}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, auto_scan_interval: v }))
                }
                placeholder="60"
                hint="留空则不自动扫描，建议设置为 30 或 60 分钟"
                icon={<Clock className="h-5 w-5 text-white/40" />}
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FloppyDisk className="h-4 w-4" />
                  {saving ? "保存中..." : "保存配置"}
                </button>
              </div>
            </form>
          </div>

          {/* 预设目录和快速提示 */}
          <div className="space-y-4">
            {/* 预设目录 */}
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-x-2">
                <FileText className="h-4 w-4" />
                预设路径示例
              </h3>
              <div className="space-y-2">
                {PRESET_PATHS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(preset.value)}
                    className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <div className="text-sm text-white group-hover:text-blue-400 transition-colors">
                      {preset.label}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5 font-mono">
                      {preset.value}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 快速提示 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-x-2">
                <Info className="h-4 w-4" />
                重要提示
              </h3>
              <ul className="text-xs text-white/60 space-y-1.5">
                <li>• 如果使用 Docker，路径必须是容器内的路径</li>
                <li>• 配置后请先测试扫描功能</li>
                <li>• 建议先从一个小目录开始测试</li>
              </ul>
            </div>

            {/* 配置状态 */}
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-x-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                当前状态
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">存储目录</span>
                  <span className={config.storage_dir ? "text-green-400" : "text-yellow-400"}>
                    {config.storage_dir ? "已配置" : "未配置"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">自动扫描</span>
                  <span className={config.auto_scan_interval ? "text-green-400" : "text-white/40"}>
                    {config.auto_scan_interval ? `${config.auto_scan_interval} 分钟` : "关闭"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </KBLayout>
  );
}

function ConfigField({ label, name, value, onChange, placeholder, hint, icon, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </div>
        )}
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent ${icon ? 'pl-10' : ''}`}
        />
      </div>
      {hint && <p className="text-xs text-white/40 mt-1.5">{hint}</p>}
    </div>
  );
}

function HelpCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">📖 使用指南</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-white mb-1">1️⃣ 配置存储目录</h4>
            <p className="text-xs text-white/60">
              选择包含你要管理的文件的文件夹。建议先从一个专门的知识库文件夹开始。
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-white mb-1">2️⃣ Docker 用户注意</h4>
            <p className="text-xs text-white/60">
              如果使用 Docker 运行，需要在 docker-compose.yml 中挂载目录，
              然后在配置中填写容器内的路径（如 /mnt/documents）。
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-white mb-1">3️⃣ 设置自动扫描</h4>
            <p className="text-xs text-white/60">
              建议设置 30-60 分钟的自动扫描间隔，这样新增的文件会被自动发现。
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-white mb-1">4️⃣ 保存后扫描</h4>
            <p className="text-xs text-white/60">
              配置保存后，去「文件列表」页面点击「扫描目录」来首次扫描你的文件。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-start gap-x-2 text-xs text-yellow-400/80">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            <strong>提示：</strong> 首次使用建议先配置一个包含少量文件的目录进行测试，
            确认一切正常后再添加更大的目录。
          </p>
        </div>
      </div>
    </div>
  );
}
