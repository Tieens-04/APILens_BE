const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        plan: {
            type: String,
            enum: ['pro', 'enterprise'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'cancelled'],
            default: 'pending',
            index: true,
        },
        paymentOrderId: {
            type: String,
            sparse: true,
            index: true,
        },
        paymentReferenceCode: {
            type: String,
        },
        paymentDescription: {
            type: String,
        },
        qrCodeUrl: {
            type: String,
        },
        paidAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Order', orderSchema);
