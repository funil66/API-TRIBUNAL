import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis.config';
import { ApiKeyService } from '../services/api-key.service';
import { logger } from '../config/logger.config';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export class RateLimitMiddleware {
  private static apiKeyService = new ApiKeyService();

  /**
   * Rate limiting por API Key com diferentes tiers
   */
  static byApiKey() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          return res.status(401).json({
            error: 'API key required',
            code: 'MISSING_API_KEY'
          });
        }

        // Buscar configuração da API key
        const validation = await this.apiKeyService.validateApiKey(apiKey);
        if (!validation.isValid || !validation.apiKey) {
          return res.status(401).json({
            error: 'Invalid API key',
            code: 'INVALID_API_KEY'
          });
        }

        const keyInfo = validation.apiKey;

        // Configurações por tier
        const tierLimits: Record<string, { requests: number; windowMs: number }> = {
          'FREE': { requests: 100, windowMs: 3600000 }, // 100/hour
          'BASIC': { requests: 500, windowMs: 3600000 }, // 500/hour
          'PRO': { requests: 1000, windowMs: 3600000 }, // 1000/hour
          'ENTERPRISE': { requests: 10000, windowMs: 3600000 } // 10000/hour
        };

        const limit = tierLimits[keyInfo.tier] || tierLimits['FREE'];
        const key = `rate_limit:${apiKey}`;
        const window = Math.floor(Date.now() / limit.windowMs);
        const redisKey = `${key}:${window}`;

        // Verificar rate limit no Redis
        const current = await redisClient.incr(redisKey);
        
        if (current === 1) {
          await redisClient.expire(redisKey, Math.ceil(limit.windowMs / 1000));
        }

        const remaining = Math.max(0, limit.requests - current);
        const resetTime = (window + 1) * limit.windowMs;

        // Headers de rate limit
        res.set({
          'X-RateLimit-Limit': limit.requests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(resetTime).toISOString(),
          'X-RateLimit-Window': (limit.windowMs / 1000).toString()
        });

        if (current > limit.requests) {
          const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
          
          res.set('Retry-After', retryAfter.toString());
          
          // Log da violação
          logger.warn('Rate limit exceeded', {
            apiKey: apiKey.substring(0, 8) + '...',
            tier: keyInfo.tier,
            current,
            limit: limit.requests,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: limit.requests,
              window: `${limit.windowMs / 1000}s`,
              retryAfter
            }
          });
        }

        // Registrar uso da API key (mock implementation)
        // await this.apiKeyService.recordUsage(apiKey, {
        //   endpoint: req.path,
        //   method: req.method,
        //   ip: req.ip,
        //   userAgent: req.get('User-Agent'),
        //   timestamp: new Date()
        // });

        // Adicionar info de rate limit ao request
        req.rateLimit = {
          limit: limit.requests,
          remaining,
          reset: resetTime,
          retryAfter: current > limit.requests ? Math.ceil((resetTime - Date.now()) / 1000) : undefined
        };

        next();
      } catch (error) {
        logger.error('Rate limit middleware error:', error);
        next(error);
      }
    };
  }

  /**
   * Rate limiting por IP (para endpoints públicos)
   */
  static byIP(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const window = Math.floor(Date.now() / options.windowMs);
        const redisKey = `rate_limit:ip:${key}:${window}`;

        const current = await redisClient.incr(redisKey);
        
        if (current === 1) {
          await redisClient.expire(redisKey, Math.ceil(options.windowMs / 1000));
        }

        const remaining = Math.max(0, options.maxRequests - current);
        const resetTime = (window + 1) * options.windowMs;

        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(resetTime).toISOString()
        });

        if (current > options.maxRequests) {
          const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
          res.set('Retry-After', retryAfter.toString());

          if (options.onLimitReached) {
            options.onLimitReached(req, res);
          }

          logger.warn('IP rate limit exceeded', {
            ip: key,
            current,
            limit: options.maxRequests,
            userAgent: req.get('User-Agent')
          });

          return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter
          });
        }

        req.rateLimit = {
          limit: options.maxRequests,
          remaining,
          reset: resetTime
        };

        next();
      } catch (error) {
        logger.error('IP rate limit middleware error:', error);
        next(error);
      }
    };
  }

  /**
   * Rate limiting adaptativo baseado em carga do sistema
   */
  static adaptive() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Verificar carga do sistema
        const memUsage = process.memoryUsage();
        const memoryThreshold = 0.8; // 80%
        const currentMemoryUsage = memUsage.heapUsed / memUsage.heapTotal;

        // Ajustar limite baseado na carga
        let baseLimit = 1000; // Limite base por hora
        if (currentMemoryUsage > memoryThreshold) {
          baseLimit = Math.floor(baseLimit * 0.5); // Reduzir 50% se alta carga
        }

        const options: RateLimitOptions = {
          windowMs: 3600000, // 1 hora
          maxRequests: baseLimit,
          keyGenerator: (req) => req.ip
        };

        // Aplicar rate limiting por IP
        return RateLimitMiddleware.byIP(options)(req, res, next);
      } catch (error) {
        logger.error('Adaptive rate limit error:', error);
        next(error);
      }
    };
  }

  /**
   * Rate limiting para endpoints de busca (mais restritivo)
   */
  static forSearch() {
    return RateLimitMiddleware.byIP({
      windowMs: 60000, // 1 minuto
      maxRequests: 10, // 10 buscas por minuto
      keyGenerator: (req) => `search:${req.ip}`,
      onLimitReached: (req, res) => {
        logger.warn('Search rate limit exceeded', {
          ip: req.ip,
          query: req.query,
          userAgent: req.get('User-Agent')
        });
      }
    });
  }

  /**
   * Rate limiting para download de documentos
   */
  static forDownload() {
    return RateLimitMiddleware.byIP({
      windowMs: 300000, // 5 minutos
      maxRequests: 50, // 50 downloads por 5 minutos
      keyGenerator: (req) => `download:${req.ip}`
    });
  }
}

// Tipos para o Request
declare global {
  namespace Express {
    interface Request {
      rateLimit?: RateLimitInfo;
    }
  }
}

export default RateLimitMiddleware;
