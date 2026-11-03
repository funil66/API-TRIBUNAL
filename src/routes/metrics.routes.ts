import { Router } from 'express';
import { MetricsController } from '../controllers/metrics.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { apiKeyMiddleware } from '../middlewares/api-key.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Metrics
 *     description: Métricas e monitoramento do sistema
 *   - name: Health
 *     description: Health checks da API
 */

// Health checks (públicos)
router.get('/health', MetricsController.healthCheck);
router.get('/health/deep', apiKeyMiddleware.validateApiKey(), MetricsController.deepHealthCheck);

// Métricas do sistema (requer API key ou autenticação)
router.get('/metrics/system', apiKeyMiddleware.validateApiKey(), MetricsController.getSystemMetrics);

// Métricas de API key específica (requer autenticação de usuário)
router.get('/metrics/api-key/:apiKeyId', authMiddleware, MetricsController.getApiKeyMetrics);

// Relatórios (requer API key ou autenticação)
router.get('/metrics/report', apiKeyMiddleware.validateApiKey(), MetricsController.generateReport);

// Limpeza de métricas (admin only)
router.post('/metrics/cleanup', authMiddleware, MetricsController.cleanupMetrics);

export default router;
