import Bull from 'bull';
import { redisClient } from './redis.config';
import { appConfig } from './app.config';
import { logger } from './logger.config';

// Queue names
export const QUEUE_NAMES = {
  SEARCH_MONITOR: 'search-monitor',
  EMAIL_NOTIFICATION: 'email-notification',
  WEBHOOK_NOTIFICATION: 'webhook-notification',
  PUBLICATION_INDEXING: 'publication-indexing',
  SCRAPING_JOB: 'scraping-job',
} as const;

// Queue configurations
const defaultQueueConfig = {
  redis: {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    password: appConfig.redis.password,
    db: appConfig.redis.db,
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,         // Start with 2 second delay
    },
  },
  settings: {
    stalledInterval: 30 * 1000,    // Check for stalled jobs every 30 seconds
    maxStalledCount: 1,            // Max number of times a job can be stalled
    retryProcessDelay: 5 * 1000,   // Delay before retry processing
  },
};

// Create queues
export const searchMonitorQueue = new Bull(QUEUE_NAMES.SEARCH_MONITOR, defaultQueueConfig);
export const emailNotificationQueue = new Bull(QUEUE_NAMES.EMAIL_NOTIFICATION, defaultQueueConfig);
export const webhookNotificationQueue = new Bull(QUEUE_NAMES.WEBHOOK_NOTIFICATION, defaultQueueConfig);
export const publicationIndexingQueue = new Bull(QUEUE_NAMES.PUBLICATION_INDEXING, defaultQueueConfig);
export const scrapingJobQueue = new Bull(QUEUE_NAMES.SCRAPING_JOB, defaultQueueConfig);

// Job data interfaces
export interface SearchMonitorJobData {
  monitorId: string;
  userId: string;
  searchType: 'name' | 'cpf' | 'oab' | 'process';
  searchTerm: string;
  tribunals: string[];
  lastCheck?: Date;
}

export interface EmailNotificationJobData {
  userId: string;
  notificationId: string;
  email: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface WebhookNotificationJobData {
  userId: string;
  webhookId: string;
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  payload: Record<string, any>;
  retryCount?: number;
}

export interface PublicationIndexingJobData {
  publicationId: string;
  publication: any;
  operation: 'index' | 'update' | 'delete';
}

export interface ScrapingJobData {
  searchId: string;
  userId: string;
  searchType: 'name' | 'cpf' | 'oab' | 'process';
  searchTerm: string;
  sources: string[];
  priority?: 'low' | 'normal' | 'high';
}

// Queue management functions
export class QueueManager {
  private static instance: QueueManager;

  private queues = {
    [QUEUE_NAMES.SEARCH_MONITOR]: searchMonitorQueue,
    [QUEUE_NAMES.EMAIL_NOTIFICATION]: emailNotificationQueue,
    [QUEUE_NAMES.WEBHOOK_NOTIFICATION]: webhookNotificationQueue,
    [QUEUE_NAMES.PUBLICATION_INDEXING]: publicationIndexingQueue,
    [QUEUE_NAMES.SCRAPING_JOB]: scrapingJobQueue,
  };

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize all queues and processors
   */
  async initialize(): Promise<void> {
    logger.info('🔄 Initializing queue system...');

    try {
      // Set up global error handling
      Object.values(this.queues).forEach(queue => {
        queue.on('error', (error) => {
          logger.error(`Queue error in ${queue.name}:`, error);
        });

        queue.on('waiting', (jobId) => {
          logger.debug(`Job ${jobId} is waiting in queue ${queue.name}`);
        });

        queue.on('active', (job) => {
          logger.debug(`Job ${job.id} started in queue ${job.queue.name}`);
        });

        queue.on('completed', (job, result) => {
          logger.debug(`Job ${job.id} completed in queue ${job.queue.name}`);
        });

        queue.on('failed', (job, error) => {
          logger.error(`Job ${job.id} failed in queue ${job.queue.name}:`, error);
        });

        queue.on('stalled', (job) => {
          logger.warn(`Job ${job.id} stalled in queue ${job.queue.name}`);
        });
      });

      logger.info('✅ Queue system initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize queue system:', error);
      throw error;
    }
  }

  /**
   * Add a job to a specific queue
   */
  async addJob<T = any>(
    queueName: keyof typeof QUEUE_NAMES,
    jobData: T,
    options?: Bull.JobOptions
  ): Promise<Bull.Job<T>> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobData, {
      ...defaultQueueConfig.defaultJobOptions,
      ...options,
    });

    logger.debug(`Added job ${job.id} to queue ${queueName}`);
    return job;
  }

  /**
   * Schedule a recurring job
   */
  async scheduleJob<T = any>(
    queueName: keyof typeof QUEUE_NAMES,
    jobName: string,
    jobData: T,
    cronExpression: string,
    options?: Bull.JobOptions
  ): Promise<Bull.Job<T>> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, jobData, {
      repeat: { cron: cronExpression },
      ...options,
    });

    logger.info(`Scheduled recurring job ${jobName} in queue ${queueName} with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: keyof typeof QUEUE_NAMES): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const queueName of Object.keys(QUEUE_NAMES)) {
      try {
        stats[queueName] = await this.getQueueStats(queueName as keyof typeof QUEUE_NAMES);
      } catch (error) {
        logger.error(`Error getting stats for queue ${queueName}:`, error);
        stats[queueName] = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: keyof typeof QUEUE_NAMES): Promise<void> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: keyof typeof QUEUE_NAMES): Promise<void> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  /**
   * Clean completed jobs from a queue
   */
  async cleanQueue(
    queueName: keyof typeof QUEUE_NAMES,
    olderThan: number = 24 * 60 * 60 * 1000, // 24 hours
    limit: number = 100
  ): Promise<number> {
    const queue = this.queues[QUEUE_NAMES[queueName]];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleanedJobs = await queue.clean(olderThan, 'completed', limit);
    logger.info(`Cleaned ${cleanedJobs.length} completed jobs from queue ${queueName}`);
    
    return cleanedJobs.length;
  }

  /**
   * Gracefully close all queues
   */
  async close(): Promise<void> {
    logger.info('🔄 Closing queue system...');

    try {
      await Promise.all(
        Object.values(this.queues).map(queue => queue.close())
      );
      logger.info('✅ Queue system closed successfully');
    } catch (error) {
      logger.error('❌ Error closing queue system:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const queueManager = QueueManager.getInstance();
