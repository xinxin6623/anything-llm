const { getLLMProvider } = require("../helpers");

const CLASSIFY_SYSTEM_PROMPT = `你是一个专业的文档分类助手。
分析用户提供的文档内容片段，返回一个 JSON 对象，包含以下字段：
- category: 一级分类（字符串，中文，5字以内，如：技术文档、财务报表、合同协议、学习笔记、项目资料、个人生活、新闻资讯等）
- sub_category: 二级分类（字符串，中文，5字以内，可为 null）
- summary: 文档摘要（字符串，中文，100字以内）
- keywords: 关键词数组（字符串数组，中文，最多8个词）

只返回 JSON，不要任何其他文字。`;

/**
 * Classify a document using LLM
 * @param {string} content - Document text content (will be truncated)
 * @param {string} fileName - File name as hint
 * @returns {{ category, sub_category, summary, keywords }}
 */
async function classifyDocument(content, fileName = "") {
  const snippet = content.slice(0, 3000); // Only send first 3000 chars to LLM
  const userMsg = `文件名：${fileName}\n\n内容片段：\n${snippet}`;

  try {
    const LLM = getLLMProvider();
    const messages = [
      { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ];

    const response = await LLM.getChatCompletion(messages, {
      temperature: 0.1,
    });

    // Parse JSON from response
    const text =
      typeof response === "string"
        ? response
        : response?.content || response?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM response");

    const result = JSON.parse(jsonMatch[0]);
    return {
      category: result.category || "未分类",
      sub_category: result.sub_category || null,
      summary: result.summary || "",
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
    };
  } catch (err) {
    console.error("[KBClassifier] Classification failed:", err.message);
    return {
      category: "未分类",
      sub_category: null,
      summary: "",
      keywords: [],
    };
  }
}

module.exports = { classifyDocument };
