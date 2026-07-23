const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payment.service');
const ApiError = require('../utils/ApiError');
const { emitToUser } = require('../services/notification.service');
const Order = require('../models/Order.model');

const checkout = asyncHandler(async (req, res) => {
    const { plan } = req.body;

    if (!plan) {
        throw new ApiError(400, 'plan is required', 'VALIDATION_ERROR');
    }

    const order = await paymentService.createCheckoutOrder(req.user._id, { plan });

    res.status(201).json({
        success: true,
        order,
    });
});

const getOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await paymentService.checkOrderStatus(req.user._id, id);

    res.status(200).json({
        success: true,
        order,
    });
});

const paymentCallback = asyncHandler(async (req, res) => {
    const { order_id, status, client_id } = req.body;

    if (!order_id || !status) {
        throw new ApiError(400, 'order_id and status are required', 'VALIDATION_ERROR');
    }

    const result = await paymentService.handleCallback({ order_id, status, client_id });

    // If the payment succeeded, push a realtime update to the buyer's browser
    if (status === 'paid') {
        const order = await Order.findOne({ paymentOrderId: order_id }).select('userId plan amount paidAt');
        if (order) {
            emitToUser(order.userId, 'order.updated', {
                orderId: order._id,
                plan: order.plan,
                status: 'paid',
                amount: order.amount,
                paidAt: order.paidAt,
            });
        }
    }

    res.status(200).json(result);
});

const getUserOrders = asyncHandler(async (req, res) => {
    const orders = await paymentService.getUserOrders(req.user._id);

    res.status(200).json({
        success: true,
        orders,
    });
});

module.exports = {
    checkout,
    getOrderStatus,
    paymentCallback,
    getUserOrders,
};
