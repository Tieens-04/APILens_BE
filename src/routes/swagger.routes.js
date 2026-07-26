const express = require('express');
const { protect, requirePremium } = require('../middlewares/auth.middleware');
const { generateSwaggerSpec, executeSwaggerEndpoint, exportPostmanCollection } = require('../controllers/swagger.controller');

const router = express.Router();

router.post('/generate', protect, requirePremium, generateSwaggerSpec);
router.post('/execute', protect, requirePremium, executeSwaggerEndpoint);
router.post('/export/postman', protect, requirePremium, exportPostmanCollection);

module.exports = router;
