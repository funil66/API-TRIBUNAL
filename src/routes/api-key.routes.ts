import { Router } from 'express';
import apiKeyController from '../controllers/api-key.controller';
// import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Middleware de autenticação para todas as rotas
// router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiKey:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: API key ID
 *         name:
 *           type: string
 *           description: API key name
 *         displayKey:
 *           type: string
 *           description: Masked API key for display
 *         tier:
 *           type: string
 *           enum: [free, basic, premium, enterprise]
 *         status:
 *           type: string
 *           enum: [active, inactive, revoked, expired]
 *         rateLimits:
 *           type: object
 *           properties:
 *             perMinute:
 *               type: integer
 *             perDay:
 *               type: integer
 *             perMonth:
 *               type: integer
 *         usage:
 *           type: object
 *           properties:
 *             totalRequests:
 *               type: integer
 *             requestsToday:
 *               type: integer
 *             requestsThisMonth:
 *               type: integer
 *         permissions:
 *           type: object
 *           properties:
 *             allowedEndpoints:
 *               type: array
 *               items:
 *                 type: string
 *             allowedIps:
 *               type: array
 *               items:
 *                 type: string
 *             allowedDomains:
 *               type: array
 *               items:
 *                 type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     CreateApiKeyRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: API key name
 *           maxLength: 50
 *         tier:
 *           type: string
 *           enum: [free, basic, premium, enterprise]
 *           default: free
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Expiration date (optional)
 *         allowedEndpoints:
 *           type: array
 *           items:
 *             type: string
 *           description: Allowed endpoint patterns (optional)
 *         allowedIps:
 *           type: array
 *           items:
 *             type: string
 *           description: Allowed IP addresses (optional)
 *         allowedDomains:
 *           type: array
 *           items:
 *             type: string
 *           description: Allowed domains for CORS (optional)
 *         metadata:
 *           type: object
 *           description: Additional metadata (optional)
 */

/**
 * @swagger
 * /api/api-keys/tiers:
 *   get:
 *     summary: Get available API key tiers
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: List of available tiers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       limits:
 *                         type: object
 *                         properties:
 *                           perMinute:
 *                             type: integer
 *                           perDay:
 *                             type: integer
 *                           perMonth:
 *                             type: integer
 *                       features:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.get('/tiers', apiKeyController.getTiers);

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: List user API keys
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *                 total:
 *                   type: integer
 */
router.get('/', apiKeyController.getApiKeys);

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Create new API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApiKeyRequest'
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     key:
 *                       type: string
 *                       description: Full API key (only shown once)
 *                     displayKey:
 *                       type: string
 *                     tier:
 *                       type: string
 *                     status:
 *                       type: string
 *                     rateLimits:
 *                       type: object
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 */
router.post('/', apiKeyController.createApiKey);

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Get API key details
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 */
router.get('/:id', apiKeyController.getApiKey);

/**
 * @swagger
 * /api/api-keys/{id}:
 *   put:
 *     summary: Update API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               allowedEndpoints:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedIps:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedDomains:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: API key updated successfully
 */
router.put('/:id', apiKeyController.updateApiKey);

/**
 * @swagger
 * /api/api-keys/{id}/regenerate:
 *   post:
 *     summary: Regenerate API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     key:
 *                       type: string
 *                       description: New API key
 *                     displayKey:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 */
router.post('/:id/regenerate', apiKeyController.regenerateApiKey);

/**
 * @swagger
 * /api/api-keys/{id}/stats:
 *   get:
 *     summary: Get API key usage statistics
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: integer
 *                     requestsToday:
 *                       type: integer
 *                     requestsThisMonth:
 *                       type: integer
 *                     lastUsedAt:
 *                       type: string
 *                       format: date-time
 *                     lastUsedIp:
 *                       type: string
 *                     remainingRequests:
 *                       type: object
 *                       properties:
 *                         day:
 *                           type: integer
 *                         month:
 *                           type: integer
 */
router.get('/:id/stats', apiKeyController.getApiKeyStats);

/**
 * @swagger
 * /api/api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: API key revoked successfully
 */
router.post('/:id/revoke', apiKeyController.revokeApiKey);

export default router;
