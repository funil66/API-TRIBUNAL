import crypto from 'crypto';
import { logger } from '../config/logger.config';
import { ApiKey, ApiKeyStatus, ApiKeyTier } from '../models/api-key.entity';

export interface CreateApiKeyRequest {
  name: string;
  tier?: ApiKeyTier;
  expiresAt?: Date;
  allowedEndpoints?: string[];
  allowedIps?: string[];
  allowedDomains?: string[];
  metadata?: Record<string, any>;
}

export interface ApiKeyUsageStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  remainingRequests: {
    day: number;
    month: number;
  };
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: ApiKey;
  error?: string;
  remainingRequests?: {
    minute: number;
    day: number;
    month: number;
  };
}

export class ApiKeyService {
  /**
   * Gera uma nova API key
   */
  generateApiKey(tier: ApiKeyTier = ApiKeyTier.FREE): {
    key: string;
    hash: string;
    prefix: string;
  } {
    const prefix = this.generatePrefix(tier);
    const randomBytes = crypto.randomBytes(32);
    const key = `${prefix}_${randomBytes.toString('hex')}`;
    const hash = this.hashApiKey(key);

    return { key, hash, prefix };
  }

  /**
   * Gera prefixo baseado no tier
   */
  private generatePrefix(tier: ApiKeyTier): string {
    const env = process.env.NODE_ENV || 'dev';
    const envPrefix = env === 'production' ? 'live' : 'test';
    
    switch (tier) {
      case ApiKeyTier.FREE:
        return `ls_${envPrefix}_free`;
      case ApiKeyTier.BASIC:
        return `ls_${envPrefix}_basic`;
      case ApiKeyTier.PREMIUM:
        return `ls_${envPrefix}_premium`;
      case ApiKeyTier.ENTERPRISE:
        return `ls_${envPrefix}_ent`;
      default:
        return `ls_${envPrefix}_free`;
    }
  }

  /**
   * Cria hash da API key para armazenamento seguro
   */
  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Cria nova API key
   */
  async createApiKey(userId: string, request: CreateApiKeyRequest): Promise<{
    apiKey: ApiKey;
    key: string; // A key real só é retornada na criação
  }> {
    try {
      const { key, hash, prefix } = this.generateApiKey(request.tier);
      const tierLimits = ApiKey.getTierLimits(request.tier || ApiKeyTier.FREE);

      // Mock implementation - seria criado no banco
      const apiKey: ApiKey = {
        id: `api_${Date.now()}`,
        key_hash: hash,
        name: request.name,
        prefix,
        user_id: userId,
        user: null as any,
        status: ApiKeyStatus.ACTIVE,
        tier: request.tier || ApiKeyTier.FREE,
        rate_limit_per_minute: tierLimits.rateLimitPerMinute,
        rate_limit_per_day: tierLimits.rateLimitPerDay,
        rate_limit_per_month: tierLimits.rateLimitPerMonth,
        total_requests: 0,
        requests_today: 0,
        requests_this_month: 0,
        last_used_at: null,
        last_used_ip: null,
        allowed_endpoints: request.allowedEndpoints || [],
        allowed_ips: request.allowedIps || [],
        allowed_domains: request.allowedDomains || [],
        expires_at: request.expiresAt || null,
        metadata: request.metadata || null,
        created_at: new Date(),
        updated_at: new Date(),
        get is_active() { return this.status === ApiKeyStatus.ACTIVE && (!this.expires_at || this.expires_at > new Date()); },
        get is_expired() { return this.expires_at && this.expires_at <= new Date(); },
        get is_rate_limited() { return false; }, // Implementação simplificada
        get display_key() { return `${this.prefix}...${this.key_hash.slice(-4)}`; },
        incrementUsage() { this.total_requests++; this.requests_today++; this.requests_this_month++; this.last_used_at = new Date(); },
        resetDailyUsage() { this.requests_today = 0; },
        resetMonthlyUsage() { this.requests_this_month = 0; },
        isEndpointAllowed(endpoint: string) { return true; },
        isIpAllowed(ip: string) { return true; },
        isDomainAllowed(domain: string) { return true; },
        getRemainingRequests() { return { minute: 100, day: 100, month: 1000 }; }
      };

      logger.info('API key created', {
        userId,
        apiKeyId: apiKey.id,
        name: request.name,
        tier: request.tier
      });

      return { apiKey, key };
    } catch (error) {
      logger.error('Error creating API key', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Valida API key
   */
  async validateApiKey(key: string, ip?: string, endpoint?: string): Promise<ApiKeyValidationResult> {
    try {
      if (!key) {
        return { isValid: false, error: 'API key is required' };
      }

      const hash = this.hashApiKey(key);
      
      // Mock implementation - seria buscado no banco
      const apiKey = await this.findApiKeyByHash(hash);

      if (!apiKey) {
        logger.warn('Invalid API key attempted', { keyHash: hash.slice(0, 8), ip });
        return { isValid: false, error: 'Invalid API key' };
      }

      // Verificar se está ativa
      if (!apiKey.is_active) {
        return { isValid: false, error: 'API key is inactive or expired' };
      }

      // Verificar IP se configurado
      if (ip && !apiKey.isIpAllowed(ip)) {
        logger.warn('API key used from unauthorized IP', {
          apiKeyId: apiKey.id,
          ip,
          allowedIps: apiKey.allowed_ips
        });
        return { isValid: false, error: 'IP not allowed' };
      }

      // Verificar endpoint se configurado
      if (endpoint && !apiKey.isEndpointAllowed(endpoint)) {
        return { isValid: false, error: 'Endpoint not allowed' };
      }

      // Verificar rate limiting
      if (apiKey.is_rate_limited) {
        return { 
          isValid: false, 
          error: 'Rate limit exceeded',
          remainingRequests: apiKey.getRemainingRequests()
        };
      }

      // Atualizar usage
      apiKey.incrementUsage();
      if (ip) apiKey.last_used_ip = ip;

      // Mock save - seria salvo no banco
      await this.updateApiKeyUsage(apiKey);

      logger.debug('API key validated successfully', {
        apiKeyId: apiKey.id,
        userId: apiKey.user_id,
        ip,
        endpoint
      });

      return {
        isValid: true,
        apiKey,
        remainingRequests: apiKey.getRemainingRequests()
      };
    } catch (error) {
      logger.error('Error validating API key', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { isValid: false, error: 'Validation error' };
    }
  }

  /**
   * Lista API keys do usuário
   */
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    try {
      // Mock implementation
      const apiKeys: ApiKey[] = [];
      
      logger.info('Retrieved user API keys', {
        userId,
        count: apiKeys.length
      });

      return apiKeys;
    } catch (error) {
      logger.error('Error getting user API keys', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Busca API key por ID
   */
  async getApiKeyById(id: string, userId: string): Promise<ApiKey | null> {
    try {
      // Mock implementation
      return null;
    } catch (error) {
      logger.error('Error getting API key by ID', {
        id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Atualiza API key
   */
  async updateApiKey(id: string, userId: string, updates: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    try {
      // Mock implementation
      const apiKey = await this.getApiKeyById(id, userId);
      
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Aplicar updates
      Object.assign(apiKey, updates);

      logger.info('API key updated', {
        apiKeyId: id,
        userId,
        updates: Object.keys(updates)
      });

      return apiKey;
    } catch (error) {
      logger.error('Error updating API key', {
        id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Revoga API key
   */
  async revokeApiKey(id: string, userId: string): Promise<void> {
    try {
      const apiKey = await this.getApiKeyById(id, userId);
      
      if (!apiKey) {
        throw new Error('API key not found');
      }

      apiKey.status = ApiKeyStatus.REVOKED;

      logger.info('API key revoked', {
        apiKeyId: id,
        userId
      });
    } catch (error) {
      logger.error('Error revoking API key', {
        id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Busca estatísticas de uso da API key
   */
  async getApiKeyStats(id: string, userId: string): Promise<ApiKeyUsageStats> {
    try {
      const apiKey = await this.getApiKeyById(id, userId);
      
      if (!apiKey) {
        throw new Error('API key not found');
      }

      return {
        totalRequests: apiKey.total_requests,
        requestsToday: apiKey.requests_today,
        requestsThisMonth: apiKey.requests_this_month,
        lastUsedAt: apiKey.last_used_at,
        lastUsedIp: apiKey.last_used_ip,
        remainingRequests: {
          day: apiKey.getRemainingRequests().day,
          month: apiKey.getRemainingRequests().month
        }
      };
    } catch (error) {
      logger.error('Error getting API key stats', {
        id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Regenera API key
   */
  async regenerateApiKey(id: string, userId: string): Promise<{
    apiKey: ApiKey;
    key: string;
  }> {
    try {
      const apiKey = await this.getApiKeyById(id, userId);
      
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const { key, hash } = this.generateApiKey(apiKey.tier);
      apiKey.key_hash = hash;
      apiKey.updated_at = new Date();

      logger.info('API key regenerated', {
        apiKeyId: id,
        userId
      });

      return { apiKey, key };
    } catch (error) {
      logger.error('Error regenerating API key', {
        id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Helper methods
  private async findApiKeyByHash(hash: string): Promise<ApiKey | null> {
    // Mock implementation - seria implementado com repository
    return null;
  }

  private async updateApiKeyUsage(apiKey: ApiKey): Promise<void> {
    // Mock implementation - seria implementado com repository
  }

  /**
   * Reset diário de contadores (executado via cron)
   */
  async resetDailyCounters(): Promise<void> {
    try {
      // Mock implementation - resetaria contadores diários de todas as keys
      logger.info('Daily API key counters reset');
    } catch (error) {
      logger.error('Error resetting daily counters', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reset mensal de contadores (executado via cron)
   */
  async resetMonthlyCounters(): Promise<void> {
    try {
      // Mock implementation - resetaria contadores mensais de todas as keys
      logger.info('Monthly API key counters reset');
    } catch (error) {
      logger.error('Error resetting monthly counters', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new ApiKeyService();
