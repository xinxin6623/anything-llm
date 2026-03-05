const path = require("path");
const Graceful = require("@ladjs/graceful");
const Bree = require("@mintplex-labs/bree");
const setLogger = require("../logger");

class BackgroundService {
  name = "BackgroundWorkerService";
  static _instance = null;
  documentSyncEnabled = false;
  #root = path.resolve(__dirname, "../../jobs");

  #alwaysRunJobs = [
    {
      name: "cleanup-orphan-documents",
      timeout: "1m",
      interval: "12hr",
    },
  ];

  #documentSyncJobs = [
    // Job for auto-sync of documents
    // https://github.com/breejs/bree
    {
      name: "sync-watched-documents",
      interval: "1hr",
    },
  ];

  constructor() {
    if (BackgroundService._instance) {
      this.#log("SINGLETON LOCK: Using existing BackgroundService.");
      return BackgroundService._instance;
    }

    this.logger = setLogger();
    BackgroundService._instance = this;
  }

  #log(text, ...args) {
    console.log(`\x1b[36m[${this.name}]\x1b[0m ${text}`, ...args);
  }

  async boot() {
    const { DocumentSyncQueue } = require("../../models/documentSyncQueue");
    this.documentSyncEnabled = await DocumentSyncQueue.enabled();
    const jobsToRun = await this.jobs();

    this.#log("Starting...");
    this.bree = new Bree({
      logger: this.logger,
      root: this.#root,
      jobs: jobsToRun,
      errorHandler: this.onError,
      workerMessageHandler: this.onWorkerMessageHandler,
      runJobsAs: "process",
    });
    this.graceful = new Graceful({ brees: [this.bree], logger: this.logger });
    this.graceful.listen();
    this.bree.start();
    this.#log(
      `Service started with ${jobsToRun.length} jobs`,
      jobsToRun.map((j) => j.name)
    );
  }

  async stop() {
    this.#log("Stopping...");
    if (!!this.graceful && !!this.bree) this.graceful.stopBree(this.bree, 0);
    this.bree = null;
    this.graceful = null;
    this.#log("Service stopped");
  }

  /** @returns {import("@mintplex-labs/bree").Job[]} */
  async jobs() {
    const activeJobs = [...this.#alwaysRunJobs];
    if (this.documentSyncEnabled) activeJobs.push(...this.#documentSyncJobs);
    
    // 添加知识库自动扫描 job（动态配置）
    try {
      const { KBIndexer } = require("../../utils/KnowledgeBase/indexer");
      const scanInterval = await KBIndexer.getConfig("auto_scan_interval");
      
      if (scanInterval && !isNaN(parseInt(scanInterval)) && parseInt(scanInterval) > 0) {
        const intervalMinutes = parseInt(scanInterval);
        const intervalConfig = intervalMinutes <= 5 ? `${intervalMinutes}m` : `${Math.floor(intervalMinutes / 60)}hr`;
        
        activeJobs.push({
          name: "knowledge-base-scan",
          timeout: "1m", // 1分钟后开始第一次扫描
          interval: intervalConfig,
        });
        
        this.#log(`知识库自动扫描已启用: 每 ${intervalMinutes} 分钟`);
      } else {
        this.#log("知识库自动扫描未配置或已禁用");
      }
    } catch (error) {
      this.#log(`加载知识库扫描配置失败: ${error.message}`);
    }
    
    return activeJobs;
  }

  onError(error, _workerMetadata) {
    this.logger.error(`${error.message}`, {
      service: "bg-worker",
      origin: error.name,
    });
  }

  onWorkerMessageHandler(message, _workerMetadata) {
    this.logger.info(`${message.message}`, {
      service: "bg-worker",
      origin: message.name,
    });
  }
}

module.exports.BackgroundService = BackgroundService;
