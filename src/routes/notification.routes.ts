import { Router } from 'express';
import notificationController from '../controllers/notification.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [email, webhook]
 *         status:
 *           type: string
 *           enum: [pending, delivered, failed, scheduled, cancelled]
 *         subject:
 *           type: string
 *         content:
 *           type: string
 *         to:
 *           type: string
 *         url:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *         retryCount:
 *           type: integer
 *         lastError:
 *           type: string
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: List user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [email, webhook]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, delivered, failed, scheduled, cancelled]
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d, 90d]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Notification statistics
 */
router.get('/stats', notificationController.getNotificationStats);

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send immediate notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - event
 *               - data
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, webhook]
 *               to:
 *                 type: string
 *                 description: Email address (required for email type)
 *               url:
 *                 type: string
 *                 description: Webhook URL (required for webhook type)
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notification sent
 */
router.post('/send', notificationController.sendNotification);

/**
 * @swagger
 * /api/notifications/schedule:
 *   post:
 *     summary: Schedule notification for later delivery
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - event
 *               - data
 *               - schedule
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, webhook]
 *               to:
 *                 type: string
 *               url:
 *                 type: string
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *               schedule:
 *                 type: object
 *                 properties:
 *                   delay:
 *                     type: integer
 *                     description: Delay in milliseconds
 *                   at:
 *                     type: string
 *                     format: date-time
 *     responses:
 *       201:
 *         description: Notification scheduled
 */
router.post('/schedule', notificationController.scheduleNotification);

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Test notification configuration
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, webhook]
 *               to:
 *                 type: string
 *                 description: Email address (required for email type)
 *               url:
 *                 type: string
 *                 description: Webhook URL (required for webhook type)
 *               template:
 *                 type: string
 *               webhookSecret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test notification sent
 */
router.post('/test', notificationController.testNotification);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
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
 *         description: Notification details
 */
router.get('/:id', notificationController.getNotification);

/**
 * @swagger
 * /api/notifications/{id}/cancel:
 *   post:
 *     summary: Cancel scheduled notification
 *     tags: [Notifications]
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
 *         description: Notification cancelled
 */
router.post('/:id/cancel', notificationController.cancelNotification);

export default router;
