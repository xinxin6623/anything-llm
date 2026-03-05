const path = require("path");
const { KBIndexer } = require("./indexer");
const { scanDirectories, SUPPORTED_EXTENSIONS } = require("./scanner");

let watcherInstance = null;
let isWatching = false;
const logger = console;

class KBWatcher {
  constructor() {
    this.watchers = new Map(); // dirPath -> chokidar watcher
    this.debounceTimers = new Map(); // filePath -> timer
    this.debounceDelay = 2000; // 2秒防抖
  }

  /**
   * 开始监听目录
   */
  async start() {
    if (isWatching) {
      logger.log("[KBWatcher] 已经在监听中");
      return;
    }

    try {
      const watchDir = await KBIndexer.getConfig("watch_dir");
      const storageDir = await KBIndexer.getConfig("storage_dir");

      if (!watchDir && !storageDir) {
        logger.log("[KBWatcher] 未配置监听目录和存储目录，跳过监听");
        return;
      }

      const dirsToWatch = new Set();
      if (watchDir) dirsToWatch.add(watchDir);
      if (storageDir) dirsToWatch.add(storageDir);

      logger.log(`[KBWatcher] 开始监听 ${dirsToWatch.size} 个目录...`);

      // 动态导入 chokidar（避免在不需要时加载）
      const chokidar = require("chokidar");

      for (const dir of dirsToWatch) {
        if (!dir || this.watchers.has(dir)) continue;

        try {
          const watcher = chokidar.watch(dir, {
            persistent: true,
            ignoreInitial: true, // 忽略初始扫描
            awaitWriteFinish: {
              stabilityThreshold: 2000,
              pollInterval: 100,
            },
            depth: 99, // 递归深度
          });

          watcher
            .on("add", (filePath) => this.handleFileChange("add", filePath))
            .on("change", (filePath) => this.handleFileChange("change", filePath))
            .on("unlink", (filePath) => this.handleFileChange("unlink", filePath))
            .on("error", (error) => {
              logger.error(`[KBWatcher] 监听错误 (${dir}):`, error.message);
            })
            .on("ready", () => {
              logger.log(`[KBWatcher] 开始监听: ${dir}`);
            });

          this.watchers.set(dir, watcher);
        } catch (error) {
          logger.error(`[KBWatcher] 无法监听目录 ${dir}:`, error.message);
        }
      }

      isWatching = true;
      logger.log(`[KBWatcher] 监听启动完成，共 ${this.watchers.size} 个监听器`);
    } catch (error) {
      logger.error("[KBWatcher] 启动监听失败:", error.message);
    }
  }

  /**
   * 停止监听
   */
  async stop() {
    if (!isWatching) return;

    logger.log("[KBWatcher] 正在停止监听...");

    for (const [dir, watcher] of this.watchers) {
      try {
        await watcher.close();
        logger.log(`[KBWatcher] 停止监听: ${dir}`);
      } catch (error) {
        logger.error(`[KBWatcher] 停止监听失败 (${dir}):`, error.message);
      }
    }

    // 清除所有防抖定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.watchers.clear();
    isWatching = false;

    logger.log("[KBWatcher] 监听已停止");
  }

  /**
   * 处理文件变更
   */
  async handleFileChange(eventType, filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // 只处理支持的文件类型
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return;
    }

    // 防抖处理
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      await this.processFileChange(eventType, filePath);
    }, this.debounceDelay);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * 实际处理文件变更
   */
  async processFileChange(eventType, filePath) {
    try {
      const fileName = path.basename(filePath);

      switch (eventType) {
        case "add":
          logger.log(`[KBWatcher] 新文件: ${fileName}`);
          await this.scanSingleFile(filePath);
          break;

        case "change":
          logger.log(`[KBWatcher] 文件变更: ${fileName}`);
          await this.scanSingleFile(filePath);
          break;

        case "unlink":
          logger.log(`[KBWatcher] 文件删除: ${fileName}`);
          await this.handleFileDelete(filePath);
          break;
      }
    } catch (error) {
      logger.error(`[KBWatcher] 处理文件变更失败 (${filePath}):`, error.message);
    }
  }

  /**
   * 扫描单个文件
   */
  async scanSingleFile(filePath) {
    try {
      // 使用现有的扫描器处理单个文件
      const result = await scanDirectories([path.dirname(filePath)]);

      if (result.added > 0) {
        logger.log(`[KBWatcher] 文件已添加到索引: ${path.basename(filePath)}`);
      } else if (result.updated > 0) {
        logger.log(`[KBWatcher] 文件索引已更新: ${path.basename(filePath)}`);
      }
    } catch (error) {
      logger.error(`[KBWatcher] 扫描文件失败 (${filePath}):`, error.message);
    }
  }

  /**
   * 处理文件删除
   */
  async handleFileDelete(filePath) {
    try {
      // 从索引中删除文件记录
      const existing = await KBIndexer.getFileByPath(filePath);
      if (existing) {
        await KBIndexer.deleteFile(existing.id);
        logger.log(`[KBWatcher] 文件已从索引移除: ${path.basename(filePath)}`);
      }
    } catch (error) {
      logger.error(`[KBWatcher] 删除文件索引失败 (${filePath}):`, error.message);
    }
  }

  /**
   * 重启监听（配置变更时调用）
   */
  async restart() {
    logger.log("[KBWatcher] 重启监听...");
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.start();
  }

  /**
   * 获取监听状态
   */
  getStatus() {
    return {
      isWatching,
      watchedDirectories: Array.from(this.watchers.keys()),
      watcherCount: this.watchers.size,
    };
  }
}

// 单例模式
if (!watcherInstance) {
  watcherInstance = new KBWatcher();
}

module.exports = { KBWatcher: watcherInstance };
