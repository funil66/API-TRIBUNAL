import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../config/logger.config';
import { redisClient } from '../config/redis.config';

export interface MetricsData {
  timestamp: number;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  apiKey?: string;
  userId?: string;
  userAgent?: string;
  ip: string;
  error?: string;
}

export interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  apiKeys: {
    total: number;
    active: number;
    byTier: Record<string, number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    rateLimitViolations: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

export class MetricsService {
  private static startTime = Date.now();
  private static requestCount = 0;
  private static errorCount = 0;

  /**
   * Middleware para coletar métricas de requisições
   */
  static collectMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      
      // Incrementar contador de requisições
      MetricsService.requestCount++;

      // Override do método end para capturar métricas
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any, cb?: any) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Coletar dados da métrica
        const metrics: MetricsData = {
          timestamp: Date.now(),
          method: req.method,
          endpoint: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          apiKey: req.headers['x-api-key'] as string,
          userId: (req as any).user?.id,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress || 'unknown'
        };

        // Capturar erros
        if (res.statusCode >= 400) {
          MetricsService.errorCount++;
          if (res.locals.error) {
            metrics.error = res.locals.error.message || res.locals.error;
          }
        }

        // Salvar métrica
        MetricsService.saveMetric(metrics).catch(error => {
          logger.error('Failed to save metric:', error);
        });

        // Chamar método original
        originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Salvar métrica no Redis
   */
  private static async saveMetric(metric: MetricsData): Promise<void> {
    try {
      const key = `metrics:${new Date().toISOString().split('T')[0]}`;
      await redisClient.lpush(key, JSON.stringify(metric));
      await redisClient.expire(key, 86400 * 30); // 30 dias
      
      // Atualizar contadores agregados
      await MetricsService.updateAggregatedMetrics(metric);
    } catch (error) {
      logger.error('Error saving metric:', error);
    }
  }

  /**
   * Atualizar métricas agregadas
   */
  private static async updateAggregatedMetrics(metric: MetricsData): Promise<void> {
    try {
      const hour = new Date().getHours();
      const hourKey = `metrics:hourly:${hour}`;
      
      // Contadores por hora
      await redisClient.hincrby(hourKey, 'total_requests', 1);
      await redisClient.hincrby(hourKey, `status_${metric.statusCode}`, 1);
      await redisClient.hincrby(hourKey, `method_${metric.method}`, 1);
      
      if (metric.apiKey) {
        await redisClient.hincrby(hourKey, 'api_key_requests', 1);
      }
      
      if (metric.statusCode >= 400) {
        await redisClient.hincrby(hourKey, 'error_requests', 1);
      }

      await redisClient.expire(hourKey, 86400); // 24 horas
    } catch (error) {
      logger.error('Error updating aggregated metrics:', error);
    }
  }

  /**
   * Obter métricas do sistema
   */
  static async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const uptime = Date.now() - MetricsService.startTime;
      const memoryUsage = process.memoryUsage();
      
      // Métricas do Redis
      const currentHour = new Date().getHours();
      const hourKey = `metrics:hourly:${currentHour}`;
      const hourlyMetrics = await redisClient.hgetall(hourKey);
      
      const totalRequests = parseInt(hourlyMetrics.total_requests || '0');
      const errorRequests = parseInt(hourlyMetrics.error_requests || '0');
      const successfulRequests = totalRequests - errorRequests;

      return {
        requests: {
          total: MetricsService.requestCount,
          successful: MetricsService.requestCount - MetricsService.errorCount,
          failed: MetricsService.errorCount,
          avgResponseTime: await MetricsService.getAverageResponseTime()
        },
        apiKeys: {
          total: await MetricsService.getApiKeyCount(),
          active: await MetricsService.getActiveApiKeyCount(),
          byTier: await MetricsService.getApiKeysByTier()
        },
        errors: {
          total: MetricsService.errorCount,
          byType: await MetricsService.getErrorsByType(),
          rateLimitViolations: await MetricsService.getRateLimitViolations()
        },
        system: {
          uptime,
          memoryUsage
        }
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  /**
   * Obter tempo médio de resposta
   */
  private static async getAverageResponseTime(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `metrics:${today}`;
      const metrics = await redisClient.lrange(key, 0, 100);
      
      if (metrics.length === 0) return 0;
      
      const responseTimes = metrics.map(m => {
        try {
          return JSON.parse(m).responseTime;
        } catch {
          return 0;
        }
      });
      
      return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    } catch (error) {
      logger.error('Error calculating average response time:', error);
      return 0;
    }
  }

  /**
   * Obter contagem de API keys (mock)
   */
  private static async getApiKeyCount(): Promise<number> {
    // Mock implementation - seria conectado ao banco real
    return 25;
  }

  /**
   * Obter contagem de API keys ativas (mock)
   */
  private static async getActiveApiKeyCount(): Promise<number> {
    // Mock implementation
    return 22;
  }

  /**
   * Obter API keys por tier (mock)
   */
  private static async getApiKeysByTier(): Promise<Record<string, number>> {
    // Mock implementation
    return {
      FREE: 15,
      BASIC: 5,
      PRO: 3,
      ENTERPRISE: 2
    };
  }

  /**
   * Obter erros por tipo
   */
  private static async getErrorsByType(): Promise<Record<string, number>> {
    try {
      const currentHour = new Date().getHours();
      const hourKey = `metrics:hourly:${currentHour}`;
      const metrics = await redisClient.hgetall(hourKey);
      
      const errorTypes: Record<string, number> = {};
      Object.keys(metrics).forEach(key => {
        if (key.startsWith('status_4') || key.startsWith('status_5')) {
          const statusCode = key.replace('status_', '');
          errorTypes[statusCode] = parseInt(metrics[key]);
        }
      });
      
      return errorTypes;
    } catch (error) {
      logger.error('Error getting errors by type:', error);
      return {};
    }
  }

  /**
   * Obter violações de rate limit
   */
  private static async getRateLimitViolations(): Promise<number> {
    try {
      const currentHour = new Date().getHours();
      const hourKey = `metrics:hourly:${currentHour}`;
      const violations = await redisClient.hget(hourKey, 'status_429');
      return parseInt(violations || '0');
    } catch (error) {
      logger.error('Error getting rate limit violations:', error);
      return 0;
    }
  }

  /**
   * Obter métricas de API key específica
   */
  static async getApiKeyMetrics(apiKey: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `metrics:${today}`;
      const allMetrics = await redisClient.lrange(key, 0, -1);
      
      const apiKeyMetrics = allMetrics
        .map(m => {
          try {
            return JSON.parse(m);
          } catch {
            return null;
          }
        })
        .filter(m => m && m.apiKey === apiKey);

      return {
        totalRequests: apiKeyMetrics.length,
        avgResponseTime: apiKeyMetrics.length > 0 
          ? apiKeyMetrics.reduce((sum, m) => sum + m.responseTime, 0) / apiKeyMetrics.length 
          : 0,
        errorRate: apiKeyMetrics.length > 0 
          ? apiKeyMetrics.filter(m => m.statusCode >= 400).length / apiKeyMetrics.length 
          : 0,
        endpoints: apiKeyMetrics.reduce((acc, m) => {
          acc[m.endpoint] = (acc[m.endpoint] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      logger.error('Error getting API key metrics:', error);
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        endpoints: {}
      };
    }
  }

  /**
   * Limpar métricas antigas
   */
  static async cleanupOldMetrics(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const key = `metrics:${date.toISOString().split('T')[0]}`;
        
        const exists = await redisClient.exists(key);
        if (exists) {
          await redisClient.del(key);
        }
      }

      logger.info('Old metrics cleaned up successfully');
    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
    }
  }

  /**
   * Gerar relatório de métricas
   */
  static async generateReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      const report = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalRequests: 0,
          avgResponseTime: 0,
          errorRate: 0,
          topEndpoints: {},
          topApiKeys: {},
          errorsByType: {}
        },
        daily: [] as any[]
      };

      // Gerar dados diários
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayMetrics = await MetricsService.getDayMetrics(dateKey);
        
        report.daily.push({
          date: dateKey,
          ...dayMetrics
        });

        report.summary.totalRequests += dayMetrics.totalRequests;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calcular médias
      const totalDays = report.daily.length;
      if (totalDays > 0) {
        report.summary.avgResponseTime = report.daily
          .reduce((sum, day) => sum + day.avgResponseTime, 0) / totalDays;
        
        report.summary.errorRate = report.daily
          .reduce((sum, day) => sum + day.errorRate, 0) / totalDays;
      }

      return report;
    } catch (error) {
      logger.error('Error generating metrics report:', error);
      throw error;
    }
  }

  /**
   * Obter métricas de um dia específico
   */
  private static async getDayMetrics(date: string): Promise<any> {
    try {
      const key = `metrics:${date}`;
      const metrics = await redisClient.lrange(key, 0, -1);
      
      const parsedMetrics = metrics
        .map(m => {
          try {
            return JSON.parse(m);
          } catch {
            return null;
          }
        })
        .filter(m => m !== null);

      const totalRequests = parsedMetrics.length;
      const errors = parsedMetrics.filter(m => m.statusCode >= 400);
      const avgResponseTime = totalRequests > 0 
        ? parsedMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
        : 0;

      return {
        totalRequests,
        errors: errors.length,
        errorRate: totalRequests > 0 ? errors.length / totalRequests : 0,
        avgResponseTime
      };
    } catch (error) {
      logger.error(`Error getting day metrics for ${date}:`, error);
      return {
        totalRequests: 0,
        errors: 0,
        errorRate: 0,
        avgResponseTime: 0
      };
    }
  }
}

export default MetricsService;
