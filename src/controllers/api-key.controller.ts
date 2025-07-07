import { Request, Response } from 'express';
import { logger } from '../config/logger.config';
import apiKeyService, { CreateApiKeyRequest } from '../services/api-key.service';
import { ApiKeyTier } from '../models/api-key.entity';

/**
 * Controller para gerenciamento de API keys
 */
export class ApiKeyController {
  /**
   * Lista API keys do usuário
   */
  async getApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      logger.info('Getting user API keys', { userId });

      const apiKeys = await apiKeyService.getUserApiKeys(userId);

      // Remover informações sensíveis
      const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        displayKey: key.display_key,
        tier: key.tier,
        status: key.status,
        rateLimits: {
          perMinute: key.rate_limit_per_minute,
          perDay: key.rate_limit_per_day,
          perMonth: key.rate_limit_per_month
        },
        usage: {
          totalRequests: key.total_requests,
          requestsToday: key.requests_today,
          requestsThisMonth: key.requests_this_month
        },
        lastUsedAt: key.last_used_at,
        expiresAt: key.expires_at,
        createdAt: key.created_at,
        isActive: key.is_active
      }));

      res.json({
        data: sanitizedKeys,
        total: sanitizedKeys.length
      });
    } catch (error) {
      logger.error('Error getting API keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get API keys'
      });
    }
  }

  /**
   * Busca API key por ID
   */
  async getApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      logger.info('Getting API key by ID', { id, userId });

      const apiKey = await apiKeyService.getApiKeyById(id, userId);

      if (!apiKey) {
        res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
        return;
      }

      res.json({
        data: {
          id: apiKey.id,
          name: apiKey.name,
          displayKey: apiKey.display_key,
          tier: apiKey.tier,
          status: apiKey.status,
          rateLimits: {
            perMinute: apiKey.rate_limit_per_minute,
            perDay: apiKey.rate_limit_per_day,
            perMonth: apiKey.rate_limit_per_month
          },
          usage: {
            totalRequests: apiKey.total_requests,
            requestsToday: apiKey.requests_today,
            requestsThisMonth: apiKey.requests_this_month,
            lastUsedAt: apiKey.last_used_at,
            lastUsedIp: apiKey.last_used_ip
          },
          permissions: {
            allowedEndpoints: apiKey.allowed_endpoints,
            allowedIps: apiKey.allowed_ips,
            allowedDomains: apiKey.allowed_domains
          },
          expiresAt: apiKey.expires_at,
          createdAt: apiKey.created_at,
          updatedAt: apiKey.updated_at,
          isActive: apiKey.is_active,
          remainingRequests: apiKey.getRemainingRequests()
        }
      });
    } catch (error) {
      logger.error('Error getting API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get API key'
      });
    }
  }

  /**
   * Cria nova API key
   */
  async createApiKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const createRequest: CreateApiKeyRequest = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      // Validação básica
      if (!createRequest.name || createRequest.name.trim().length === 0) {
        res.status(400).json({
          error: 'Validation error',
          message: 'API key name is required'
        });
        return;
      }

      if (createRequest.name.length > 50) {
        res.status(400).json({
          error: 'Validation error',
          message: 'API key name must be less than 50 characters'
        });
        return;
      }

      // Validar tier se especificado
      if (createRequest.tier && !Object.values(ApiKeyTier).includes(createRequest.tier)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid API key tier'
        });
        return;
      }

      logger.info('Creating new API key', {
        userId,
        name: createRequest.name,
        tier: createRequest.tier
      });

      const { apiKey, key } = await apiKeyService.createApiKey(userId, createRequest);

      logger.info('API key created successfully', {
        apiKeyId: apiKey.id,
        userId,
        name: apiKey.name
      });

      res.status(201).json({
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key, // A key completa só é mostrada na criação
          displayKey: apiKey.display_key,
          tier: apiKey.tier,
          status: apiKey.status,
          rateLimits: {
            perMinute: apiKey.rate_limit_per_minute,
            perDay: apiKey.rate_limit_per_day,
            perMonth: apiKey.rate_limit_per_month
          },
          expiresAt: apiKey.expires_at,
          createdAt: apiKey.created_at
        },
        message: 'API key created successfully. Save this key securely as it won\'t be shown again.'
      });
    } catch (error) {
      logger.error('Error creating API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create API key'
      });
    }
  }

  /**
   * Atualiza API key
   */
  async updateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updates: Partial<CreateApiKeyRequest> = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      // Validações
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          res.status(400).json({
            error: 'Validation error',
            message: 'API key name cannot be empty'
          });
          return;
        }

        if (updates.name.length > 50) {
          res.status(400).json({
            error: 'Validation error',
            message: 'API key name must be less than 50 characters'
          });
          return;
        }
      }

      logger.info('Updating API key', { id, userId, updates: Object.keys(updates) });

      const apiKey = await apiKeyService.updateApiKey(id, userId, updates);

      logger.info('API key updated successfully', {
        apiKeyId: id,
        userId
      });

      res.json({
        data: {
          id: apiKey.id,
          name: apiKey.name,
          displayKey: apiKey.display_key,
          tier: apiKey.tier,
          status: apiKey.status,
          permissions: {
            allowedEndpoints: apiKey.allowed_endpoints,
            allowedIps: apiKey.allowed_ips,
            allowedDomains: apiKey.allowed_domains
          },
          expiresAt: apiKey.expires_at,
          updatedAt: apiKey.updated_at
        }
      });
    } catch (error) {
      logger.error('Error updating API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId: req.params.id
      });

      if (error instanceof Error && error.message === 'API key not found') {
        res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update API key'
        });
      }
    }
  }

  /**
   * Regenera API key
   */
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      logger.info('Regenerating API key', { id, userId });

      const { apiKey, key } = await apiKeyService.regenerateApiKey(id, userId);

      logger.info('API key regenerated successfully', {
        apiKeyId: id,
        userId
      });

      res.json({
        data: {
          id: apiKey.id,
          key, // Nova key
          displayKey: apiKey.display_key,
          updatedAt: apiKey.updated_at
        },
        message: 'API key regenerated successfully. Update your applications with the new key.'
      });
    } catch (error) {
      logger.error('Error regenerating API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId: req.params.id
      });

      if (error instanceof Error && error.message === 'API key not found') {
        res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to regenerate API key'
        });
      }
    }
  }

  /**
   * Revoga API key
   */
  async revokeApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      logger.info('Revoking API key', { id, userId });

      await apiKeyService.revokeApiKey(id, userId);

      logger.info('API key revoked successfully', {
        apiKeyId: id,
        userId
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error revoking API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId: req.params.id
      });

      if (error instanceof Error && error.message === 'API key not found') {
        res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to revoke API key'
        });
      }
    }
  }

  /**
   * Busca estatísticas de uso da API key
   */
  async getApiKeyStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      logger.info('Getting API key stats', { id, userId });

      const stats = await apiKeyService.getApiKeyStats(id, userId);

      res.json({ data: stats });
    } catch (error) {
      logger.error('Error getting API key stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId: req.params.id
      });

      if (error instanceof Error && error.message === 'API key not found') {
        res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get API key stats'
        });
      }
    }
  }

  /**
   * Busca informações sobre tiers disponíveis
   */
  async getTiers(req: Request, res: Response): Promise<void> {
    try {
      const tiers = Object.values(ApiKeyTier).map(tier => {
        const limits = ApiKey.getTierLimits(tier);
        return {
          name: tier,
          limits: {
            perMinute: limits.rateLimitPerMinute,
            perDay: limits.rateLimitPerDay,
            perMonth: limits.rateLimitPerMonth
          },
          features: this.getTierFeatures(tier)
        };
      });

      res.json({ data: tiers });
    } catch (error) {
      logger.error('Error getting tiers', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get tiers'
      });
    }
  }

  /**
   * Obtém features por tier
   */
  private getTierFeatures(tier: ApiKeyTier): string[] {
    switch (tier) {
      case ApiKeyTier.FREE:
        return [
          'Basic search functionality',
          'Limited monitors',
          'Email notifications'
        ];
      case ApiKeyTier.BASIC:
        return [
          'Advanced search',
          'Multiple monitors',
          'Email & webhook notifications',
          'Basic analytics'
        ];
      case ApiKeyTier.PREMIUM:
        return [
          'Semantic search',
          'Unlimited monitors',
          'Priority processing',
          'Advanced analytics',
          'Custom webhooks'
        ];
      case ApiKeyTier.ENTERPRISE:
        return [
          'Full API access',
          'Custom integrations',
          'Dedicated support',
          'SLA guarantees',
          'Custom rate limits'
        ];
      default:
        return [];
    }
  }
}

export default new ApiKeyController();
