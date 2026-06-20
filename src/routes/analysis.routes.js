const express = require('express');
const analysisController = require('../controllers/analysis.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @apilens basePath /api/v1/analyses
 */

router.use(protect);

/**
 * @apilens responses 201,400,401,403,404,422,429,500
 */
router.post('/', analysisController.createAnalysis);
/**
 * @apilens responses 200,401,500
 * @apilens param page query
 * @apilens param limit query
 */
router.get('/me', analysisController.listMyAnalyses);
/**
 * @apilens responses 200,400,401,422,500
 */
router.post('/vscode', analysisController.analyzeVSCodeContent);
/**
 * @apilens responses 201,400,401,403,404,422,429,500
 * @apilens param id
 */
router.post('/:id/rerun', analysisController.rerunAnalysis);
/**
 * @apilens responses 200,400,401,404,500
 * @apilens param id
 * @apilens param format query
 */
router.get('/:id/export', analysisController.exportAnalysis);
/**
 * @apilens responses 200,401,404,500
 * @apilens param id
 */
router.get('/:id', analysisController.getAnalysis);
/**
 * @apilens responses 200,401,404,500
 * @apilens param id
 */
router.delete('/:id', analysisController.deleteAnalysis);

module.exports = router;
