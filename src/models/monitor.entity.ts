import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IsString, IsBoolean, IsArray, IsEnum, IsOptional } from 'class-validator';
import { User } from './user.entity';
import { SearchType } from './search.entity';

export type MonitorStatus = 'active' | 'paused' | 'stopped';
export type NotificationMethod = 'email' | 'webhook' | 'both';

@Entity('monitors')
@Index(['userId', 'status'])
@Index(['nextCheck'])
@Index(['searchType', 'searchTerm'])
export class Monitor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({
    type: 'enum',
    enum: SearchType,
  })
  @IsEnum(SearchType)
  searchType: SearchType;

  @Column({ type: 'varchar', length: 500 })
  @IsString()
  @Index()
  searchTerm: string;

  @Column({ type: 'simple-array' })
  @IsArray()
  tribunals: string[];

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'stopped'],
    default: 'active',
  })
  @IsEnum(['active', 'paused', 'stopped'])
  status: MonitorStatus;

  @Column({
    type: 'enum',
    enum: ['email', 'webhook', 'both'],
    default: 'email',
  })
  @IsEnum(['email', 'webhook', 'both'])
  notificationMethod: NotificationMethod;

  @Column({ type: 'jsonb', nullable: true })
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    categories?: string[];
    keywords?: string[];
    excludeKeywords?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  emailConfig?: {
    enabled: boolean;
    recipients?: string[];
    subject?: string;
    template?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  webhookConfig?: {
    enabled: boolean;
    url: string;
    method: 'POST' | 'PUT';
    headers?: Record<string, string>;
    authToken?: string;
  };

  @Column({ type: 'timestamp', nullable: true })
  lastCheck?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextCheck?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastNotification?: Date;

  @Column({ type: 'int', default: 0 })
  notificationCount: number;

  @Column({ type: 'int', default: 0 })
  checksPerformed: number;

  @Column({ type: 'int', default: 0 })
  totalMatches: number;

  @Column({ type: 'int', default: 0 })
  newMatchesLastCheck: number;

  @Column({ type: 'timestamp', nullable: true })
  lastMatchFound?: Date;

  @Column({ type: 'jsonb', nullable: true })
  lastError?: {
    message: string;
    timestamp: Date;
    stack?: string;
  };

  @Column({ type: 'int', default: 15 })
  checkIntervalMinutes: number;

  @Column({ type: 'boolean', default: true })
  @IsBoolean()
  active: boolean;

  @Column({ type: 'boolean', default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.monitors)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Helper methods
  shouldCheck(): boolean {
    if (!this.isActive || this.status !== 'active') {
      return false;
    }

    if (!this.nextCheck) {
      return true;
    }

    return new Date() >= this.nextCheck;
  }

  calculateNextCheck(): Date {
    const now = new Date();
    return new Date(now.getTime() + this.checkIntervalMinutes * 60 * 1000);
  }

  updateCheckSchedule(): void {
    this.lastCheck = new Date();
    this.nextCheck = this.calculateNextCheck();
    this.checksPerformed++;
  }

  recordMatches(count: number): void {
    this.newMatchesLastCheck = count;
    this.totalMatches += count;
    
    if (count > 0) {
      this.lastMatchFound = new Date();
    }
  }

  recordError(error: Error): void {
    this.lastError = {
      message: error.message,
      timestamp: new Date(),
      stack: error.stack,
    };
  }

  pause(): void {
    this.status = 'paused';
    this.nextCheck = null;
  }

  resume(): void {
    this.status = 'active';
    this.nextCheck = this.calculateNextCheck();
  }

  stop(): void {
    this.status = 'stopped';
    this.isActive = false;
    this.nextCheck = null;
  }

  getDisplayName(): string {
    return this.name || `${this.searchType.toUpperCase()}: ${this.searchTerm}`;
  }

  isHealthy(): boolean {
    // Consider monitor unhealthy if it has recent errors or hasn't checked in a while
    if (this.lastError) {
      const errorAge = Date.now() - new Date(this.lastError.timestamp).getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (errorAge < oneHour) {
        return false;
      }
    }

    if (this.lastCheck) {
      const checkAge = Date.now() - this.lastCheck.getTime();
      const expectedInterval = this.checkIntervalMinutes * 60 * 1000;
      
      // Allow some buffer (2x the interval)
      if (checkAge > expectedInterval * 2) {
        return false;
      }
    }

    return true;
  }

  getStats() {
    const runtime = this.createdAt ? Date.now() - this.createdAt.getTime() : 0;
    const runtimeDays = Math.floor(runtime / (24 * 60 * 60 * 1000));
    
    return {
      id: this.id,
      name: this.getDisplayName(),
      status: this.status,
      isHealthy: this.isHealthy(),
      checksPerformed: this.checksPerformed,
      totalMatches: this.totalMatches,
      newMatchesLastCheck: this.newMatchesLastCheck,
      lastCheck: this.lastCheck,
      nextCheck: this.nextCheck,
      lastMatchFound: this.lastMatchFound,
      runtimeDays,
      averageMatchesPerDay: runtimeDays > 0 ? (this.totalMatches / runtimeDays).toFixed(2) : '0',
    };
  }
}
