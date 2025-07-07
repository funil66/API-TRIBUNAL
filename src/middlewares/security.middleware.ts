import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.config';

export interface SecurityConfig {
  enableCORS: boolean;
  enableHelmet: boolean;
  enableRateLimit: boolean;
  enableInputSanitization: boolean;
  trustedProxies?: string[];
  corsOptions?: {
    origin?: string | string[] | boolean;
    credentials?: boolean;
    allowedHeaders?: string[];
    methods?: string[];
  };
}

/**
 * Middleware de segurança abrangente
 */
export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * Aplicar todos os middlewares de segurança
   */
  apply() {
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    if (this.config.enableHelmet) {
      middlewares.push(this.helmetMiddleware());
    }

    if (this.config.enableCORS) {
      middlewares.push(this.corsMiddleware());
    }

    if (this.config.enableInputSanitization) {
      middlewares.push(this.sanitizationMiddleware());
    }

    middlewares.push(this.securityHeadersMiddleware());
    middlewares.push(this.requestLoggingMiddleware());

    return middlewares;
  }

  /**
   * Middleware similar ao Helmet.js
   */
  private helmetMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Content Security Policy
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      );

      // X-Content-Type-Options
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // X-Frame-Options
      res.setHeader('X-Frame-Options', 'DENY');

      // X-XSS-Protection
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Hide X-Powered-By
      res.removeHeader('X-Powered-By');

      // Strict Transport Security (HTTPS only)
      if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      next();
    };
  }

  /**
   * Middleware CORS customizado
   */
  private corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const origin = req.get('Origin');
      const corsOptions = this.config.corsOptions || {};

      // Definir Access-Control-Allow-Origin
      if (corsOptions.origin === true) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else if (corsOptions.origin === false) {
        // Não permitir CORS
      } else if (typeof corsOptions.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
      } else if (Array.isArray(corsOptions.origin)) {
        if (origin && corsOptions.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else {
        // Default: permitir apenas mesma origem
        res.setHeader('Access-Control-Allow-Origin', req.get('Host') || 'localhost');
      }

      // Headers permitidos
      const allowedHeaders = corsOptions.allowedHeaders || [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key'
      ];
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

      // Métodos permitidos
      const allowedMethods = corsOptions.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));

      // Credentials
      if (corsOptions.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Preflight
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      next();
    };
  }

  /**
   * Middleware de sanitização de inputs
   */
  private sanitizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Sanitizar query parameters
        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitizar body
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitizar params
        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        logger.error('Error in sanitization middleware', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path
        });
        next();
      }
    };
  }

  /**
   * Headers de segurança adicionais
   */
  private securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Prevenção de clickjacking
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');

      // Cache control para APIs
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Content type
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      next();
    };
  }

  /**
   * Middleware de logging de segurança
   */
  private requestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Log suspeito de atividade
      const suspiciousPatterns = [
        /\.\.\//,  // Path traversal
        /<script/i,  // XSS
        /union.*select/i,  // SQL injection
        /javascript:/i,  // XSS
        /on\w+\s*=/i  // Event handlers
      ];

      const userAgent = req.get('User-Agent') || '';
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(req.url) || 
        pattern.test(userAgent) ||
        pattern.test(JSON.stringify(req.body || {}))
      );

      if (isSuspicious) {
        logger.warn('Suspicious request detected', {
          ip: this.getClientIp(req),
          userAgent,
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body
        });
      }

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log requests with high response time
        if (duration > 5000) {
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode
          });
        }
      });

      next();
    };
  }

  /**
   * Sanitiza objetos recursivamente
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[this.sanitizeString(key)] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  /**
   * Sanitiza strings
   */
  private sanitizeString(str: any): any {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove caracteres potencialmente perigosos
    return str
      .replace(/[<>]/g, '') // Remove < e >
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Obtém IP do cliente
   */
  private getClientIp(req: Request): string {
    const forwarded = req.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = req.get('X-Real-IP');
    if (realIp) {
      return realIp;
    }

    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}

/**
 * Configuração padrão de segurança
 */
export const defaultSecurityConfig: SecurityConfig = {
  enableCORS: true,
  enableHelmet: true,
  enableRateLimit: true,
  enableInputSanitization: true,
  corsOptions: {
    origin: false, // Restritivo por padrão
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
};

/**
 * Configuração para desenvolvimento
 */
export const developmentSecurityConfig: SecurityConfig = {
  ...defaultSecurityConfig,
  corsOptions: {
    ...defaultSecurityConfig.corsOptions,
    origin: true // Permissivo para desenvolvimento
  }
};

/**
 * Configuração para produção
 */
export const productionSecurityConfig: SecurityConfig = {
  ...defaultSecurityConfig,
  corsOptions: {
    ...defaultSecurityConfig.corsOptions,
    origin: [
      'https://legal-search.com',
      'https://app.legal-search.com',
      'https://api.legal-search.com'
    ]
  }
};

/**
 * Factory para criar middleware de segurança
 */
export function createSecurityMiddleware(config?: Partial<SecurityConfig>) {
  const env = process.env.NODE_ENV || 'development';
  
  let baseConfig: SecurityConfig;
  if (env === 'production') {
    baseConfig = productionSecurityConfig;
  } else {
    baseConfig = developmentSecurityConfig;
  }

  const finalConfig = { ...baseConfig, ...config };
  return new SecurityMiddleware(finalConfig);
}

export default SecurityMiddleware;
