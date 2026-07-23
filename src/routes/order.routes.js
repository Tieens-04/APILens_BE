const express = require('express');
const orderController = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public callback endpoint (called by payment_service)
router.post('/callback', orderController.paymentCallback);

// Protected routes (require user login)
router.use(protect);
router.post('/checkout', orderController.checkout);
router.get('/my-orders', orderController.getUserOrders);
router.get('/:id/status', orderController.getOrderStatus);

module.exports = router;
