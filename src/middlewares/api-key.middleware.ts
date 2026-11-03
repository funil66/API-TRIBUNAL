import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.config';
import apiKeyService from '../services/api-key.service';

// Extend Express Request to include apiKey info
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        userId: string;
        tier: string;
        remainingRequests: {
          minute: number;
          day: number;
          month: number;
        };
      };
    }
  }
}

export interface ApiKeyMiddlewareOptions {
  required?: boolean;
  allowedTiers?: string[];
  rateLimitHeaders?: boolean;
}

/**
 * Middleware para validação de API keys
 */
export function apiKeyMiddleware(options: ApiKeyMiddlewareOptions = {}) {
  const {
    required = true,
    allowedTiers = [],
    rateLimitHeaders = true
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extrair API key do header Authorization ou query param
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        if (required) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is required',
            code: 'MISSING_API_KEY'
          });
          return;
        } else {
          return next(); // Opcional, continua sem API key
        }
      }

      // Validar API key
      const clientIp = getClientIp(req);
      const endpoint = req.path;
      
      const validation = await apiKeyService.validateApiKey(apiKey, clientIp, endpoint);

      if (!validation.isValid) {
        logger.warn('Invalid API key used', {
          ip: clientIp,
          endpoint,
          error: validation.error,
          userAgent: req.get('User-Agent')
        });

        res.status(401).json({
          error: 'Unauthorized',
          message: validation.error || 'Invalid API key',
          code: getErrorCode(validation.error)
        });
        return;
      }

      const { apiKey: validatedKey, remainingRequests } = validation;

      // Verificar tier se especificado
      if (allowedTiers.length > 0 && !allowedTiers.includes(validatedKey!.tier)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `API key tier '${validatedKey!.tier}' is not allowed for this endpoint`,
          code: 'INSUFFICIENT_TIER'
        });
        return;
      }

      // Adicionar informações da API key ao request
      req.apiKey = {
        id: validatedKey!.id,
        userId: validatedKey!.user_id,
        tier: validatedKey!.tier,
        remainingRequests: remainingRequests || { minute: 0, day: 0, month: 0 }
      };

      // Adicionar headers de rate limiting se habilitado
      if (rateLimitHeaders && remainingRequests) {
        res.set({
          'X-RateLimit-Limit-Day': validatedKey!.rate_limit_per_day.toString(),
          'X-RateLimit-Remaining-Day': remainingRequests.day.toString(),
          'X-RateLimit-Limit-Month': validatedKey!.rate_limit_per_month.toString(),
          'X-RateLimit-Remaining-Month': remainingRequests.month.toString(),
          'X-API-Key-Tier': validatedKey!.tier
        });
      }

      logger.debug('API key validated successfully', {
        apiKeyId: validatedKey!.id,
        userId: validatedKey!.user_id,
        tier: validatedKey!.tier,
        endpoint,
        ip: clientIp
      });

      next();
    } catch (error) {
      logger.error('Error in API key middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path,
        ip: getClientIp(req)
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error validating API key',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Middleware específico para endpoints públicos que permitem API key opcional
 */
export function optionalApiKeyMiddleware() {
  return apiKeyMiddleware({ required: false });
}

/**
 * Middleware para endpoints que requerem tier premium ou superior
 */
export function premiumApiKeyMiddleware() {
  return apiKeyMiddleware({ 
    required: true, 
    allowedTiers: ['premium', 'enterprise'] 
  });
}

/**
 * Middleware para endpoints exclusivos enterprise
 */
export function enterpriseApiKeyMiddleware() {
  return apiKeyMiddleware({ 
    required: true, 
    allowedTiers: ['enterprise'] 
  });
}

/**
 * Extrai API key do request
 */
function extractApiKey(req: Request): string | null {
  // Tentar extrair do header Authorization
  const authHeader = req.get('Authorization');
  if (authHeader) {
    // Formato: "Bearer ls_live_xxxxx" ou "ApiKey ls_live_xxxxx"
    const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  // Tentar extrair do header X-API-Key
  const apiKeyHeader = req.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Tentar extrair do query parameter (não recomendado para produção)
  const apiKeyQuery = req.query.api_key as string;
  if (apiKeyQuery) {
    logger.warn('API key passed via query parameter', {
      ip: getClientIp(req),
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    return apiKeyQuery;
  }

  return null;
}

/**
 * Obtém IP do cliente
 */
function getClientIp(req: Request): string {
  // Verificar headers de proxy
  const forwarded = req.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.get('X-Real-IP');
  if (realIp) {
    return realIp;
  }

  // Fallback para IP de conexão
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Mapeia erro para código
 */
function getErrorCode(error?: string): string {
  if (!error) return 'INVALID_API_KEY';
  
  if (error.includes('inactive') || error.includes('expired')) {
    return 'API_KEY_EXPIRED';
  }
  
  if (error.includes('rate limit')) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  
  if (error.includes('IP not allowed')) {
    return 'IP_NOT_ALLOWED';
  }
  
  if (error.includes('Endpoint not allowed')) {
    return 'ENDPOINT_NOT_ALLOWED';
  }
  
  return 'INVALID_API_KEY';
}

/**
 * Middleware para logging de uso da API
 */
export function apiUsageLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info('API request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        apiKeyId: req.apiKey?.id,
        userId: req.apiKey?.userId,
        tier: req.apiKey?.tier,
        ip: getClientIp(req),
        userAgent: req.get('User-Agent')
      });
    });
    
    next();
  };
}

export default {
  apiKeyMiddleware,
  optionalApiKeyMiddleware,
  premiumApiKeyMiddleware,
  enterpriseApiKeyMiddleware,
  apiUsageLogger
};
