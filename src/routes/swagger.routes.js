const express = require('express');
const { protect, requirePremium } = require('../middlewares/auth.middleware');
const { generateSwaggerSpec, executeSwaggerEndpoint } = require('../controllers/swagger.controller');

const router = express.Router();

router.post('/generate', protect, requirePremium, generateSwaggerSpec);
router.post('/execute', protect, requirePremium, executeSwaggerEndpoint);

module.exports = router;
