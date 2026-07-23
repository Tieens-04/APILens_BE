const parserService = require('./parser.service');
const ApiError = require('../utils/ApiError');

const getProviderConfig = () => {
    const provider = (process.env.AI_PROVIDER || '').toLowerCase();

    if (provider === 'openai') {
        return {
            provider,
            apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
        };
    }

    if (provider === 'claude') {
        return {
            provider,
            apiKey: process.env.AI_API_KEY || process.env.CLAUDE_API_KEY,
        };
    }

    if (process.env.OPENAI_API_KEY) {
        return {
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY,
        };
    }

    return {
        provider: '',
        apiKey: '',
    };
};

const withTimeout = async (promiseFactory) => {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 20000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFactory(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
};

const callOpenAI = async (apiKey, prompt) => withTimeout(async (signal) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert developer assistant. You only output modified source code inside markdown code blocks, with no other text.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.1,
        }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || 'OpenAI request failed');
    }

    return payload.choices?.[0]?.message?.content?.trim() || '';
});

const callClaude = async (apiKey, prompt) => withTimeout(async (signal) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
            max_tokens: 4000,
            temperature: 0.1,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || 'Claude request failed');
    }

    return payload.content?.map((part) => part.text).filter(Boolean).join('\n').trim() || '';
});

const RULE_FIX_GUIDES = {
    R01: [
        'RULE R01 - Wrong HTTP Verb: The static analyzer checks if the URL path contains action words (create, add, delete, remove, update, edit, get, list, search) and verifies the HTTP method matches.',
        'FIX: Change the HTTP method to match the action word in the URL. For example, if the path contains "create" or "add", use POST. If it contains "delete" or "remove", use DELETE. If "update" or "edit", use PUT/PATCH. If "get", "list", or "search", use GET.',
        'ALTERNATIVELY: Remove the action verb from the URL entirely and use a resource-oriented path. E.g., change `router.post("/createUser", ...)` to `router.post("/users", ...)`.',
    ],
    R02: [
        'RULE R02 - Verb in URL: The static analyzer splits each URL path segment into words (splitting camelCase and kebab-case) and checks if any word is one of: create, add, delete, remove, update, edit, get, list, search, fetch, submit.',
        'FIX: Remove the verb from the URL path. Use resource nouns instead. Examples:',
        '  - `/getUsers` → `/users` (use GET method)',
        '  - `/createOrder` → `/orders` (use POST method)',
        '  - `/deleteUser/:id` → `/users/:id` (use DELETE method)',
        '  - `/updateProfile` → `/profile` (use PUT/PATCH method)',
        '  - `/login` and `/logout` are acceptable (they are not in the verb list)',
    ],
    R03: [
        'RULE R03 - Inconsistent Naming: The analyzer checks if all URL segments use the same naming convention across endpoints. It detects snake_case (has underscore), camelCase (has uppercase), and lowercase-resource (all lowercase, may have hyphens).',
        'FIX: Convert ALL URL path segments to the same convention, preferably lowercase (e.g., /users, /user-profile). Do NOT mix camelCase and snake_case in URL segments.',
    ],
    R04: [
        'RULE R04 - Missing Error Status Code: The analyzer checks if each endpoint documents at least one error response (status code >= 400).',
        'FIX: Add a JSDoc comment directly above the route definition documenting success (200/201) AND at least one error status code (400, 401, 404, 500). E.g.:',
        '/**',
        ' * GET /cart',
        ' * @returns {200} Success',
        ' * @returns {400} Bad Request',
        ' * @returns {500} Server Error',
        ' */',
        'router.get("/cart", ...);',
    ],
    R05: [
        'RULE R05 - No Pagination: The analyzer checks GET endpoints returning collections. It looks for pagination parameters (page, limit, offset, etc.) in comments or query params.',
        'FIX: For Express GET collection routes, document pagination parameters with `@param page` and `@param limit` in the JSDoc comment above the route.',
    ],
    R06: [
        'RULE R06 - Undocumented Params: Path parameters like `:itemId` must have matching `@param itemId` documentation.',
        'FIX: Add `@param <paramName>` to the JSDoc comment directly above the route call. E.g.:',
        '/**',
        ' * @param itemId Item identifier',
        ' * @returns {200} Success',
        ' * @returns {404} Not Found',
        ' */',
        'router.delete("/items/:itemId", ...);',
    ],
    R07: [
        'RULE R07 - Hardcoded Secrets: The analyzer scans the ENTIRE file content for hardcoded keys, tokens, passwords, or credentials.',
        'FIX: Replace hardcoded secrets with environment variable references (e.g., process.env.API_KEY).',
    ],
    R08: [
        'RULE R08 - Missing Versioning: Checks if each endpoint path starts with a version prefix like /api/v1/ or /v1/.',
        'FIX: Either prefix all route paths with `/api/v1/` (e.g., `router.get("/api/v1/cart", ...)`) OR add a top comment `/** @apilens basePath /api/v1/cart */` at the beginning of the file.',
    ],
    R09: [
        'RULE R09 - Inconsistent Response Shape: For OpenAPI specs, checks if success response schemas have consistent shapes across endpoints.',
        'FIX: Use a consistent response envelope like { data, meta, error } across all endpoints.',
    ],
};

const buildFixPrompt = ({ content, fileType, filePath, smell }) => {
    const ruleGuide = RULE_FIX_GUIDES[smell.ruleId] || [];

    return [
        'You are an expert RESTful API designer. You must fix a specific design smell detected by a STATIC ANALYSIS tool.',
        '',
        '## Smell Details',
        `- Rule ID: ${smell.ruleId}`,
        `- Smell Name: ${smell.smellName}`,
        `- Description: ${smell.description}`,
        `- Affected Endpoints: ${JSON.stringify(smell.endpoints)}`,
        `- Affected Lines: ${JSON.stringify(smell.lineNumbers)}`,
        `- Suggested Fix: ${smell.suggestion}`,
        '',
        '## How the Static Analyzer Detects This Smell',
        ...ruleGuide,
        '',
        '## File Info',
        `- File Path: ${filePath}`,
        `- File Type: ${fileType}`,
        '',
        '## Instructions',
        '1. You MUST modify the code so that the static analyzer will NO LONGER detect this smell after re-scanning.',
        '2. The output MUST differ from the input. Do NOT return the same code unchanged.',
        '3. Preserve all other code, comments, and logic exactly as they are.',
        '4. Do NOT add unrelated routes or functions.',
        '5. Return ONLY the complete modified source code inside a single fenced code block (e.g., ```javascript ... ```).',
        '6. Do NOT include any explanation, notes, or commentary outside the code block.',
        '',
        '## Source Code',
        '```',
        content,
        '```'
    ].join('\n');
};

const extractCode = (responseContent) => {
    const codeBlockRegex = /```[\w-]*\n([\s\S]*?)\n```/;
    const match = responseContent.match(codeBlockRegex);
    if (match && match[1]) {
        return match[1].trim();
    }
    const simpleRegex = /```[\w-]*([\s\S]*?)```/;
    const simpleMatch = responseContent.match(simpleRegex);
    if (simpleMatch && simpleMatch[1]) {
        return simpleMatch[1].trim();
    }
    return responseContent.trim();
};

const generateFix = async ({ content, fileType, filePath, smell }) => {
    const { provider, apiKey } = getProviderConfig();

    if (!provider || !apiKey) {
        throw new ApiError(500, 'AI provider is not configured. Unable to generate fixes.', 'AI_NOT_CONFIGURED');
    }

    const prompt = buildFixPrompt({ content, fileType, filePath, smell });
    let rawResponse = '';

    if (provider === 'openai') {
        rawResponse = await callOpenAI(apiKey, prompt);
    } else {
        rawResponse = await callClaude(apiKey, prompt);
    }

    const fixedCode = extractCode(rawResponse);

    // Normalize line endings for comparison (GitHub returns \r\n, AI returns \n)
    const normalizeWhitespace = (str) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const isIdentical = normalizeWhitespace(fixedCode) === normalizeWhitespace(content);

    console.log('[AI_FIX_DEBUG] Is identical to original:', isIdentical);

    if (!fixedCode || isIdentical) {
        throw new ApiError(422, 'AI was unable to generate a valid modification for this design smell.', 'AI_FIX_FAILED');
    }

    // Run code validation (parse the modified code)
    try {
        parserService.parseContent({
            content: fixedCode,
            fileType,
            sourceFile: filePath,
        });
    } catch (parseError) {
        throw new ApiError(422, `AI generated invalid code structure: ${parseError.message}`, 'AI_FIX_VALIDATION_ERROR');
    }

    return fixedCode;
};

module.exports = {
    generateFix,
};
