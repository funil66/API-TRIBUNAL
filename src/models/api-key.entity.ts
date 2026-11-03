import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

export enum ApiKeyTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

@Entity('api_keys')
@Index(['key_hash'])
@Index(['user_id', 'status'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  key_hash: string; // Hash da API key para segurança

  @Column({ type: 'varchar', length: 50 })
  name: string; // Nome descritivo da key

  @Column({ type: 'varchar', length: 8 })
  prefix: string; // Prefixo visível (ex: "ls_live_")

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE
  })
  status: ApiKeyStatus;

  @Column({
    type: 'enum',
    enum: ApiKeyTier,
    default: ApiKeyTier.FREE
  })
  tier: ApiKeyTier;

  // Rate limiting settings
  @Column({ type: 'integer', default: 100 })
  rate_limit_per_minute: number;

  @Column({ type: 'integer', default: 1000 })
  rate_limit_per_day: number;

  @Column({ type: 'integer', default: 10000 })
  rate_limit_per_month: number;

  // Usage tracking
  @Column({ type: 'bigint', default: 0 })
  total_requests: number;

  @Column({ type: 'bigint', default: 0 })
  requests_today: number;

  @Column({ type: 'bigint', default: 0 })
  requests_this_month: number;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date;

  @Column({ type: 'inet', nullable: true })
  last_used_ip: string;

  // Permissions
  @Column({ type: 'json', default: [] })
  allowed_endpoints: string[]; // Lista de endpoints permitidos

  @Column({ type: 'json', default: [] })
  allowed_ips: string[]; // IPs permitidos (opcional)

  @Column({ type: 'json', nullable: true })
  allowed_domains: string[]; // Domínios permitidos para CORS

  // Expiration
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Metadados adicionais

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Computed properties
  get is_active(): boolean {
    return this.status === ApiKeyStatus.ACTIVE && 
           (!this.expires_at || this.expires_at > new Date());
  }

  get is_expired(): boolean {
    return this.expires_at && this.expires_at <= new Date();
  }

  get is_rate_limited(): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Check daily limit
    if (this.requests_today >= this.rate_limit_per_day) {
      return true;
    }

    // Check monthly limit
    if (this.requests_this_month >= this.rate_limit_per_month) {
      return true;
    }

    return false;
  }

  get display_key(): string {
    return `${this.prefix}...${this.key_hash.slice(-4)}`;
  }

  // Helper methods
  incrementUsage(): void {
    this.total_requests++;
    this.requests_today++;
    this.requests_this_month++;
    this.last_used_at = new Date();
  }

  resetDailyUsage(): void {
    this.requests_today = 0;
  }

  resetMonthlyUsage(): void {
    this.requests_this_month = 0;
  }

  isEndpointAllowed(endpoint: string): boolean {
    if (!this.allowed_endpoints || this.allowed_endpoints.length === 0) {
      return true; // Se não há restrições, permite tudo
    }
    
    return this.allowed_endpoints.some(pattern => {
      // Suporte para wildcards
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(endpoint);
    });
  }

  isIpAllowed(ip: string): boolean {
    if (!this.allowed_ips || this.allowed_ips.length === 0) {
      return true; // Se não há restrições, permite tudo
    }
    
    return this.allowed_ips.includes(ip);
  }

  isDomainAllowed(domain: string): boolean {
    if (!this.allowed_domains || this.allowed_domains.length === 0) {
      return true; // Se não há restrições, permite tudo
    }
    
    return this.allowed_domains.includes(domain);
  }

  // Rate limiting helpers
  getRemainingRequests(): {
    minute: number;
    day: number;
    month: number;
  } {
    return {
      minute: Math.max(0, this.rate_limit_per_minute), // Precisaria implementar controle por minuto
      day: Math.max(0, this.rate_limit_per_day - this.requests_today),
      month: Math.max(0, this.rate_limit_per_month - this.requests_this_month)
    };
  }

  // Tier-based configuration
  static getTierLimits(tier: ApiKeyTier): {
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    rateLimitPerMonth: number;
  } {
    switch (tier) {
      case ApiKeyTier.FREE:
        return {
          rateLimitPerMinute: 10,
          rateLimitPerDay: 100,
          rateLimitPerMonth: 1000
        };
      case ApiKeyTier.BASIC:
        return {
          rateLimitPerMinute: 50,
          rateLimitPerDay: 1000,
          rateLimitPerMonth: 10000
        };
      case ApiKeyTier.PREMIUM:
        return {
          rateLimitPerMinute: 200,
          rateLimitPerDay: 5000,
          rateLimitPerMonth: 50000
        };
      case ApiKeyTier.ENTERPRISE:
        return {
          rateLimitPerMinute: 1000,
          rateLimitPerDay: 50000,
          rateLimitPerMonth: 500000
        };
      default:
        return ApiKey.getTierLimits(ApiKeyTier.FREE);
    }
  }
}

export default ApiKey;
