const express = require('express');
const repoController = require('../controllers/repo.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @apilens basePath /api/v1/repos
 */

router.use(protect);

/**
 * @apilens responses 200,401,403,429,500
 * @apilens param page query
 * @apilens param limit query
 */
router.get('/', repoController.listRepositories);
/**
 * @apilens responses 200,401,403,404,429,500
 * @apilens param owner
 * @apilens param repo
 */
router.get('/:owner/:repo/branches', repoController.listBranches);
/**
 * @apilens responses 200,401,403,404,429,500
 * @apilens param owner
 * @apilens param repo
 */
router.get('/:owner/:repo/tree', repoController.getRepositoryTree);

module.exports = router;
