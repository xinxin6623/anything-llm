# AnythingLLM 项目记忆

## 环境信息

- 项目目录：`/Users/xinxin/anythingllm`
- 机器：Apple M4 + 32GB 内存
- Node：v25.6.1，包管理器：Yarn 1.22.22
- 本地 LLM：Ollama，已加载模型见下方

## 本地 Ollama 模型

| 模型 | 大小 | 用途 |
|------|------|------|
| qwen3:8b | 5.2GB | 日常问答、文档问答（当前首选） |
| qwen2.5:7b | 4.7GB | 通用 |
| qwen2.5-coder:14b | 9.0GB | 写代码 |
| qwen2.5-coder:14b-128k | 9.0GB | 写代码，128K 长上下文 |
| gemma3:12b | 8.9GB | 通用，Google 出品 |

## 启动脚本

脚本路径：`/Users/xinxin/anythingllm/start.sh`

```bash
./start.sh           # 后台启动所有服务
./start.sh status    # 查看三个服务运行状态
./start.sh log server    # 实时查看 server 日志
./start.sh log frontend  # 实时查看 frontend 日志
./start.sh log collector # 实时查看 collector 日志
./start.sh stop      # 停止所有服务
```

日志文件目录：`/Users/xinxin/anythingllm/.logs/`

## 服务端口

| 服务 | 端口 |
|------|------|
| Frontend（界面） | http://localhost:3000 |
| Server（后端 API） | http://localhost:3001 |
| Collector（文档处理） | http://localhost:8888 |

## 首次初始化记录

- `yarn setup` 中 `sharp` 因网络问题安装失败，需单独用镜像安装：
  ```bash
  cd server && npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp" yarn add sharp --ignore-engines
  ```
- collector 依赖安装耗时较长（约 10 分钟），正常现象
- DB 文件位置：`server/storage/anythingllm.db`

## GitHub

- 上游仓库：https://github.com/Mintplex-Labs/anything-llm
- 本地 fork：https://github.com/xinxin6623/anything-llm
- 已提 PR：https://github.com/Mintplex-Labs/anything-llm/pull/5094（添加 CLAUDE.md）
- 本地 remote 配置：
  - `origin` → 上游（只读）
  - `fork` → 自己的 fork（可推送）
