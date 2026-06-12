import cron from "node-cron";
import ipfsCleanupService from "./ipfsCleanup.service.js";

/**
 * Background job service for automated cleanup tasks
 */
class CleanupJobService {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start all cleanup jobs
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️  Cleanup jobs already running");
      return;
    }

    console.log("\n🔄 Starting cleanup background jobs...\n");

    // Job 1: IPFS Orphaned Content Cleanup (every 6 hours)
    const ipfsCleanupJob = cron.schedule(
      "0 */6 * * *", // At minute 0 past every 6th hour
      async () => {
        await this.runIPFSCleanup();
      },
      {
        scheduled: true,
        timezone: "UTC",
      },
    );

    this.jobs.push({
      name: "IPFS Orphaned Content Cleanup",
      schedule: "Every 6 hours",
      job: ipfsCleanupJob,
    });

    this.isRunning = true;

    console.log("✅ Cleanup jobs started:");
    this.jobs.forEach((j) => {
      console.log(`   📋 ${j.name} - ${j.schedule}`);
    });
    console.log();
  }

  /**
   * Stop all cleanup jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log("⚠️  Cleanup jobs not running");
      return;
    }

    console.log("\n🛑 Stopping cleanup background jobs...\n");

    this.jobs.forEach((j) => {
      j.job.stop();
      console.log(`   ✓ Stopped: ${j.name}`);
    });

    this.jobs = [];
    this.isRunning = false;

    console.log("\n✅ All cleanup jobs stopped\n");
  }

  /**
   * Run IPFS cleanup job
   */
  async runIPFSCleanup() {
    try {
      console.log("\n🧹 [CRON JOB] Starting IPFS orphaned content cleanup...");
      console.log(`   Time: ${new Date().toISOString()}`);

      const olderThanHours = 24; // Clean content older than 24 hours
      const maxCount = 100; // Process up to 100 items per run

      const result = await ipfsCleanupService.bulkCleanupOrphaned(
        olderThanHours,
        maxCount,
      );

      console.log(`\n✅ [CRON JOB] IPFS cleanup completed:`);
      console.log(`   ✓ Cleaned: ${result.success}`);
      console.log(`   ✗ Failed: ${result.failed}`);
      console.log(`   📊 Total processed: ${result.total}`);
      console.log(`   📦 Remaining: ${result.remaining}`);

      if (result.remaining > 0) {
        console.log(
          `   ⚠️  ${result.remaining} orphaned items remaining (will process in next run)`,
        );
      }

      console.log();
    } catch (error) {
      console.error("\n❌ [CRON JOB] IPFS cleanup failed:", error.message);
      console.error("   Stack:", error.stack);
      console.log();
    }
  }

  /**
   * Manually trigger IPFS cleanup (for testing)
   */
  async triggerIPFSCleanup() {
    console.log("\n🧪 Manually triggering IPFS cleanup job...\n");
    await this.runIPFSCleanup();
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: this.jobs.map((j) => ({
        name: j.name,
        schedule: j.schedule,
        running: j.job.getStatus() === "scheduled",
      })),
    };
  }
}

// Export singleton instance
const cleanupJobService = new CleanupJobService();
export default cleanupJobService;
