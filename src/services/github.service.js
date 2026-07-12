const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const { decryptToken } = require('../utils/tokenCrypto');

const GITHUB_API_URL = 'https://api.github.com';
const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build'];
const SUPPORTED_EXTENSIONS = ['.js', '.json', '.yaml', '.yml'];

const getGithubAccessToken = async (userId) => {
    const user = await User.findById(userId).select('+providers.github.accessToken');
    const encryptedToken = user?.providers?.github?.accessToken;

    if (!encryptedToken) {
        throw new ApiError(403, 'Please login with GitHub before accessing repositories', 'GITHUB_AUTH_REQUIRED');
    }

    return decryptToken(encryptedToken);
};

const githubFetch = async (accessToken, path, options = {}) => {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'APILens',
            ...(options.headers || {}),
        },
    });

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

    if (response.status === 401) {
        throw new ApiError(401, 'GitHub token is invalid or expired. Please login with GitHub again.', 'GITHUB_TOKEN_INVALID');
    }

    if (response.status === 403 && rateLimitRemaining === '0') {
        throw new ApiError(429, 'GitHub API rate limit exceeded. Please try again later.', 'RATE_LIMITED');
    }

    const payload = response.status === 204 ? null : await response.json();

    if (!response.ok) {
        throw new ApiError(
            response.status,
            payload?.message || 'GitHub API request failed',
            response.status === 404 ? 'REPO_NOT_FOUND' : 'GITHUB_API_ERROR'
        );
    }

    return {
        payload,
        headers: response.headers,
    };
};

const getNextLink = (linkHeader) => {
    if (!linkHeader) {
        return null;
    }

    const nextLink = linkHeader
        .split(',')
        .map((part) => part.trim())
        .find((part) => part.endsWith('rel="next"'));

    return nextLink?.match(/<([^>]+)>/)?.[1] || null;
};

const githubFetchAll = async (accessToken, path) => {
    let url = `${GITHUB_API_URL}${path}`;
    const results = [];

    while (url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'APILens',
            },
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new ApiError(response.status, payload?.message || 'GitHub API request failed', 'GITHUB_API_ERROR');
        }

        results.push(...payload);
        url = getNextLink(response.headers.get('link'));
    }

    return results;
};

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

const hasIgnoredDirectory = (path) => {
    const segments = path.split('/');

    return segments.some((segment) => IGNORED_DIRECTORIES.includes(segment));
};

const getExtension = (path) => {
    const match = path.toLowerCase().match(/\.[^.]+$/);

    return match ? match[0] : '';
};

const shouldInspectFile = (file) => {
    if (file.type !== 'blob' || hasIgnoredDirectory(file.path)) {
        return false;
    }

    return SUPPORTED_EXTENSIONS.includes(getExtension(file.path));
};

const decodeContentPayload = (payload) => {
    if (!payload || payload.type !== 'file' || !payload.content) {
        return '';
    }

    return Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
};

const detectJsonFileType = (content) => {
    try {
        const parsed = JSON.parse(content);

        if (parsed.openapi || parsed.swagger) {
            return 'openapi';
        }

        if (typeof parsed.info?.schema === 'string' && parsed.info.schema.toLowerCase().includes('postman')) {
            return 'postman';
        }
    } catch (error) {
        return null;
    }

    return null;
};

const detectYamlFileType = (content) => {
    if (/^\s*(openapi|swagger)\s*:/im.test(content)) {
        return 'openapi';
    }

    return null;
};

const detectExpressFileType = (content) => {
    if (/\b(router|app)\s*\.\s*(get|post|put|patch|delete)\s*\(/i.test(content)) {
        return 'express';
    }

    return null;
};

const detectFileType = (path, content) => {
    const extension = getExtension(path);

    if (extension === '.json') {
        return detectJsonFileType(content);
    }

    if (extension === '.yaml' || extension === '.yml') {
        return detectYamlFileType(content);
    }

    if (extension === '.js') {
        return detectExpressFileType(content);
    }

    return null;
};

const listRepositories = async (userId) => {
    const accessToken = await getGithubAccessToken(userId);
    const repositories = await githubFetchAll(
        accessToken,
        '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
    );

    return repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        watchers_count: repo.watchers_count,
        open_issues_count: repo.open_issues_count,
        language: repo.language,
    }));
};

const listBranches = async (userId, owner, repo) => {
    const accessToken = await getGithubAccessToken(userId);
    const branches = await githubFetchAll(accessToken, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);

    return branches.map((branch) => ({
        name: branch.name,
        protected: branch.protected,
        sha: branch.commit?.sha,
    }));
};

const fetchRepositoryFileContent = async (accessToken, owner, repo, path, branch) => {
    const encodedPath = encodePath(path);
    const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const { payload } = await githubFetch(accessToken, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${refQuery}`);

    return decodeContentPayload(payload);
};

const fetchUserRepositoryFileContent = async (userId, owner, repo, path, branch) => {
    const accessToken = await getGithubAccessToken(userId);

    return fetchRepositoryFileContent(accessToken, owner, repo, path, branch);
};

const getTree = async (userId, owner, repo, branch) => {
    const accessToken = await getGithubAccessToken(userId);
    const safeBranch = branch || 'main';
    const { payload } = await githubFetch(
        accessToken,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(safeBranch)}?recursive=1`
    );

    const maxFileSizeBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;
    const tree = payload.tree || [];
    const inspectableFiles = tree.filter((file) => shouldInspectFile(file) && (!file.size || file.size <= maxFileSizeBytes));
    const detectedFiles = [];

    for (const file of inspectableFiles) {
        const content = await fetchRepositoryFileContent(accessToken, owner, repo, file.path, safeBranch);
        const detectedAs = detectFileType(file.path, content);

        if (detectedAs) {
            detectedFiles.push({
                path: file.path,
                type: 'file',
                detectedAs,
                size: file.size || Buffer.byteLength(content, 'utf8'),
            });
        }
    }

    return {
        branch: safeBranch,
        totalFiles: tree.filter((item) => item.type === 'blob').length,
        detectedFiles,
        grouped: {
            openapi: detectedFiles.filter((file) => file.detectedAs === 'openapi'),
            postman: detectedFiles.filter((file) => file.detectedAs === 'postman'),
            express: detectedFiles.filter((file) => file.detectedAs === 'express'),
        },
        warnings: [
            ...(tree.length > 1000 ? ['Repository has more than 1000 tree items. Analysis may be slower.'] : []),
            ...(payload.truncated ? ['GitHub returned a truncated file tree. Some files may be missing.'] : []),
        ],
    };
};

module.exports = {
    listRepositories,
    listBranches,
    getTree,
    getGithubAccessToken,
    fetchRepositoryFileContent,
    fetchUserRepositoryFileContent,
};
