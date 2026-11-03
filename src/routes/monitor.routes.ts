import { Router } from 'express';
import monitorController from '../controllers/monitor.controller';
// import { authenticate, authorize } from '../middlewares/auth.middleware';
// import { validateRequest, validateQuery } from '../middlewares/validation.middleware';
// import { createMonitorSchema, updateMonitorSchema } from '../validators/monitor.validator';

const router = Router();

// Protected routes - require authentication
// router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Monitor:
 *       type: object
 *       required:
 *         - name
 *         - searchType
 *         - searchTerm
 *         - tribunals
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         searchType:
 *           type: string
 *           enum: [name, cpf, oab]
 *         searchTerm:
 *           type: string
 *         tribunals:
 *           type: array
 *           items:
 *             type: string
 *         active:
 *           type: boolean
 *         schedule:
 *           type: object
 *         notifications:
 *           type: object
 */

// Monitor CRUD endpoints
router.get('/', monitorController.getMonitors);
router.get('/stats', monitorController.getMonitorStats);
router.post('/', monitorController.createMonitor);
router.get('/:id', monitorController.getMonitor);
router.put('/:id', monitorController.updateMonitor);
router.delete('/:id', monitorController.deleteMonitor);
router.post('/:id/run', monitorController.runMonitor);

export default router;
