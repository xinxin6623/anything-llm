# 个人知识库管理器 — 使用说明书

基于 AnythingLLM 二次开发，将本地文件目录变成可搜索的个人知识库。

---

## 目录

1. [快速开始](#1-快速开始)
2. [第一步：配置目录](#2-第一步配置目录)
3. [第二步：扫描文件](#3-第二步扫描文件)
4. [第三步：AI 自动分类](#4-第三步ai-自动分类)
5. [第四步：向量化](#5-第四步向量化)
6. [第五步：智能搜索](#6-第五步智能搜索)
7. [文件操作](#7-文件操作)
8. [分类管理](#8-分类管理)
9. [Agent 集成](#9-agent-集成)
10. [MCP Server（Claude Desktop）](#10-mcp-serverclaude-desktop)
11. [FAQ & 常见问题](#11-faq--常见问题)

---

## 1. 快速开始

### 前置条件

- Docker 已运行（AnythingLLM 容器）
- Ollama 本地运行（用于 AI 分类），默认模型 `qwen3:8b`
- 访问地址：http://localhost:3001

### 挂载你的文件目录（必须）

容器默认只能读取容器内部的路径。如果你想扫描宿主机上的文件目录，需要在 `docker/docker-compose.yml` 的 `volumes` 里添加挂载：

```yaml
volumes:
  - "./.env:/app/server/.env"
  - "../server/storage:/app/server/storage"
  - "../collector/hotdir/:/app/collector/hotdir"
  - "../collector/outputs/:/app/collector/outputs"
  # 添加你自己的文件目录：
  - "/Users/你的用户名/Documents:/mnt/documents"
  - "/Users/你的用户名/Notes:/mnt/notes"
```

添加后重启容器：

```bash
cd /Users/xinxin/anythingllm/docker
docker compose down && docker compose up -d
```

> **注意**：在知识库配置界面填写的路径，要用容器内的挂载路径（如 `/mnt/documents`），不是宿主机路径。

---

## 2. 第一步：配置目录

打开 http://localhost:3001，在左侧边栏点击「**知识库管理**」（大脑图标）。

进入「**目录配置**」页面，填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| 存储目录 | 已有文件的主目录 | `/mnt/documents` |
| 监听目录 | 新增文件的监听目录（可选） | `/mnt/notes` |
| 自动扫描间隔 | 多少分钟自动扫描一次（留空不自动扫描） | `60` |

点击「**保存配置**」。

---

## 3. 第二步：扫描文件

进入「**文件列表**」页面，点击右上角「**扫描目录**」按钮。

扫描会：
- 遍历所有配置目录（递归扫描子目录）
- 对比文件 MD5 哈希，只处理新增或修改过的文件
- 将文件信息写入索引数据库，状态标为「待处理」

**支持的文件格式：**

| 类型 | 格式 |
|------|------|
| 文本 | .txt .md .org .rst .adoc |
| 办公 | .pdf .docx .pptx .xlsx .odt |
| 数据 | .csv .json .html |
| 电子书 | .epub |
| 邮件 | .mbox |
| 音频（转录） | .mp3 .wav .mp4 .mpeg |
| 图片（OCR） | .png .jpg .jpeg .webp |

扫描完成后，页面会显示「新增 X 个，更新 X 个」的结果。

---

## 4. 第三步：AI 自动分类

扫描后，文件处于「待处理」状态。点击「**AI 分类全部待处理**」按钮，让 LLM 自动分析每个文件并打标签。

AI 会为每个文件生成：
- **一级分类**（如：技术文档、财务报表、学习笔记、项目资料）
- **二级分类**（如：Python、2024年Q1、机器学习）
- **摘要**（100字以内）
- **关键词**（最多8个）

你也可以在文件列表中**勾选指定文件**，只对选中的文件运行 AI 分类。

分类完成后，文件状态变为「已分类」。

> **注意**：分类依赖 Ollama 服务运行，每个文件会调用一次 LLM。文件较多时需要等待一段时间。

---

## 5. 第四步：向量化

进入「**向量化管理**」页面。

向量化将文件内容拆分成语义片段存入 LanceDB 向量数据库，为语义搜索做准备。

**操作步骤：**
1. 在下拉菜单选择要向量化的分类（或留空处理全部）
2. 点击「**开始向量化**」
3. 实时日志会显示每个文件的处理进度

**向量化原理：**
- 每个分类会创建一个独立的 AnythingLLM Workspace（命名格式：`知识库-{分类名}`）
- 文件通过 Collector 解析后存入对应 Workspace 的向量空间
- 向量化完成后，文件状态变为「已向量化」

---

## 6. 第五步：智能搜索

进入「**智能搜索**」页面。

### 搜索模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **混合（推荐）** | 关键词 + 语义，结果合并去重 | 日常搜索 |
| **语义搜索** | 向量相似度，理解语义 | 找相关概念，不确定关键词 |
| **关键词搜索** | 精确字符串匹配 | 查找特定词、人名、编号 |

### 搜索示例

```
关于机器学习的笔记
2024年的财务报告
张三的联系方式
项目甲的会议记录
```

### 搜索结果

每条结果包含：
- **文件名** + 相关度分数
- **源文件路径**（可直接找到原文件）
- **内容片段**（命中的相关内容，长文可展开）
- **关键词标签**

---

## 7. 文件操作

进入「**文件操作**」页面，支持三个功能：

### 重命名文件

1. 切换到「重命名文件」标签
2. 搜索找到目标文件
3. 点击「重命名」按钮，输入新文件名，回车确认

### 移动文件

1. 切换到「移动文件」标签
2. 搜索找到目标文件
3. 点击「移动」按钮，输入目标目录的完整路径，回车确认

### 操作历史与回滚

所有重命名/移动操作都会记录在「操作历史」中，包含操作时间和前后路径。点击「**回滚**」可以撤销该操作（将文件移回原位）。

> **注意**：重命名和移动只修改文件系统和索引，不影响已有的向量数据。如需向量数据也更新，需重新处理该文件。

---

## 8. 分类管理

进入「**分类管理**」页面，查看所有 AI 分类结果。

### 重命名分类

点击分类右侧的 ✏️ 图标，直接在行内编辑新名称，回车或点击 ✓ 确认。

所有属于该分类的文件会同步更新分类名。

### 合并分类

点击分类右侧的合并图标，选择目标分类，确认后源分类下的所有文件会被移动到目标分类。

### 手动调整文件分类

在「**文件列表**」页面，如果某个文件的 AI 分类不准确，可以通过 API 手动修改（目前界面尚未提供此入口，可直接调用接口）：

```bash
curl -X POST http://localhost:3001/api/knowledge-base/files/{fileId}/move-category \
  -H "Content-Type: application/json" \
  -d '{"category": "正确分类", "sub_category": "子分类"}'
```

---

## 9. Agent 集成

在 AnythingLLM 的聊天界面中，可以让 Agent 直接搜索你的知识库。

### 启用步骤

1. 进入「设置」→「AI Agents」
2. 在「可配置技能」中找到「**Knowledge Base Search**」
3. 点击启用
4. 在任意工作区的聊天框中，点击闪电图标切换到 Agent 模式

### 使用示例

在 Agent 模式下，直接用自然语言提问：

```
帮我在知识库里找一下关于 Docker 部署的文档
我的笔记里有没有提到过"李四"这个人？
列出知识库里所有关于财务的文件
```

Agent 会自动调用知识库搜索，返回文件名、路径和相关内容片段。

---

## 10. MCP Server（Claude Desktop）

将知识库搜索能力接入 Claude Desktop，让 Claude 在对话中直接查询你的文件。

### 配置步骤

**第一步：找到 mcp-server.js 的完整路径**

```
/Users/xinxin/anythingllm/server/utils/KnowledgeBase/mcp-server.js
```

**第二步：编辑 Claude Desktop 配置文件**

文件位置：`~/.claude/claude_desktop_config.json`（不存在则新建）

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "node",
      "args": [
        "/Users/xinxin/anythingllm/server/utils/KnowledgeBase/mcp-server.js"
      ],
      "cwd": "/Users/xinxin/anythingllm/server"
    }
  }
}
```

> **重要**：`cwd` 必须设为 `server/` 目录，Prisma 才能找到数据库文件。

**第三步：重启 Claude Desktop**

重启后，在 Claude 对话框中就能看到知识库工具。

### 可用工具

| 工具名 | 功能 |
|--------|------|
| `kb_search` | 搜索知识库，支持关键词/语义/混合模式 |
| `kb_list_categories` | 列出所有分类及文件数量 |
| `kb_stats` | 查看知识库整体统计 |
| `kb_list_files` | 列出文件，可按分类/状态过滤 |

### 使用示例

在 Claude Desktop 对话中：

```
帮我搜索知识库里关于"项目管理"的文档
我的知识库现在有哪些分类？
查一下状态是 pending 的文件有哪些
```

---

## 11. FAQ & 常见问题

### Q：扫描后文件没有出现在列表里？

检查两点：
1. docker-compose.yml 是否挂载了对应的宿主机目录
2. 配置页填写的是容器内路径，不是宿主机路径

### Q：AI 分类失败，状态变成「失败」？

检查：
- Ollama 服务是否运行：`ollama list`
- `qwen3:8b` 模型是否已下载：`ollama pull qwen3:8b`
- 容器能否访问 Ollama：`docker exec anythingllm curl -s http://host.docker.internal:11434/api/tags`

### Q：语义搜索没有结果？

语义搜索需要先完成向量化。确认文件状态是「已向量化」（紫色标签），而不是「已分类」（绿色标签）。

### Q：向量化失败，提示 No doc_location？

该文件没有经过 AI 分类处理步骤（Collector 解析）。请先在「文件列表」页面对该文件运行「AI 分类」，成功后再向量化。

### Q：代码修改后如何更新？

```bash
cd /Users/xinxin/anythingllm/docker
docker compose build   # 重新打包（约30秒）
docker compose down && docker compose up -d
```

### Q：如何查看服务日志排查问题？

```bash
docker logs -f anythingllm
# 或只看最近50行
docker logs --tail=50 anythingllm
```

### Q：数据存在哪里？

| 数据类型 | 存储位置 |
|---------|---------|
| 文件索引（元数据、分类） | `server/storage/anythingllm.db`（SQLite，`kb_files` 表） |
| 操作历史 | `server/storage/anythingllm.db`（`kb_operations` 表） |
| 向量数据 | `server/storage/lancedb/` |
| 已解析文档 | `server/storage/documents/` |

所有数据通过 Docker volumes 持久化，重建镜像不会丢失。

---

*文档最后更新：2026-03-03*
