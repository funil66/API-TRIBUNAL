import { Request, Response } from 'express';
import { logger } from '../config/logger.config';
import notificationService from '../services/notification.service';
import emailService from '../services/email.service';
import webhookService from '../services/webhook.service';

export interface NotificationRequest {
  type: 'email' | 'webhook';
  to?: string; // para email
  url?: string; // para webhook
  event: string;
  data: any;
  schedule?: {
    delay?: number; // ms
    at?: Date; // data específica
  };
}

export interface TestNotificationRequest {
  type: 'email' | 'webhook';
  to?: string;
  url?: string;
  template?: string;
  webhookSecret?: string;
}

/**
 * Controller para gerenciamento de notificações
 */
export class NotificationController {
  /**
   * Lista notificações do usuário
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { 
        page = 1, 
        limit = 10, 
        type, 
        status, 
        startDate, 
        endDate 
      } = req.query;

      logger.info('Getting user notifications', {
        userId,
        page,
        limit,
        type,
        status,
        startDate,
        endDate
      });

      // Mock implementation
      const notifications = [
        {
          id: '1',
          userId,
          type: 'email',
          status: 'delivered',
          subject: 'Nova publicação encontrada',
          createdAt: new Date(Date.now() - 3600000),
          deliveredAt: new Date(Date.now() - 3500000),
          retryCount: 0
        },
        {
          id: '2',
          userId,
          type: 'webhook',
          status: 'failed',
          url: 'https://example.com/webhook',
          createdAt: new Date(Date.now() - 7200000),
          retryCount: 3,
          lastError: 'Connection timeout'
        }
      ];

      const response = {
        data: notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: notifications.length,
          totalPages: Math.ceil(notifications.length / Number(limit))
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get notifications'
      });
    }
  }

  /**
   * Busca notificação por ID
   */
  async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      logger.info('Getting notification by ID', { id, userId });

      // Mock implementation
      const notification = {
        id,
        userId,
        type: 'email',
        status: 'delivered',
        subject: 'Nova publicação encontrada',
        content: 'Foi encontrada uma nova publicação...',
        to: 'user@example.com',
        createdAt: new Date(Date.now() - 3600000),
        deliveredAt: new Date(Date.now() - 3500000),
        retryCount: 0,
        deliveryLogs: [
          {
            timestamp: new Date(Date.now() - 3500000),
            status: 'delivered',
            duration: 1250,
            attempt: 1
          }
        ]
      };

      res.json({ data: notification });
    } catch (error) {
      logger.error('Error getting notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get notification'
      });
    }
  }

  /**
   * Envia notificação imediata
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const notificationData: NotificationRequest = req.body;

      logger.info('Sending notification', {
        userId,
        type: notificationData.type,
        event: notificationData.event
      });

      // Validação básica
      if (!notificationData.type || !notificationData.event) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Type and event are required'
        });
        return;
      }

      if (notificationData.type === 'email' && !notificationData.to) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Email address is required for email notifications'
        });
        return;
      }

      if (notificationData.type === 'webhook' && !notificationData.url) {
        res.status(400).json({
          error: 'Validation error',
          message: 'URL is required for webhook notifications'
        });
        return;
      }

      let result;

      if (notificationData.type === 'email') {
        result = await emailService.sendEmail({
          to: notificationData.to!,
          subject: `Legal Search API - ${notificationData.event}`,
          template: 'generic',
          data: notificationData.data
        });
      } else if (notificationData.type === 'webhook') {
        result = await webhookService.sendWebhook(
          { url: notificationData.url! },
          {
            event: notificationData.event,
            data: notificationData.data,
            timestamp: new Date(),
            id: `notif_${Date.now()}`,
            user_id: userId || 'unknown'
          }
        );
      }

      logger.info('Notification sent', {
        userId,
        type: notificationData.type,
        success: result?.success
      });

      res.json({
        data: {
          id: `notif_${Date.now()}`,
          type: notificationData.type,
          status: result?.success ? 'delivered' : 'failed',
          createdAt: new Date(),
          result
        }
      });
    } catch (error) {
      logger.error('Error sending notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to send notification'
      });
    }
  }

  /**
   * Agenda notificação para envio posterior
   */
  async scheduleNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const notificationData: NotificationRequest = req.body;

      logger.info('Scheduling notification', {
        userId,
        type: notificationData.type,
        event: notificationData.event,
        schedule: notificationData.schedule
      });

      // Validação
      if (!notificationData.schedule?.delay && !notificationData.schedule?.at) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Schedule delay or date is required'
        });
        return;
      }

      // Mock implementation - agenda notificação
      const scheduledNotification = {
        id: `scheduled_${Date.now()}`,
        userId,
        type: notificationData.type,
        status: 'scheduled',
        event: notificationData.event,
        scheduledFor: notificationData.schedule?.at || 
          new Date(Date.now() + (notificationData.schedule?.delay || 0)),
        createdAt: new Date()
      };

      logger.info('Notification scheduled', {
        notificationId: scheduledNotification.id,
        userId,
        scheduledFor: scheduledNotification.scheduledFor
      });

      res.status(201).json({ data: scheduledNotification });
    } catch (error) {
      logger.error('Error scheduling notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to schedule notification'
      });
    }
  }

  /**
   * Cancela notificação agendada
   */
  async cancelNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      logger.info('Cancelling notification', { id, userId });

      // Mock implementation
      logger.info('Notification cancelled', { notificationId: id, userId });

      res.status(204).send();
    } catch (error) {
      logger.error('Error cancelling notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to cancel notification'
      });
    }
  }

  /**
   * Testa notificação (email ou webhook)
   */
  async testNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const testData: TestNotificationRequest = req.body;

      logger.info('Testing notification', {
        userId,
        type: testData.type
      });

      // Validação
      if (!testData.type) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Type is required'
        });
        return;
      }

      let result;

      if (testData.type === 'email') {
        if (!testData.to) {
          res.status(400).json({
            error: 'Validation error',
            message: 'Email address is required'
          });
          return;
        }

        result = await emailService.sendEmail({
          to: testData.to,
          subject: 'Legal Search API - Test Email',
          template: testData.template || 'test',
          data: {
            userName: 'Test User',
            timestamp: new Date()
          }
        });
      } else if (testData.type === 'webhook') {
        if (!testData.url) {
          res.status(400).json({
            error: 'Validation error',
            message: 'URL is required'
          });
          return;
        }

        result = await webhookService.testWebhook(
          { 
            url: testData.url,
            secret: testData.webhookSecret 
          },
          userId || 'test'
        );
      }

      logger.info('Notification test completed', {
        userId,
        type: testData.type,
        success: result?.success
      });

      res.json({
        data: {
          type: testData.type,
          success: result?.success,
          result
        }
      });
    } catch (error) {
      logger.error('Error testing notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to test notification'
      });
    }
  }

  /**
   * Busca estatísticas de notificações
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { period = '7d' } = req.query;

      logger.info('Getting notification stats', { userId, period });

      // Mock implementation
      const stats = {
        period,
        total: 156,
        delivered: 148,
        failed: 8,
        pending: 2,
        deliveryRate: 94.9,
        byType: {
          email: {
            total: 120,
            delivered: 115,
            failed: 5,
            deliveryRate: 95.8
          },
          webhook: {
            total: 36,
            delivered: 33,
            failed: 3,
            deliveryRate: 91.7
          }
        },
        trending: {
          thisWeek: 156,
          lastWeek: 134,
          growth: 16.4
        }
      };

      res.json({ data: stats });
    } catch (error) {
      logger.error('Error getting notification stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get notification stats'
      });
    }
  }
}

export default new NotificationController();
