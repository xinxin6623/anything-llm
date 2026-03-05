import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import KBLayout from "./layout";
import KnowledgeBase from "@/models/knowledgeBase";
import paths from "@/utils/paths";
import {
  Files,
  FolderSimple,
  Stack,
  CheckCircle,
  Clock,
  Warning,
  ArrowRight,
  Rocket,
  QuestionCircle,
  FolderOpen,
} from "@phosphor-icons/react";

export default function KnowledgeBaseHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    KnowledgeBase.getStats().then(({ success, stats }) => {
      if (success) setStats(stats);
      setLoading(false);
    });
  }, []);

  return (
    <KBLayout>
      <div className="max-w-4xl mx-auto">
        {/* 欢迎卡片 */}
        {(!stats || stats.total === 0) && (
          <WelcomeCard />
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">知识库管理</h1>
              <p className="text-white/50 text-sm">
                扫描、分类、向量化并搜索您的本地文件知识库
              </p>
            </div>
            {(!stats || stats.total === 0) && (
              <Link
                to={paths.knowledgeBase.quickStart()}
                className="flex items-center gap-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Rocket className="h-4 w-4" />
                快速开始
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white/5 rounded-xl p-4 animate-pulse h-24"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Files}
              label="总文件数"
              value={stats?.total ?? 0}
              color="text-blue-400"
            />
            <StatCard
              icon={CheckCircle}
              label="已向量化"
              value={stats?.embedded ?? 0}
              color="text-green-400"
            />
            <StatCard
              icon={Clock}
              label="待处理"
              value={stats?.pending ?? 0}
              color="text-yellow-400"
            />
            <StatCard
              icon={Warning}
              label="处理失败"
              value={stats?.error ?? 0}
              color="text-red-400"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickLink
            to={paths.knowledgeBase.files()}
            icon={Files}
            title="文件扫描 & 列表"
            desc="扫描目录，查看所有已索引文件及其状态"
          />
          <QuickLink
            to={paths.knowledgeBase.categories()}
            icon={FolderSimple}
            title="分类管理"
            desc="查看、重命名、合并文件分类"
          />
          <QuickLink
            to={paths.knowledgeBase.embed()}
            icon={Stack}
            title="向量化管理"
            desc="将已分类文件嵌入向量数据库，支持语义搜索"
          />
          <QuickLink
            to={paths.knowledgeBase.search()}
            icon={Stack}
            title="智能搜索"
            desc="使用关键词或自然语言搜索知识库内容"
          />
        </div>
      </div>
    </KBLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-y-2">
      <Icon className={`h-6 w-6 ${color}`} />
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="group bg-white/5 hover:bg-white/10 rounded-xl p-4 flex items-start gap-x-3 transition-all duration-150"
    >
      <Icon className="h-6 w-6 text-white/50 group-hover:text-white mt-0.5 flex-shrink-0 transition-colors" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/50 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors flex-shrink-0 mt-1" />
    </Link>
  );
}

function WelcomeCard() {
  return (
    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Rocket className="h-6 w-6 text-blue-400" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">
            欢迎使用知识库管理器！ 👋
          </h3>
          <p className="text-sm text-white/70 mb-4">
            将您的本地文件变成可搜索的智能知识库。按照以下步骤开始：
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={paths.knowledgeBase.quickStart()}
              className="inline-flex items-center gap-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Rocket className="h-4 w-4" />
              快速开始指南
            </Link>
            <Link
              to={paths.knowledgeBase.config()}
              className="inline-flex items-center gap-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              立即配置
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
