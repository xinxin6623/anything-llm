import React from "react";
import KBLayout from "./layout";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import {
  FolderOpen,
  Scan,
  Brain,
  Stack,
  MagnifyingGlass,
  ArrowRight,
  CheckCircle,
  PlayCircle,
  Lightning
} from "@phosphor-icons/react";

const STEPS = [
  {
    step: 1,
    title: "配置目录",
    description: "设置你的知识库文件存储路径",
    icon: FolderOpen,
    to: paths.knowledgeBase.config(),
    color: "text-blue-400",
    bgColor: "bg-blue-500/10"
  },
  {
    step: 2,
    title: "扫描文件",
    description: "扫描目录中的所有文件",
    icon: Scan,
    to: paths.knowledgeBase.files(),
    color: "text-green-400",
    bgColor: "bg-green-500/10"
  },
  {
    step: 3,
    title: "AI 分类",
    description: "让 AI 自动分析和分类文件",
    icon: Brain,
    to: paths.knowledgeBase.files(),
    color: "text-purple-400",
    bgColor: "bg-purple-500/10"
  },
  {
    step: 4,
    title: "向量化",
    description: "将文件内容转为向量以便语义搜索",
    icon: Stack,
    to: paths.knowledgeBase.embed(),
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10"
  },
  {
    step: 5,
    title: "开始搜索",
    description: "使用关键词或自然语言搜索你的文件",
    icon: MagnifyingGlass,
    to: paths.knowledgeBase.search(),
    color: "text-pink-400",
    bgColor: "bg-pink-500/10"
  }
];

export default function KnowledgeBaseQuickStart() {
  return (
    <KBLayout>
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            🚀 快速开始
          </h1>
          <p className="text-white/50">
            五分钟上手个人知识库管理器
          </p>
        </div>

        {/* 步骤说明 */}
        <div className="space-y-4 mb-8">
          {STEPS.map((step, index) => (
            <StepCard key={step.step} step={step} isLast={index === STEPS.length - 1} />
          ))}
        </div>

        {/* 视频提示 */}
        <div className="bg-white/5 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-x-2">
            <PlayCircle className="h-5 w-5 text-blue-400" />
            功能演示
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureDemo
              title="智能分类"
              description="AI 自动分析文件内容，生成分类、摘要和关键词"
              icon={<Brain className="h-6 w-6 text-purple-400" />}
            />
            <FeatureDemo
              title="语义搜索"
              description="用自然语言搜索，理解你的意思而不仅仅是关键词"
              icon={<MagnifyingGlass className="h-6 w-6 text-green-400" />}
            />
            <FeatureDemo
              title="文件操作"
              description="重命名、移动文件，支持操作历史和回滚"
              icon={<Lightning className="h-6 w-6 text-yellow-400" />}
            />
          </div>
        </div>

        {/* 开始按钮 */}
        <div className="text-center">
          <Link
            to={paths.knowledgeBase.config()}
            className="inline-flex items-center gap-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            开始配置
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </KBLayout>
  );
}

function StepCard({ step, isLast }) {
  const Icon = step.icon;
  
  return (
    <div className="relative">
      <Link
        to={step.to}
        className="flex items-start gap-x-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group"
      >
        {/* 步骤图标 */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${step.bgColor} flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${step.color}`} />
        </div>
        
        {/* 步骤内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2">
            <span className="text-xs font-medium text-white/40">
              步骤 {step.step}
            </span>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors mt-1">
            {step.title}
          </h3>
          <p className="text-sm text-white/50 mt-1">
            {step.description}
          </p>
        </div>
        
        {/* 箭头 */}
        <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0 mt-2" />
      </Link>
      
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-white/10 -z-10" />
      )}
    </div>
  );
}

function FeatureDemo({ title, description, icon }) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <div className="flex items-center gap-x-3 mb-2">
        {icon}
        <h4 className="font-medium text-white">{title}</h4>
      </div>
      <p className="text-sm text-white/50">
        {description}
      </p>
    </div>
  );
}
