import { Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import { SubscriptionModel } from '../models/subscription.model';

export class AdminController {
    public async getUsers(req: Request, res: Response): Promise<Response> {
        try {
            const users = await UserModel.find();
            return res.status(200).json(users);
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving users', error });
        }
    }

    public async getSubscriptions(req: Request, res: Response): Promise<Response> {
        try {
            const subscriptions = await SubscriptionModel.find();
            return res.status(200).json(subscriptions);
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving subscriptions', error });
        }
    }

    public async deleteUser(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            await UserModel.findByIdAndDelete(id);
            return res.status(204).send();
        } catch (error) {
            return res.status(500).json({ message: 'Error deleting user', error });
        }
    }

    public async updateSubscription(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const subscriptionData = req.body;
        try {
            const updatedSubscription = await SubscriptionModel.findByIdAndUpdate(id, subscriptionData, { new: true });
            return res.status(200).json(updatedSubscription);
        } catch (error) {
            return res.status(500).json({ message: 'Error updating subscription', error });
        }
    }
}