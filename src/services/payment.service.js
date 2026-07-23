const Order = require('../models/Order.model');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');

const getPaymentConfig = () => {
    const serviceUrl = process.env.PAYMENT_SERVICE_URL || 'https://payment-service-cfavf0dphzdnctb8.southeastasia-01.azurewebsites.net';
    const clientId = process.env.PAYMENT_CLIENT_ID || 'client_demo_1';
    const apiKey = process.env.PAYMENT_API_KEY || 'demo_key_1_abc';
    const publicUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5000';

    return {
        serviceUrl,
        clientId,
        apiKey,
        publicUrl,
    };
};

const PLAN_PRICES = {
    pro: 10000,
    enterprise: 999000,
};

const applyUserPlanUpgrade = async (userId, plan) => {
    const user = await User.findById(userId);
    if (!user) return;

    user.plan = plan;
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    user.planExpiresAt = expires;

    if (plan === 'pro') {
        user.credits = 20000;
        user.maxCredits = 20000;
    } else if (plan === 'enterprise') {
        user.credits = 999999;
        user.maxCredits = 999999;
    } else {
        user.credits = 500;
        user.maxCredits = 500;
    }

    await user.save();
};

const createCheckoutOrder = async (userId, { plan }) => {
    if (!PLAN_PRICES[plan]) {
        throw new ApiError(400, 'Invalid plan selected', 'INVALID_PLAN');
    }

    const amount = PLAN_PRICES[plan];
    const config = getPaymentConfig();

    const localOrder = await Order.create({
        userId,
        plan,
        amount,
        status: 'pending',
    });

    const callbackUrl = `${config.publicUrl}/api/v1/orders/callback`;

    try {
        const response = await fetch(`${config.serviceUrl}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': config.clientId,
                'x-api-key': config.apiKey,
            },
            body: JSON.stringify({
                amount,
                description: `APILens Upgrade Plan ${plan.toUpperCase()}`,
                callback_url: callbackUrl,
            }),
        });

        const paymentData = await response.json();

        if (!response.ok) {
            localOrder.status = 'failed';
            await localOrder.save();
            throw new ApiError(response.status || 500, paymentData.message || 'Payment service order creation failed', 'PAYMENT_SERVICE_ERROR');
        }

        localOrder.paymentOrderId = paymentData.order_id;
        localOrder.paymentReferenceCode = paymentData.reference_code;
        localOrder.paymentDescription = paymentData.payment_description;
        localOrder.qrCodeUrl = paymentData.qr_code_url;
        await localOrder.save();

        return localOrder;
    } catch (error) {
        if (error instanceof ApiError) throw error;

        localOrder.status = 'failed';
        await localOrder.save();
        throw new ApiError(500, `Payment gateway error: ${error.message}`, 'PAYMENT_GATEWAY_ERROR');
    }
};

const checkOrderStatus = async (userId, orderId) => {
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
        throw new ApiError(404, 'Order not found', 'NOT_FOUND');
    }

    if (order.status === 'paid') {
        return order;
    }

    if (!order.paymentOrderId) {
        return order;
    }

    const config = getPaymentConfig();

    try {
        const response = await fetch(`${config.serviceUrl}/api/orders/${order.paymentOrderId}`, {
            headers: {
                'x-client-id': config.clientId,
                'x-api-key': config.apiKey,
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'paid') {
                order.status = 'paid';
                order.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
                await order.save();

                await applyUserPlanUpgrade(order.userId, order.plan);
            }
        }
    } catch (error) {
        console.error('Error polling payment service status:', error.message);
    }

    return order;
};

const handleCallback = async ({ order_id, status, client_id }) => {
    const config = getPaymentConfig();

    if (client_id && client_id !== config.clientId) {
        throw new ApiError(403, 'Invalid client_id in callback', 'INVALID_CLIENT');
    }

    const order = await Order.findOne({ paymentOrderId: order_id });

    if (!order) {
        throw new ApiError(404, 'Order not found', 'NOT_FOUND');
    }

    if (order.status === 'paid') {
        return { success: true, message: 'Already paid' };
    }

    if (status === 'paid') {
        order.status = 'paid';
        order.paidAt = new Date();
        await applyUserPlanUpgrade(order.userId, order.plan);
    }

    return { success: true };
};

const getUserOrders = async (userId) => {
    return Order.find({ userId }).sort({ createdAt: -1 });
};

const getAllOrdersAdmin = async () => {
    return Order.find().populate('userId', 'name email avatarUrl providers').sort({ createdAt: -1 });
};

module.exports = {
    createCheckoutOrder,
    checkOrderStatus,
    handleCallback,
    getUserOrders,
    getAllOrdersAdmin,
};
