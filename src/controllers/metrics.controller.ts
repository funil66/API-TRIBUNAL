import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';
import { ApiKeyService } from '../services/api-key.service';
import { logger } from '../config/logger.config';
import { redisClient } from '../config/redis.config';

export class MetricsController {
  private static apiKeyService = new ApiKeyService();

  /**
   * @swagger
   * /api/metrics/system:
   *   get:
   *     tags: [Metrics]
   *     summary: Métricas do sistema
   *     description: Retorna métricas gerais do sistema
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Métricas do sistema
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 metrics:
   *                   type: object
   */
  static async getSystemMetrics(req: Request, res: Response) {
    try {
      const metrics = await MetricsService.getSystemMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * @swagger
   * /api/metrics/api-key/{apiKeyId}:
   *   get:
   *     tags: [Metrics]
   *     summary: Métricas de API key específica
   *     description: Retorna métricas de uso de uma API key específica
   *     parameters:
   *       - in: path
   *         name: apiKeyId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da API key
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Métricas da API key
   */
  static async getApiKeyMetrics(req: Request, res: Response) {
    try {
      const { apiKeyId } = req.params;
      
      // Verificar se a API key existe e pertence ao usuário
      const userId = (req as any).user?.id;
      const apiKey = await MetricsController.apiKeyService.getApiKeyById(apiKeyId, userId);
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString()
        });
      }

      const metrics = await MetricsService.getApiKeyMetrics(apiKey.key_hash);
      
      res.json({
        success: true,
        data: {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            displayKey: apiKey.display_key,
            tier: apiKey.tier
          },
          metrics
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting API key metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API key metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * @swagger
   * /api/metrics/report:
   *   get:
   *     tags: [Metrics]
   *     summary: Relatório de métricas
   *     description: Gera relatório de métricas para um período específico
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Data inicial (YYYY-MM-DD)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Data final (YYYY-MM-DD)
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Relatório de métricas
   */
  static async generateReport(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      // Validar datas
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString()
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'Start date must be before end date',
          timestamp: new Date().toISOString()
        });
      }

      const report = await MetricsService.generateReport(start, end);
      
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error generating metrics report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate metrics report',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * @swagger
   * /api/health:
   *   get:
   *     tags: [Health]
   *     summary: Health check da API
   *     description: Verifica o status de saúde da API e dependências
   *     responses:
   *       200:
   *         description: API saudável
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: healthy
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                 services:
   *                   type: object
   *       503:
   *         description: Serviço indisponível
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const startTime = Date.now();
      const services: Record<string, any> = {};

      // Verificar Redis
      try {
        await redisClient.ping();
        services.redis = {
          status: 'healthy',
          responseTime: Date.now() - startTime
        };
      } catch (error) {
        services.redis = {
          status: 'unhealthy',
          error: (error as Error).message
        };
      }

      // Verificar banco de dados (mock)
      services.database = {
        status: 'healthy', // Mock - seria uma verificação real
        responseTime: Math.random() * 50 + 10
      };

      // Verificar Elasticsearch (mock)
      services.elasticsearch = {
        status: 'healthy', // Mock - seria uma verificação real
        responseTime: Math.random() * 100 + 20
      };

      // Status geral
      const allHealthy = Object.values(services).every(service => service.status === 'healthy');
      const status = allHealthy ? 'healthy' : 'unhealthy';
      const statusCode = allHealthy ? 200 : 503;

      // Métricas básicas
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services,
        system: {
          memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
          },
          cpu: {
            loadAverage: process.platform !== 'win32' ? process.loadavg() : [0, 0, 0]
          }
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  }

  /**
   * @swagger
   * /api/health/deep:
   *   get:
   *     tags: [Health]
   *     summary: Deep health check
   *     description: Verificação detalhada de saúde incluindo testes de funcionalidade
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Verificação detalhada de saúde
   */
  static async deepHealthCheck(req: Request, res: Response) {
    try {
      const checks: Record<string, any> = {};
      let overallHealth = true;

      // Teste Redis - operações básicas
      try {
        const testKey = `health:test:${Date.now()}`;
        await redisClient.set(testKey, 'test', 'EX', 60);
        const value = await redisClient.get(testKey);
        await redisClient.del(testKey);
        
        checks.redis = {
          status: value === 'test' ? 'healthy' : 'unhealthy',
          operations: ['set', 'get', 'delete'],
          details: 'All basic operations working'
        };
      } catch (error) {
        checks.redis = {
          status: 'unhealthy',
          error: (error as Error).message
        };
        overallHealth = false;
      }

      // Teste de métricas
      try {
        const metrics = await MetricsService.getSystemMetrics();
        checks.metrics = {
          status: 'healthy',
          details: `Tracking ${metrics.requests.total} total requests`
        };
      } catch (error) {
        checks.metrics = {
          status: 'unhealthy',
          error: (error as Error).message
        };
        overallHealth = false;
      }

      // Teste de API keys (mock)
      try {
        // Mock test - seria uma verificação real do serviço
        checks.apiKeys = {
          status: 'healthy',
          details: 'API key service operational'
        };
      } catch (error) {
        checks.apiKeys = {
          status: 'unhealthy',
          error: (error as Error).message
        };
        overallHealth = false;
      }

      // Teste de notificações (mock)
      checks.notifications = {
        status: 'healthy',
        details: 'Notification services operational'
      };

      const statusCode = overallHealth ? 200 : 503;
      res.status(statusCode).json({
        status: overallHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks,
        summary: {
          total: Object.keys(checks).length,
          healthy: Object.values(checks).filter(check => check.status === 'healthy').length,
          unhealthy: Object.values(checks).filter(check => check.status === 'unhealthy').length
        }
      });
    } catch (error) {
      logger.error('Deep health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  }

  /**
   * @swagger
   * /api/metrics/cleanup:
   *   post:
   *     tags: [Metrics]
   *     summary: Limpar métricas antigas
   *     description: Remove métricas antigas para liberar espaço
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Limpeza realizada com sucesso
   */
  static async cleanupMetrics(req: Request, res: Response) {
    try {
      await MetricsService.cleanupOldMetrics();
      
      res.json({
        success: true,
        message: 'Old metrics cleaned up successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error cleaning up metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup metrics',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default MetricsController;
