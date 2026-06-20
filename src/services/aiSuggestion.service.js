const fallbackSuggestionService = require('./fallbackSuggestion.service');

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

    return {
        provider: '',
        apiKey: '',
    };
};

const withTimeout = async (promiseFactory) => {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 10000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFactory(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
};

const getAiMaxTokens = () => Number(process.env.AI_MAX_TOKENS) || 1400;

const buildPrompt = ({ repoFullName, branch, filePath, score, endpointCount, smells }) => {
    const language = process.env.AI_RESPONSE_LANGUAGE || 'Vietnamese';
    const compactSmells = smells.slice(0, 20).map((smell) => ({
        ruleId: smell.ruleId,
        smellName: smell.smellName,
        severity: smell.severity,
        category: smell.category,
        endpoints: smell.endpoints,
        lineNumbers: smell.lineNumbers,
        description: smell.description,
        baselineSuggestion: smell.suggestion,
    }));

    return [
        'You are APILens, an API quality reviewer for students and junior developers.',
        `Respond in ${language}.`,
        '',
        'Your task:',
        '- Explain REST API smells in beginner-friendly language.',
        '- Give concrete fixes for the affected endpoint(s).',
        '- Prioritize Critical, then Medium, then Low severity.',
        '- Merge repeated findings when they have the same root cause.',
        '',
        'Important constraints:',
        '- Do not use emoji, checkmarks, cross marks, or decorative Unicode symbols.',
        '- Do not invent files, endpoints, handlers, database models, or business logic.',
        '- Do not claim runtime behavior that static analysis cannot prove.',
        '- For Express source files, if response codes are missing, say "static analysis did not detect documented status codes" instead of claiming the app has no error handling.',
        '- Avoid fenced code blocks unless absolutely necessary.',
        '- Keep code examples short, preferably one-line route examples.',
        '- Keep the whole answer concise enough for a dashboard card.',
        '- Finish every section completely. Do not stop mid-sentence or leave checklist items incomplete.',
        '',
        'Formatting rules:',
        '- Return clean Markdown only. No introduction before the first heading.',
        '- Put every heading, bullet, and paragraph on its own line.',
        '- Do not write a whole section as one long paragraph.',
        '- Use short bullets. Each bullet should be one sentence when possible.',
        '- Do not use nested bullets deeper than one level.',
        '',
        'Return Markdown with exactly these sections and labels:',
        '## Summary',
        '2 to 3 short sentences. Mention the score and the biggest risk.',
        '',
        '## Priority fixes',
        '- List at most 3 fixes.',
        '- For each fix use this format:',
        '- [Severity] [Rule ID] [Rule name]: affected endpoint(s) and line number(s).',
        '  - Why it matters: one short sentence.',
        '  - Suggested change: one concrete action, with a short endpoint or route example if helpful.',
        '',
        '## Quick checklist',
        '- 3 to 5 short action items.',
        '',
        `Repository: ${repoFullName || 'N/A'}`,
        `Branch: ${branch || 'N/A'}`,
        `File: ${filePath || 'N/A'}`,
        `Score: ${score}`,
        `Endpoint count: ${endpointCount}`,
        `Smells: ${JSON.stringify(compactSmells)}`,
    ].join('\n');
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
                    content: 'You provide concise API design review suggestions.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.2,
            max_tokens: getAiMaxTokens(),
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
            max_tokens: getAiMaxTokens(),
            temperature: 0.2,
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

const generateSuggestion = async (analysisInput) => {
    const smells = fallbackSuggestionService.applyFallbackSuggestions(analysisInput.smells || []);
    const fallbackSummary = fallbackSuggestionService.buildOverallFallbackSummary({
        ...analysisInput,
        smells,
    });
    const { provider, apiKey } = getProviderConfig();

    if (!provider || !apiKey) {
        return {
            smells,
            aiSuggestion: fallbackSummary,
            provider: 'fallback',
            usedFallback: true,
        };
    }

    try {
        const prompt = buildPrompt({
            ...analysisInput,
            smells,
        });
        const aiSuggestion = provider === 'openai'
            ? await callOpenAI(apiKey, prompt)
            : await callClaude(apiKey, prompt);

        return {
            smells,
            aiSuggestion: aiSuggestion || fallbackSummary,
            provider,
            usedFallback: !aiSuggestion,
        };
    } catch (error) {
        return {
            smells,
            aiSuggestion: fallbackSummary,
            provider: 'fallback',
            usedFallback: true,
            warning: `AI suggestion unavailable: ${error.message}`,
        };
    }
};

module.exports = {
    buildPrompt,
    generateSuggestion,
};
