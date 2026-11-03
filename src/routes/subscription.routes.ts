import { Router } from 'express';
import SubscriptionController from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
const subscriptionController = new SubscriptionController();

// Route to create a new subscription
router.post('/', authenticate, subscriptionController.createSubscription);

// Route to get subscription details
router.get('/:id', authenticate, subscriptionController.getSubscription);

// Route to update a subscription
router.put('/:id', authenticate, subscriptionController.updateSubscription);

// Route to delete a subscription
router.delete('/:id', authenticate, subscriptionController.deleteSubscription);

// Route to list all subscriptions for a user
router.get('/', authenticate, subscriptionController.listSubscriptions);

export default router;