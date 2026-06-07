const express = require('express');
const parserController = require('../controllers/parser.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @apilens basePath /api/v1/parser
 */

router.use(protect);

/**
 * @apilens responses 200,400,401,422,500
 */
router.post('/preview', parserController.previewParse);
/**
 * @apilens responses 200,400,401,422,500
 */
router.post('/analyze-preview', parserController.previewAnalyze);

module.exports = router;
