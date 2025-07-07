import { Schema, model } from 'mongoose';

const subscriptionSchema = new Schema({
    lawyerId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Lawyer'
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled'],
        default: 'active'
    },
    paymentDetails: {
        type: Object,
        required: true
    }
}, {
    timestamps: true
});

const Subscription = model('Subscription', subscriptionSchema);

export default Subscription;