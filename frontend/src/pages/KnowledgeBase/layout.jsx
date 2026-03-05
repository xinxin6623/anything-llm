import React from "react";
import { NavLink } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { SidebarMobileHeader } from "@/components/Sidebar";
import paths from "@/utils/paths";
import {
  Brain,
  Gear,
  Files,
  FolderSimple,
  Stack,
  MagnifyingGlass,
  ArrowsClockwise,
} from "@phosphor-icons/react";

const navItems = [
  { label: "概览", to: paths.knowledgeBase.home(), icon: Brain, exact: true },
  { label: "目录配置", to: paths.knowledgeBase.config(), icon: Gear },
  { label: "文件列表", to: paths.knowledgeBase.files(), icon: Files },
  {
    label: "分类管理",
    to: paths.knowledgeBase.categories(),
    icon: FolderSimple,
  },
  { label: "向量化管理", to: paths.knowledgeBase.embed(), icon: Stack },
  {
    label: "智能搜索",
    to: paths.knowledgeBase.search(),
    icon: MagnifyingGlass,
  },
  {
    label: "文件操作",
    to: paths.knowledgeBase.fileOps(),
    icon: ArrowsClockwise,
  },
];

export default function KBLayout({ children }) {
  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {isMobile ? <SidebarMobileHeader /> : <Sidebar />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-hidden flex flex-col"
      >
        {/* KB Top Nav */}
        <div className="flex items-center gap-x-1 px-4 pt-4 pb-2 border-b border-white/10 flex-shrink-0 overflow-x-auto no-scroll">
          {navItems.map(({ label, to, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
