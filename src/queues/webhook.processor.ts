import { logger } from '../config/logger.config';
import webhookService from '../services/webhook.service';

export interface WebhookJobData {
  config: {
    url: string;
    headers?: Record<string, string>;
    secret?: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  };
  payload: {
    event: string;
    data: any;
    timestamp: Date;
    id: string;
    user_id: string;
  };
  notificationId?: string;
}

/**
 * Processador de jobs de webhook
 */
export class WebhookProcessor {
  /**
   * Processa job de webhook
   */
  async processWebhookJob(jobData: WebhookJobData): Promise<void> {
    const { config, payload, notificationId } = jobData;
    
    try {
      logger.info('Processing webhook job', {
        url: config.url,
        event: payload.event,
        notificationId
      });

      // Enviar webhook
      const result = await webhookService.sendWebhook(config, payload);

      if (result.success) {
        logger.info('Webhook sent successfully', {
          url: config.url,
          attempts: result.attempts,
          totalDuration: result.totalDuration
        });
      } else {
        throw new Error(result.lastError || 'Failed to send webhook');
      }

    } catch (error) {
      logger.error('Error processing webhook job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: config.url,
        event: payload.event
      });
      
      throw error;
    }
  }

  /**
   * Handler para job falhou
   */
  async onWebhookJobFailed(jobData: WebhookJobData, error: Error): Promise<void> {
    logger.error('Webhook job failed', {
      error: error.message,
      url: jobData.config.url,
      event: jobData.payload.event
    });
  }

  /**
   * Handler para job completado
   */
  async onWebhookJobCompleted(jobData: WebhookJobData, result: any): Promise<void> {
    logger.info('Webhook job completed', {
      url: jobData.config.url,
      event: jobData.payload.event,
      result
    });
  }
}

export default new WebhookProcessor();
