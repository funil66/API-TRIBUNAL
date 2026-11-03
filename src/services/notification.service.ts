import { AppDataSource } from '../config/database.config';
import { logger } from '../config/logger.config';
import { Notification, NotificationType, NotificationChannel, NotificationStatus } from '../models/notification.entity';
import { Monitor } from '../models/monitor.entity';
import { User } from '../models/user.entity';
import { EmailService } from './email.service';
import { WebhookService } from './webhook.service';
import { queueManager, EmailNotificationJobData, WebhookNotificationJobData } from '../config/queue.config';
import { Repository } from 'typeorm';

export interface CreateNotificationData {
  userId: string;
  monitorId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: any;
  recipient?: any;
  deliveryConfig?: any;
  scheduledFor?: Date;
}

export class NotificationService {
  private notificationRepository: Repository<Notification>;
  private userRepository: Repository<User>;
  private monitorRepository: Repository<Monitor>;
  private emailService: EmailService;
  private webhookService: WebhookService;

  constructor() {
    this.notificationRepository = AppDataSource.getRepository(Notification);
    this.userRepository = AppDataSource.getRepository(User);
    this.monitorRepository = AppDataSource.getRepository(Monitor);
    this.emailService = new EmailService();
    this.webhookService = new WebhookService();
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<Notification> {
    try {
      logger.debug('Creating notification:', { userId: data.userId, type: data.type, channel: data.channel });

      const notification = this.notificationRepository.create(data);
      const savedNotification = await this.notificationRepository.save(notification);

      // Schedule for delivery
      await this.scheduleDelivery(savedNotification);

      logger.info(`Created notification ${savedNotification.id} for user ${data.userId}`);
      return savedNotification;

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notification for new publications found by monitor
   */
  async notifyNewPublications(
    monitor: Monitor,
    publications: any[],
    user?: User
  ): Promise<Notification[]> {
    try {
      const targetUser = user || await this.userRepository.findOne({ 
        where: { id: monitor.userId } 
      });

      if (!targetUser) {
        throw new Error(`User ${monitor.userId} not found`);
      }

      const notifications: Notification[] = [];
      const notificationMethods = this.getNotificationMethods(monitor);

      for (const method of notificationMethods) {
        const notification = await this.createNotification({
          userId: targetUser.id,
          monitorId: monitor.id,
          type: 'new_publication',
          channel: method,
          title: `${publications.length} nova(s) publicação(ões) encontrada(s)`,
          message: this.buildPublicationMessage(monitor, publications),
          data: {
            publications,
            monitorName: monitor.getDisplayName(),
            searchTerm: monitor.searchTerm,
            searchType: monitor.searchType,
          },
          recipient: this.getRecipientConfig(targetUser, monitor, method),
          deliveryConfig: this.getDeliveryConfig(monitor, method),
        });

        notifications.push(notification);
      }

      // Update monitor notification count
      monitor.notificationCount += notifications.length;
      monitor.lastNotification = new Date();
      await this.monitorRepository.save(monitor);

      logger.info(`Created ${notifications.length} notifications for monitor ${monitor.id}`);
      return notifications;

    } catch (error) {
      logger.error('Error creating publication notifications:', error);
      throw error;
    }
  }

  /**
   * Create notification for monitor errors
   */
  async notifyMonitorError(
    monitor: Monitor,
    error: Error,
    user?: User
  ): Promise<Notification> {
    try {
      const targetUser = user || await this.userRepository.findOne({ 
        where: { id: monitor.userId } 
      });

      if (!targetUser) {
        throw new Error(`User ${monitor.userId} not found`);
      }

      const notification = await this.createNotification({
        userId: targetUser.id,
        monitorId: monitor.id,
        type: 'monitor_error',
        channel: 'email', // Always use email for errors
        title: `Erro no monitor: ${monitor.getDisplayName()}`,
        message: `Ocorreu um erro ao executar o monitor "${monitor.getDisplayName()}":\n\n${error.message}`,
        data: {
          errorDetails: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
          },
          monitorName: monitor.getDisplayName(),
          monitorId: monitor.id,
        },
        recipient: { email: targetUser.email },
        deliveryConfig: { 
          priority: 'high', 
          template: 'monitor_error',
        },
      });

      logger.info(`Created error notification for monitor ${monitor.id}`);
      return notification;

    } catch (error) {
      logger.error('Error creating monitor error notification:', error);
      throw error;
    }
  }

  /**
   * Process email notification (called by queue processor)
   */
  async processEmailNotification(jobData: EmailNotificationJobData): Promise<void> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: jobData.notificationId }
      });

      if (!notification) {
        throw new Error(`Notification ${jobData.notificationId} not found`);
      }

      if (notification.status !== 'pending') {
        logger.warn(`Notification ${notification.id} is not pending, skipping`);
        return;
      }

      notification.attempts++;
      await this.notificationRepository.save(notification);

      const result = await this.emailService.sendNotificationEmail({
        to: jobData.email,
        subject: jobData.subject,
        template: jobData.template,
        data: jobData.data,
      });

      notification.markAsSent(result);
      await this.notificationRepository.save(notification);

      logger.info(`Email notification ${notification.id} sent successfully`);

    } catch (error) {
      logger.error('Error processing email notification:', error);
      
      const notification = await this.notificationRepository.findOne({
        where: { id: jobData.notificationId }
      });

      if (notification) {
        notification.markAsFailed(error as Error);
        await this.notificationRepository.save(notification);

        // Schedule retry if possible
        if (notification.canRetry()) {
          const retryDelay = notification.getRetryDelay();
          notification.scheduleRetry(retryDelay);
          await this.notificationRepository.save(notification);
          await this.scheduleDelivery(notification);
          
          logger.info(`Scheduled retry for notification ${notification.id} in ${retryDelay} minutes`);
        }
      }

      throw error;
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: NotificationStatus;
      type?: NotificationType;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number; page: number; totalPages: number }> {
    try {
      const { page = 1, limit = 20, status, type, unreadOnly } = options;
      const skip = (page - 1) * limit;

      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .orderBy('notification.createdAt', 'DESC');

      if (status) {
        queryBuilder.andWhere('notification.status = :status', { status });
      }

      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }

      if (unreadOnly) {
        queryBuilder.andWhere('notification.isRead = false');
      }

      const [notifications, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return { notifications, total, page, totalPages };

    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationRepository.update(
        { id: notificationId, userId },
        { isRead: true }
      );

      if (result.affected === 0) {
        throw new Error('Notification not found or not owned by user');
      }

      logger.debug(`Marked notification ${notificationId} as read`);

    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    try {
      const stats = await this.notificationRepository
        .createQueryBuilder('notification')
        .select([
          'COUNT(*) as total',
          'SUM(CASE WHEN notification.isRead = false THEN 1 ELSE 0 END) as unread',
        ])
        .where('notification.userId = :userId', { userId })
        .getRawOne();

      const byType = await this.notificationRepository
        .createQueryBuilder('notification')
        .select('notification.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('notification.userId = :userId', { userId })
        .groupBy('notification.type')
        .getRawMany();

      const byStatus = await this.notificationRepository
        .createQueryBuilder('notification')
        .select('notification.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('notification.userId = :userId', { userId })
        .groupBy('notification.status')
        .getRawMany();

      return {
        total: parseInt(stats.total) || 0,
        unread: parseInt(stats.unread) || 0,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
      };

    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw error;
    }
  }

  // Helper methods
  private async scheduleDelivery(notification: Notification): Promise<void> {
    try {
      const priority = notification.isUrgent() ? 'high' : 'normal';
      const delay = notification.scheduledFor 
        ? notification.scheduledFor.getTime() - Date.now()
        : 0;

      switch (notification.channel) {
        case 'email':
          await queueManager.addJob('EMAIL_NOTIFICATION', {
            userId: notification.userId,
            notificationId: notification.id,
            email: notification.recipient?.email,
            subject: notification.title,
            template: notification.deliveryConfig?.template || 'default',
            data: notification.data || {},
            priority,
          } as EmailNotificationJobData, {
            delay: Math.max(0, delay),
            priority: priority === 'high' ? 1 : 5,
          });
          break;

        case 'webhook':
          await queueManager.addJob('WEBHOOK_NOTIFICATION', {
            userId: notification.userId,
            webhookId: notification.id,
            url: notification.recipient?.webhookUrl,
            method: 'POST',
            headers: notification.deliveryConfig?.headers || {},
            payload: {
              notification: notification.toSummary(),
              data: notification.data,
            },
          } as WebhookNotificationJobData, {
            delay: Math.max(0, delay),
            priority: priority === 'high' ? 1 : 5,
          });
          break;

        default:
          logger.warn(`Unsupported notification channel: ${notification.channel}`);
      }

      logger.debug(`Scheduled ${notification.channel} notification ${notification.id} for delivery`);

    } catch (error) {
      logger.error('Error scheduling notification delivery:', error);
      throw error;
    }
  }

  private getNotificationMethods(monitor: Monitor): NotificationChannel[] {
    const methods: NotificationChannel[] = [];

    if (monitor.notificationMethod === 'email' || monitor.notificationMethod === 'both') {
      if (monitor.emailConfig?.enabled !== false) {
        methods.push('email');
      }
    }

    if (monitor.notificationMethod === 'webhook' || monitor.notificationMethod === 'both') {
      if (monitor.webhookConfig?.enabled !== false) {
        methods.push('webhook');
      }
    }

    return methods.length > 0 ? methods : ['email']; // Default to email
  }

  private getRecipientConfig(user: User, monitor: Monitor, method: NotificationChannel): any {
    switch (method) {
      case 'email':
        return {
          email: monitor.emailConfig?.recipients?.[0] || user.email,
        };
      case 'webhook':
        return {
          webhookUrl: monitor.webhookConfig?.url,
        };
      default:
        return {};
    }
  }

  private getDeliveryConfig(monitor: Monitor, method: NotificationChannel): any {
    const baseConfig = {
      priority: 'normal' as const,
      retryAttempts: 3,
      retryDelay: 5,
    };

    switch (method) {
      case 'email':
        return {
          ...baseConfig,
          template: monitor.emailConfig?.template || 'new_publications',
        };
      case 'webhook':
        return {
          ...baseConfig,
          headers: {
            'Content-Type': 'application/json',
            ...(monitor.webhookConfig?.headers || {}),
            ...(monitor.webhookConfig?.authToken && {
              'Authorization': `Bearer ${monitor.webhookConfig.authToken}`
            }),
          },
        };
      default:
        return baseConfig;
    }
  }

  private buildPublicationMessage(monitor: Monitor, publications: any[]): string {
    const count = publications.length;
    const searchInfo = `${monitor.searchType.toUpperCase()}: ${monitor.searchTerm}`;
    
    let message = `Foram encontradas ${count} nova(s) publicação(ões) para o monitor "${monitor.getDisplayName()}".\n\n`;
    message += `Critério de busca: ${searchInfo}\n`;
    message += `Tribunais: ${monitor.tribunals.join(', ')}\n\n`;

    if (count <= 5) {
      message += 'Publicações encontradas:\n';
      publications.forEach((pub, index) => {
        message += `${index + 1}. ${pub.title || 'Publicação'}\n`;
        message += `   Tribunal: ${pub.tribunal}\n`;
        message += `   Data: ${pub.publishDate}\n`;
        if (pub.url) {
          message += `   Link: ${pub.url}\n`;
        }
        message += '\n';
      });
    } else {
      message += `Primeiras 3 publicações:\n`;
      publications.slice(0, 3).forEach((pub, index) => {
        message += `${index + 1}. ${pub.title || 'Publicação'} (${pub.tribunal})\n`;
      });
      message += `\n... e mais ${count - 3} publicações.\n\n`;
    }

    message += 'Acesse o sistema para ver todos os detalhes.';
    return message;
  }
}