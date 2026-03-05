const { search } = require("../../../KnowledgeBase/searcher");
const { KBIndexer } = require("../../../KnowledgeBase/indexer");

const kbSearch = {
  name: "kb-search",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          controller: new AbortController(),
          description:
            "Search the personal knowledge base for relevant documents and files. Returns content snippets and file paths. Use this when the user asks about their local files or personal documents.",
          examples: [
            {
              prompt: "Search my knowledge base for project management notes",
              call: JSON.stringify({
                query: "project management",
                mode: "both",
              }),
            },
            {
              prompt: "Find files about machine learning in my documents",
              call: JSON.stringify({
                query: "machine learning",
                mode: "semantic",
                limit: 5,
              }),
            },
            {
              prompt: "List all categories in my knowledge base",
              call: JSON.stringify({ query: "", action: "list_categories" }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query — keywords or natural language description of what to find",
              },
              mode: {
                type: "string",
                enum: ["keyword", "semantic", "both"],
                description:
                  "Search mode. 'both' (default) combines keyword and semantic search.",
              },
              category: {
                type: "string",
                "x-nullable": true,
                description: "Limit search to a specific category (optional)",
              },
              limit: {
                type: "number",
                description: "Max number of results to return (default: 10)",
              },
              action: {
                type: "string",
                enum: ["search", "list_categories", "stats"],
                description:
                  "Action: 'search' (default), 'list_categories', or 'stats'",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
          handler: async function ({
            query,
            mode = "both",
            category,
            limit = 10,
            action = "search",
          }) {
            const self = this;
            try {
              if (action === "list_categories") {
                const categories = await KBIndexer.getCategories();
                if (categories.length === 0) {
                  return self.super.introspect(
                    "Knowledge base has no categories yet. Files need to be scanned and classified first."
                  );
                }
                const list = categories
                  .map((c) => `${c.category} (${c.count} files)`)
                  .join(", ");
                return self.super.introspect(
                  `Knowledge base categories: ${list}`
                );
              }

              if (action === "stats") {
                const stats = await KBIndexer.getStats();
                return self.super.introspect(
                  `Knowledge base stats: ${stats.total} total files, ${stats.embedded} embedded, ${stats.indexed} classified, ${stats.pending} pending`
                );
              }

              // Default: search
              if (!query?.trim()) {
                return self.super.introspect("No search query provided.");
              }

              const results = await search(query, {
                category: category || null,
                mode,
                limit: Number(limit) || 10,
              });

              if (results.length === 0) {
                return self.super.introspect(
                  `No results found in knowledge base for: "${query}"`
                );
              }

              const formatted = results
                .map((r, i) => {
                  const parts = [`[${i + 1}] ${r.file_name}`];
                  if (r.category) parts.push(`Category: ${r.category}`);
                  parts.push(`Path: ${r.file_path}`);
                  if (r.snippet) parts.push(`Snippet: ${r.snippet}`);
                  return parts.join(" | ");
                })
                .join("\n");

              return self.super.introspect(
                `Found ${results.length} knowledge base results for "${query}":\n${formatted}`
              );
            } catch (err) {
              console.error("[KB-Search Plugin] Error:", err.message);
              return self.super.introspect(
                `Knowledge base search failed: ${err.message}`
              );
            }
          },
        });
      },
    };
  },
};

module.exports = { kbSearch };
