#!/usr/bin/env node
/**
 * Knowledge Base MCP Server
 *
 * Exposes KB search and file listing as MCP tools for use with
 * Claude Desktop or any MCP-compatible client.
 *
 * Usage:
 *   node server/utils/KnowledgeBase/mcp-server.js
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "knowledge-base": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/anythingllm/server/utils/KnowledgeBase/mcp-server.js"],
 *       "env": {
 *         "DATABASE_PATH": "/absolute/path/to/anythingllm/server/storage/anythingllm.db",
 *         "STORAGE_DIR": "/absolute/path/to/anythingllm/server/storage"
 *       }
 *     }
 *   }
 * }
 */

// Load env before anything else
const path = require("path");
const serverRoot = path.resolve(__dirname, "../../..");
require("dotenv").config({ path: path.join(serverRoot, ".env") });

// Set STORAGE_DIR if not set (needed by DocumentManager / prisma path)
if (!process.env.STORAGE_DIR) {
  process.env.STORAGE_DIR = path.join(serverRoot, "server", "storage");
}

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const { search } = require("./searcher");
const { KBIndexer } = require("./indexer");

const server = new Server(
  { name: "knowledge-base", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "kb_search",
      description:
        "搜索个人知识库。支持关键词搜索、语义搜索或混合模式。返回匹配文件的内容片段和源文件路径。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词或自然语言描述",
          },
          mode: {
            type: "string",
            enum: ["keyword", "semantic", "both"],
            description:
              "搜索模式：keyword（关键词）、semantic（语义）、both（混合，默认）",
            default: "both",
          },
          category: {
            type: "string",
            description: "限定搜索的文件分类（可选），留空则搜索全库",
          },
          limit: {
            type: "number",
            description: "返回结果数量上限，默认 10",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "kb_list_categories",
      description: "列出知识库中所有文件分类及其文件数量",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "kb_stats",
      description: "获取知识库统计信息：总文件数、已向量化数、待处理数等",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "kb_list_files",
      description: "列出知识库中的文件，可按分类或状态过滤",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "按分类过滤（可选）",
          },
          status: {
            type: "string",
            enum: ["pending", "processing", "indexed", "embedded", "error"],
            description: "按状态过滤（可选）",
          },
          limit: {
            type: "number",
            description: "返回数量上限，默认 50",
            default: 50,
          },
        },
      },
    },
  ],
}));

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "kb_search": {
        const { query, mode = "both", category, limit = 10 } = args;
        if (!query) {
          return errorResult("query 参数是必须的");
        }
        const results = await search(query, {
          category: category || null,
          mode,
          limit: Number(limit),
        });

        if (results.length === 0) {
          return textResult(`未找到与 "${query}" 相关的内容`);
        }

        const formatted = results
          .map((r, i) => {
            const lines = [
              `[${i + 1}] **${r.file_name}**`,
              `分类: ${r.category || "未分类"}`,
              `路径: ${r.file_path}`,
            ];
            if (r.snippet) {
              lines.push(`内容片段:\n${r.snippet}`);
            }
            if (r.score !== null && r.score !== undefined) {
              lines.push(`相关度: ${(r.score * 100).toFixed(0)}%`);
            }
            return lines.join("\n");
          })
          .join("\n\n---\n\n");

        return textResult(
          `找到 ${results.length} 条与 "${query}" 相关的结果：\n\n${formatted}`
        );
      }

      case "kb_list_categories": {
        const categories = await KBIndexer.getCategories();
        if (categories.length === 0) {
          return textResult("知识库暂无分类数据");
        }
        const formatted = categories
          .map(
            (c) =>
              `- **${c.category}**：${c.count} 个文件${c.sub_categories?.length ? `（子分类: ${c.sub_categories.join(", ")}）` : ""}`
          )
          .join("\n");
        return textResult(
          `知识库分类列表（共 ${categories.length} 个分类）：\n\n${formatted}`
        );
      }

      case "kb_stats": {
        const stats = await KBIndexer.getStats();
        return textResult(
          `知识库统计：\n` +
            `- 总文件数: ${stats.total}\n` +
            `- 已向量化: ${stats.embedded}\n` +
            `- 已分类（待向量化）: ${stats.indexed}\n` +
            `- 待处理: ${stats.pending}\n` +
            `- 处理中: ${stats.processing}\n` +
            `- 处理失败: ${stats.error}`
        );
      }

      case "kb_list_files": {
        const { category, status, limit = 50 } = args;
        const { files, total } = await KBIndexer.getAllFiles({
          page: 1,
          limit: Number(limit),
          status: status || null,
          category: category || null,
        });

        if (files.length === 0) {
          return textResult("没有找到符合条件的文件");
        }

        const formatted = files
          .map(
            (f) =>
              `- **${f.file_name}** [${f.status}]` +
              (f.category ? ` | 分类: ${f.category}` : "") +
              `\n  路径: ${f.file_path}`
          )
          .join("\n");

        return textResult(
          `找到 ${total} 个文件（显示前 ${files.length} 个）：\n\n${formatted}`
        );
      }

      default:
        return errorResult(`未知工具: ${name}`);
    }
  } catch (err) {
    console.error(`[KB-MCP] Tool ${name} error:`, err.message);
    return errorResult(`工具执行失败: ${err.message}`);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: `错误: ${message}` }],
    isError: true,
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[KB-MCP] Knowledge Base MCP Server started");
}

main().catch((err) => {
  console.error("[KB-MCP] Fatal error:", err);
  process.exit(1);
});
