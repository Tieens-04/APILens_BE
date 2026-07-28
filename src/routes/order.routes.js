const express = require('express');
const orderController = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public callback endpoint (called by payment_service)
/**
 * POST /callback
 * @returns {200} Payment callback processed successfully
 * @returns {400} Bad Request - Invalid callback data
 * @returns {500} Server Error - Failed to process callback
 */
router.post('/callback', orderController.paymentCallback);

// Protected routes (require user login)
router.use(protect);
router.post('/checkout', orderController.checkout);
router.get('/my-orders', orderController.getUserOrders);
router.get('/:id/status', orderController.getOrderStatus);

module.exports = router;