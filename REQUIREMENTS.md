# 个人知识库管理器 — 需求定义 v1.1

基于 AnythingLLM 二次开发，在现有界面上新增「个人知识库管理器」功能模块。

---

## 一、功能入口

在 AnythingLLM 左侧主 Sidebar 底部新增「知识库」图标入口，点击进入独立管理界面。

---

## 二、核心功能模块

### 模块1：目录配置

设置页，两个路径输入框：

| 字段 | 说明 |
|------|------|
| 存储目录 | 已有文件的根目录，全量扫描 |
| 监听目录 | 新增文件的监听目录，增量处理 |

- 支持点击选择目录
- 配置持久化到数据库
- 两个目录可以相同也可以不同

---

### 模块2：文件扫描 & 分析

**触发方式：**
- 手动点击「开始扫描」
- 定时自动扫描（可配置间隔）
- 监听目录有新文件时自动触发

**处理流程：**
```
扫描目录 → 计算文件 hash
    ↓
对比索引数据库
    ├── 新文件 / hash 变化 → 进入处理队列
    └── 已处理且未变化   → 跳过

处理队列：
    → Collector API 解析文件（提取文本）
    → LLM 分析内容，返回：
        - 分类标签（自动生成，最多两级）
        - 100字以内摘要
        - 关键词列表
    → 写入索引数据库
```

**索引数据库字段（`server/storage/knowledgebase.db`）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| file_path | string | 源文件绝对路径 |
| file_hash | string | MD5，用于变更检测 |
| file_name | string | 文件名 |
| file_type | string | 文件格式 |
| file_size | int | 字节数 |
| category | string | 一级分类 |
| sub_category | string | 二级分类（可空） |
| summary | text | 摘要（100字以内） |
| keywords | json | 关键词数组 |
| status | enum | pending / processing / indexed / embedded / error |
| error_msg | string | 错误信息 |
| indexed_at | datetime | 索引时间 |
| embedded_at | datetime | 向量化时间 |
| workspace_slug | string | 对应的 Workspace |
| doc_location | string | Collector 处理后的文档路径 |

---

### 模块3：分类管理

**界面：** 树形分类列表

- 展示所有自动生成的分类及文件数量
- 支持手动合并两个分类
- 支持手动重命名分类
- 支持将单个文件移到其他分类
- 每个分类自动对应一个 AnythingLLM Workspace

**Workspace 映射规则：**
```
一级分类     → 自动创建对应 Workspace
全部文件     → Workspace「全库」（始终存在）
```

---

### 模块4：向量化管理

**界面：** 分类列表 + 操作按钮

| 操作 | 说明 |
|------|------|
| 向量化某个分类 | 将该分类所有已索引文件嵌入对应 Workspace |
| 向量化全部 | 所有已索引文件嵌入「全库」Workspace |
| 重新向量化 | 文件内容变化后重新嵌入 |
| 查看进度 | 实时显示处理进度和状态 |

**向量数据存储：**
- 复用现有 LanceDB（本地）
- 存储位置：`server/storage/lancedb/`（已通过 Docker volume 持久化）

---

### 模块5：自然语言搜索

**界面：** 搜索框 + 结果列表

**搜索方式：**
- 关键词搜索（匹配索引库的摘要、关键词字段）
- 语义搜索（调用向量数据库相似度搜索）
- 可选范围：全库 / 指定分类

**搜索结果返回（每条）：**
- 内容片段（相关段落，高亮关键词）
- 源文件绝对路径（可点击打开）
- 文件名 + 分类标签
- 相关度分数

---

## 三、数据存储规划

| 数据 | 存储位置 | 说明 |
|------|---------|------|
| 索引数据库 | `server/storage/knowledgebase.db` | 新建 SQLite，独立于主库 |
| 向量数据 | `server/storage/lancedb/` | 复用现有 LanceDB |
| 目录配置 | 现有 `anythingllm.db` SystemSettings 表 | 存储路径等配置项 |
| 临时文件 | `collector/hotdir/` | Collector 处理中转，完成后清理 |

---

## 四、技术实现路径

### 前端
- 主 Sidebar 新增知识库入口图标
- 新建路由 `/knowledge-base`（及子路由）
- 页面风格复用现有 Tailwind CSS + Phosphor Icons
- 实时进度使用 SSE（与现有聊天流机制相同）

### 后端
- 新建端点：`server/endpoints/knowledgeBase.js`
- 新建工具类目录：`server/utils/KnowledgeBase/`
  - `scanner.js` — 文件扫描、hash 计算、增量检测
  - `classifier.js` — 调用 LLM 自动分类
  - `indexer.js` — 索引数据库 CRUD
  - `embedder.js` — 向量化调度
  - `searcher.js` — 关键词 + 语义搜索

### 容器适配
- `docker-compose.yml` 新增宿主机文件目录 volume 挂载
- 用户在界面指定的目录需映射进容器才能访问

---

### 模块6（新）：文件操作助手

基于已建立的索引，通过自然语言描述对文件进行批量操作。

**支持的操作类型：**

| 操作 | 示例 |
|------|------|
| 智能重命名 | `IMG_20240315.jpg` → `2024年3月-杭州西湖旅行.jpg` |
| 自动归档 | 按分类/日期自动移动文件到对应目录 |
| 批量重命名 | 「把所有2024年的财务报表加上年份前缀」 |
| 重复文件检测 | 内容相似度对比，提示合并建议 |
| 摘要写入元数据 | 把 LLM 生成的摘要写入文件元数据 |

**交互流程（安全优先）：**
```
用户输入自然语言指令
    ↓
系统解析意图，匹配文件
    ↓
展示「操作预览」（将要改动什么）
    ↓
用户确认
    ↓
执行 + 写入操作日志（支持回滚）
```

---

### 模块7（新）：Agent 自动化

#### P5：接入 AnythingLLM 现有 Agent 框架

将知识库操作封装为 Agent 工具，在现有聊天界面通过 `@agent` 触发，无需额外界面。

**工具集：**

| 工具名 | 功能 |
|--------|------|
| `search_files` | 按自然语言搜索文件 |
| `get_file_info` | 获取文件详情、摘要、关键词 |
| `rename_file` | 重命名文件 |
| `move_file` | 移动文件到目录 |
| `list_category` | 列出某分类下所有文件 |
| `batch_embed` | 触发向量化 |
| `create_category` | 新建分类 |
| `merge_category` | 合并两个分类 |
| `preview_changes` | 预览批量操作（不执行） |
| `execute_changes` | 确认执行变更 |

**使用示例：**
```
你：「把所有没有明确日期的合同文件，按内容推断日期后重命名，移到合同目录下」

Agent 自动执行：
  1. search_files(category="合同")
  2. get_file_info(file_id) × N
  3. preview_changes(operations=[...])
  4. 等待用户确认
  5. execute_changes()
  6. 返回操作报告
```

#### P6：封装为 MCP Server

将全套知识库工具封装为标准 MCP（Model Context Protocol）Server，使 Claude Desktop 等任何支持 MCP 的客户端都能直接操作本地文件库。

**优势：**
- 标准协议，不依赖 AnythingLLM 界面
- Claude Desktop 可直接调用
- 便于未来对接其他 AI 工具

**MCP Server 暴露的能力：** 与 P5 工具集相同，以 MCP 标准协议包装。

---

## 三、数据存储规划

| 数据 | 存储位置 | 说明 |
|------|---------|------|
| 索引数据库 | `server/storage/knowledgebase.db` | 新建 SQLite，独立于主库 |
| 向量数据 | `server/storage/lancedb/` | 复用现有 LanceDB |
| 目录配置 | 现有 `anythingllm.db` SystemSettings 表 | 存储路径等配置项 |
| 操作日志 | `server/storage/knowledgebase.db` 独立表 | 文件操作历史，支持回滚 |
| 临时文件 | `collector/hotdir/` | Collector 处理中转，完成后清理 |

---

## 四、技术实现路径

### 前端
- 主 Sidebar 新增知识库入口图标
- 新建路由 `/knowledge-base`（及子路由）
- 页面风格复用现有 Tailwind CSS + Phosphor Icons
- 实时进度使用 SSE（与现有聊天流机制相同）

### 后端
- 新建端点：`server/endpoints/knowledgeBase.js`
- 新建工具类目录：`server/utils/KnowledgeBase/`
  - `scanner.js` — 文件扫描、hash 计算、增量检测
  - `classifier.js` — 调用 LLM 自动分类
  - `indexer.js` — 索引数据库 CRUD
  - `embedder.js` — 向量化调度
  - `searcher.js` — 关键词 + 语义搜索
  - `fileOps.js` — 文件重命名、移动、操作日志
  - `agentTools.js` — Agent 工具注册
  - `mcpServer.js` — MCP Server 实现

### 容器适配
- `docker-compose.yml` 新增宿主机文件目录 volume 挂载
- 用户在界面指定的目录需映射进容器才能访问

---

## 五、开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| P1 | 目录配置 + 文件扫描 + 索引数据库 + 基础 UI | 待开发 |
| P2 | LLM 自动分类 + 分类管理界面 | 待开发 |
| P3 | 向量化管理 + 实时进度展示 | 待开发 |
| P4 | 自然语言搜索界面（关键词 + 语义） | 待开发 |
| P5 | 文件操作助手 + 接入 AnythingLLM Agent | 待开发 |
| P6 | 封装为 MCP Server（支持 Claude Desktop） | 待开发 |
