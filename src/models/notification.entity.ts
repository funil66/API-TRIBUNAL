import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Monitor } from './monitor.entity';

export type NotificationType = 'new_publication' | 'monitor_error' | 'system_alert' | 'custom';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type NotificationChannel = 'email' | 'webhook' | 'sms' | 'push';

@Entity('notifications')
@Index(['userId', 'status'])
@Index(['type', 'createdAt'])
@Index(['scheduledFor'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  monitorId?: string;

  @ManyToOne(() => Monitor, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'monitorId' })
  monitor?: Monitor;

  @Column({
    type: 'enum',
    enum: ['new_publication', 'monitor_error', 'system_alert', 'custom'],
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: ['email', 'webhook', 'sms', 'push'],
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: NotificationStatus;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: {
    publications?: any[];
    errorDetails?: any;
    actionUrl?: string;
    templateVars?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  recipient?: {
    email?: string;
    webhookUrl?: string;
    phone?: string;
    deviceToken?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  deliveryConfig?: {
    template?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    retryAttempts?: number;
    retryDelay?: number;
    headers?: Record<string, string>;
  };

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  lastError?: {
    message: string;
    code?: string;
    timestamp: Date;
    attempt: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  deliveryResult?: {
    messageId?: string;
    status?: string;
    response?: any;
    timestamp: Date;
  };

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  canRetry(): boolean {
    return this.attempts < this.maxAttempts && this.status === 'failed';
  }

  shouldSend(): boolean {
    if (this.status !== 'pending') {
      return false;
    }

    if (!this.scheduledFor) {
      return true;
    }

    return new Date() >= this.scheduledFor;
  }

  markAsSent(result?: any): void {
    this.status = 'sent';
    this.sentAt = new Date();
    this.deliveryResult = {
      timestamp: new Date(),
      ...result,
    };
  }

  markAsFailed(error: Error): void {
    this.status = 'failed';
    this.attempts++;
    this.lastError = {
      message: error.message,
      timestamp: new Date(),
      attempt: this.attempts,
    };
  }

  cancel(): void {
    this.status = 'cancelled';
  }

  scheduleRetry(delayMinutes: number = 5): void {
    this.status = 'pending';
    this.scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  getRetryDelay(): number {
    // Exponential backoff: 5, 10, 20 minutes
    const baseDelay = this.deliveryConfig?.retryDelay || 5;
    return baseDelay * Math.pow(2, this.attempts);
  }

  getPriority(): string {
    return this.deliveryConfig?.priority || 'normal';
  }

  isUrgent(): boolean {
    return this.getPriority() === 'urgent';
  }

  isExpired(): boolean {
    if (!this.scheduledFor) {
      return false;
    }

    // Consider expired if scheduled more than 24 hours ago and still pending
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.scheduledFor < oneDayAgo && this.status === 'pending';
  }

  toSummary() {
    return {
      id: this.id,
      type: this.type,
      channel: this.channel,
      status: this.status,
      title: this.title,
      scheduledFor: this.scheduledFor,
      sentAt: this.sentAt,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      canRetry: this.canRetry(),
      isExpired: this.isExpired(),
      priority: this.getPriority(),
      createdAt: this.createdAt,
    };
  }

  toDetail() {
    return {
      ...this.toSummary(),
      message: this.message,
      data: this.data,
      recipient: this.recipient,
      deliveryConfig: this.deliveryConfig,
      lastError: this.lastError,
      deliveryResult: this.deliveryResult,
      isRead: this.isRead,
      isArchived: this.isArchived,
    };
  }
}
