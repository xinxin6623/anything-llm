const path = require("path");
const { log, conclude } = require("./helpers/index.js");

// 动态导入 Prisma 和知识库模块
async function runKnowledgeBaseScan() {
  try {
    log("开始执行知识库自动扫描...");

    // 动态导入所需模块（避免在 worker 线程中初始化问题）
    const { KBIndexer } = require("../utils/KnowledgeBase/indexer.js");
    const { scanDirectories } = require("../utils/KnowledgeBase/scanner.js");

    // 获取配置
    const storageDir = await KBIndexer.getConfig("storage_dir");
    const watchDir = await KBIndexer.getConfig("watch_dir");

    if (!storageDir) {
      log("未配置存储目录，跳过扫描");
      return;
    }

    log(`扫描存储目录: ${storageDir}`);
    if (watchDir) {
      log(`扫描监听目录: ${watchDir}`);
    }

    // 收集要扫描的目录
    const directoriesToScan = [storageDir];
    if (watchDir && watchDir !== storageDir) {
      directoriesToScan.push(watchDir);
    }

    // 执行扫描
    const result = await scanDirectories(directoriesToScan, (current, total, filePath) => {
      log(`扫描进度: ${current}/${total} - ${path.basename(filePath)}`);
    });

    log(`扫描完成: 新增 ${result.added} 个, 更新 ${result.updated} 个, 跳过 ${result.skipped} 个`);

    // 如果有新增或更新的文件，可以考虑在这里触发自动分类
    if (result.added > 0 || result.updated > 0) {
      log("发现文件变更，建议进行 AI 分类");
      // 注意：自动分类可以作为可选配置，避免消耗过多 LLM tokens
    }

  } catch (error) {
    log(`知识库扫描出错: ${error.message}`);
    console.error(error);
  }
}

// 立即执行
(async () => {
  try {
    await runKnowledgeBaseScan();
  } catch (e) {
    log(`执行出错: ${e.message}`);
    console.error(e);
  } finally {
    conclude();
  }
})();
