import { Injectable } from 'nestjs/common';
import { SubscriptionModel } from '../models/subscription.model';
import { UserModel } from '../models/user.model';

@Injectable()
export class PaymentService {
    constructor(
        private subscriptionModel: SubscriptionModel,
        private userModel: UserModel
    ) {}

    async processPayment(userId: string, subscriptionId: string): Promise<any> {
        const user = await this.userModel.findById(userId);
        const subscription = await this.subscriptionModel.findById(subscriptionId);

        if (!user || !subscription) {
            throw new Error('User or subscription not found');
        }

        // Implement payment processing logic here
        // This could involve integrating with a payment gateway

        // Assuming payment is successful, update the user's subscription status
        user.subscriptionId = subscriptionId;
        await user.save();

        return { message: 'Payment processed successfully', user };
    }

    async getPaymentHistory(userId: string): Promise<any> {
        const user = await this.userModel.findById(userId).populate('subscriptionId');

        if (!user) {
            throw new Error('User not found');
        }

        return user.subscriptionId;
    }
}