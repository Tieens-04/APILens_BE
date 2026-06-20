const asyncHandler = require('../utils/asyncHandler');
const githubService = require('../services/github.service');

const listRepositories = asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const repositories = await githubService.listRepositories(req.user._id);
    const startIndex = (page - 1) * limit;
    const paginatedRepositories = repositories.slice(startIndex, startIndex + limit);

    res.status(200).json({
        repositories: paginatedRepositories,
        pagination: {
            page,
            limit,
            total: repositories.length,
            totalPages: Math.ceil(repositories.length / limit),
        },
    });
});

const listBranches = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const branches = await githubService.listBranches(req.user._id, owner, repo);

    res.status(200).json({
        branches,
    });
});

const getRepositoryTree = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { branch } = req.query;
    const tree = await githubService.getTree(req.user._id, owner, repo, branch);

    res.status(200).json(tree);
});

const scanRepository = asyncHandler(async (req, res) => {
    const { repoUrl, branch } = req.body;
    const results = await githubService.scanRepository(req.user._id, repoUrl, { branch });
    res.status(200).json(results);
});

module.exports = {
    listRepositories,
    listBranches,
    getRepositoryTree,
    scanRepository,
};
