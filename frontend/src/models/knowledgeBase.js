import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const KnowledgeBase = {
  async getConfig() {
    return fetch(`${API_BASE}/knowledge-base/config`, {
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, config: {} }));
  },

  async saveConfig(data) {
    return fetch(`${API_BASE}/knowledge-base/config`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  async getStats() {
    return fetch(`${API_BASE}/knowledge-base/stats`, { headers: baseHeaders() })
      .then((r) => r.json())
      .catch(() => ({ success: false, stats: {} }));
  },

  async getFiles({ page = 1, limit = 50, status, category } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    return fetch(`${API_BASE}/knowledge-base/files?${params}`, {
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, files: [], total: 0 }));
  },

  async getCategories() {
    return fetch(`${API_BASE}/knowledge-base/categories`, {
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, categories: [] }));
  },

  async renameCategory(old_name, new_name) {
    return fetch(`${API_BASE}/knowledge-base/categories/rename`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ old_name, new_name }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  async mergeCategories(source, target) {
    return fetch(`${API_BASE}/knowledge-base/categories/merge`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ source, target }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  async moveFileToCategory(fileId, category, sub_category = null) {
    return fetch(`${API_BASE}/knowledge-base/files/${fileId}/move-category`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ category, sub_category }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  // SSE-based operations — returns EventSource-like fetch stream
  async scan(onMessage, onComplete) {
    const response = await fetch(`${API_BASE}/knowledge-base/scan`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return KnowledgeBase._consumeSSE(response, onMessage, onComplete);
  },

  async process(file_ids = [], onMessage, onComplete) {
    const response = await fetch(`${API_BASE}/knowledge-base/process`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids }),
    });
    return KnowledgeBase._consumeSSE(response, onMessage, onComplete);
  },

  async embed(category = null, onMessage, onComplete) {
    const response = await fetch(`${API_BASE}/knowledge-base/embed`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    return KnowledgeBase._consumeSSE(response, onMessage, onComplete);
  },

  async search(query, { category, mode = "both", limit = 20 } = {}) {
    return fetch(`${API_BASE}/knowledge-base/search`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ query, category, mode, limit }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, results: [], error: e.message }));
  },

  async renameFile(fileId, new_name) {
    return fetch(`${API_BASE}/knowledge-base/files/${fileId}/rename`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ new_name }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  async moveFile(fileId, target_dir) {
    return fetch(`${API_BASE}/knowledge-base/files/${fileId}/move`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ target_dir }),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  async getOperations() {
    return fetch(`${API_BASE}/knowledge-base/operations`, {
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, operations: [] }));
  },

  async rollbackOperation(id) {
    return fetch(`${API_BASE}/knowledge-base/operations/${id}/rollback`, {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  // Helper: consume SSE text/event-stream response
  async _consumeSSE(response, onMessage, onComplete) {
    if (!response.ok) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.replace(/^data: /, "").trim();
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === "complete") {
            onComplete && onComplete(data);
          } else {
            onMessage && onMessage(data);
          }
        } catch {
          /* ignore parse errors */
        }
      }
    }
  },
};

export default KnowledgeBase;
