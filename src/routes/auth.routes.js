const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @apilens basePath /api/v1/auth
 */

/**
 * @apilens responses 200,401,500
 */
router.get('/me', protect, authController.me);
/**
 * @apilens responses 200,401,500
 */
router.post('/logout', protect, authController.logout);

/**
 * @apilens responses 302,500
 */
router.get('/github', authController.redirectToGithub);
/**
 * @apilens responses 302,400,401,500
 */
router.get('/github/callback', authController.githubCallback);

module.exports = router;
