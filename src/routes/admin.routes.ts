import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const adminController = new AdminController();

// Route to get all users
router.get('/users', authMiddleware, adminController.getAllUsers);

// Route to get subscription statistics
router.get('/subscriptions/stats', authMiddleware, adminController.getSubscriptionStats);

// Route to manage user subscriptions
router.post('/subscriptions/manage', authMiddleware, adminController.manageUserSubscription);

export default router;