const express = require('express');
const adminController = require('../controllers/admin.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/admin.middleware');

const router = express.Router();

// Require both user authentication AND admin guard (username === 'mit-suu' or role === 'admin')
router.use(protect);
router.use(requireAdmin);

router.get('/stats', adminController.getSystemStats);
router.get('/users', adminController.getUsersList);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/orders', adminController.getAllOrders);

module.exports = router;
