# 个人知识库管理器 — 需求定义 v1.0

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

## 五、开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| P1 | 目录配置 + 文件扫描 + 索引数据库 + 基础 UI | 待开发 |
| P2 | LLM 自动分类 + 分类管理界面 | 待开发 |
| P3 | 向量化管理 + 实时进度展示 | 待开发 |
| P4 | 自然语言搜索界面（关键词 + 语义） | 待开发 |
