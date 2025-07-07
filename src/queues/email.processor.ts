import { Job } from 'bull';
import { logger } from '../config/logger.config';
import emailService from '../services/email.service';
import { EmailJobData } from '../config/queue.config';

/**
 * Processador de jobs de email
 */
export class EmailProcessor {
  /**
   * Processa job de envio de email
   */
  async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, data, userId } = job.data;
    
    try {
      logger.info('Processing email job', {
        jobId: job.id,
        to,
        subject,
        template,
        userId
      });

      // Atualizar progresso
      await job.progress(10);

      // Enviar email
      const result = await emailService.sendEmail({
        to,
        subject,
        template,
        data
      });

      await job.progress(90);

      if (result.success) {
        logger.info('Email sent successfully', {
          jobId: job.id,
          to,
          messageId: result.messageId
        });
        
        await job.progress(100);
      } else {
        throw new Error(result.error || 'Failed to send email');
      }

    } catch (error) {
      logger.error('Error processing email job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        to,
        subject
      });
      
      throw error;
    }
  }

  /**
   * Handler para job falhou
   */
  async onEmailJobFailed(job: Job<EmailJobData>, error: Error): Promise<void> {
    logger.error('Email job failed', {
      jobId: job.id,
      error: error.message,
      attempts: job.attemptsMade,
      data: job.data
    });

    // Aqui poderia implementar fallback, como salvar na base para reenvio manual
    // ou enviar para dead letter queue
  }

  /**
   * Handler para job completado
   */
  async onEmailJobCompleted(job: Job<EmailJobData>, result: any): Promise<void> {
    logger.info('Email job completed', {
      jobId: job.id,
      result,
      duration: Date.now() - job.timestamp
    });
  }

  /**
   * Handler para job com progresso
   */
  async onEmailJobProgress(job: Job<EmailJobData>, progress: number): Promise<void> {
    logger.debug('Email job progress', {
      jobId: job.id,
      progress
    });
  }
}

export default new EmailProcessor();
