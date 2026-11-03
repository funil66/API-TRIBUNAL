import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';

export class SubscriptionController {
    private subscriptionService: SubscriptionService;

    constructor() {
        this.subscriptionService = new SubscriptionService();
    }

    public async createSubscription(req: Request, res: Response): Promise<Response> {
        try {
            const subscriptionData = req.body;
            const subscription = await this.subscriptionService.createSubscription(subscriptionData);
            return res.status(201).json(subscription);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    public async getSubscriptions(req: Request, res: Response): Promise<Response> {
        try {
            const userId = req.params.userId;
            const subscriptions = await this.subscriptionService.getSubscriptionsByUserId(userId);
            return res.status(200).json(subscriptions);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    public async cancelSubscription(req: Request, res: Response): Promise<Response> {
        try {
            const subscriptionId = req.params.subscriptionId;
            await this.subscriptionService.cancelSubscription(subscriptionId);
            return res.status(204).send();
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }
}