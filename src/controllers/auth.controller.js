const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signAuthToken } = require('../utils/jwt');
const { encryptToken } = require('../utils/tokenCrypto');

const sendAuthResponse = (res, user, statusCode = 200) => {
    const token = signAuthToken(user);

    res.status(statusCode).json({
        token,
        user: user.toAuthJSON(),
    });
};

const buildOAuthRedirect = (provider, token) => {
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const url = new URL('/auth/callback', frontendUrl);

    url.searchParams.set('provider', provider);
    url.searchParams.set('token', token);

    return url.toString();
};

const requireEnv = (name) => {
    if (!process.env[name]) {
        throw new ApiError(500, `${name} is missing in .env`, 'MISSING_ENV');
    }

    return process.env[name];
};

const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, 'Email and password are required', 'VALIDATION_ERROR');
    }

    if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
        throw new ApiError(409, 'Email is already registered', 'EMAIL_ALREADY_EXISTS');
    }

    const user = await User.create({
        name,
        email,
        password,
        providers: {
            local: true,
        },
    });

    sendAuthResponse(res, user, 201);
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, 'Email and password are required', 'VALIDATION_ERROR');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !user.password || !(await user.comparePassword(password))) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    sendAuthResponse(res, user);
});

const me = asyncHandler(async (req, res) => {
    res.status(200).json({
        user: req.user.toAuthJSON(),
    });
});

const logout = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
    });
});

const redirectToGoogle = asyncHandler(async (req, res) => {
    const clientId = requireEnv('GOOGLE_CLIENT_ID');
    const callbackUrl = requireEnv('GOOGLE_CALLBACK_URL');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'select_account');

    res.redirect(url.toString());
});

const googleCallback = asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        throw new ApiError(400, 'Google authorization code is required', 'MISSING_OAUTH_CODE');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id: requireEnv('GOOGLE_CLIENT_ID'),
            client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
            redirect_uri: requireEnv('GOOGLE_CALLBACK_URL'),
            grant_type: 'authorization_code',
        }),
    });

    const tokenPayload = await tokenResponse.json();

    if (!tokenResponse.ok) {
        throw new ApiError(401, tokenPayload.error_description || 'Google OAuth failed', 'GOOGLE_OAUTH_FAILED');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`,
        },
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok) {
        throw new ApiError(401, 'Unable to fetch Google profile', 'GOOGLE_PROFILE_FAILED');
    }

    const query = profile.email
        ? { $or: [{ 'providers.google.id': profile.sub }, { email: profile.email.toLowerCase() }] }
        : { 'providers.google.id': profile.sub };

    const user = await User.findOneAndUpdate(
        query,
        {
            $set: {
                name: profile.name,
                email: profile.email?.toLowerCase(),
                avatarUrl: profile.picture,
                'providers.google.id': profile.sub,
            },
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );

    const token = signAuthToken(user);

    res.redirect(buildOAuthRedirect('google', token));
});

const redirectToGithub = asyncHandler(async (req, res) => {
    const clientId = requireEnv('GITHUB_CLIENT_ID');
    const callbackUrl = requireEnv('GITHUB_CALLBACK_URL');
    const url = new URL('https://github.com/login/oauth/authorize');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('scope', 'read:user user:email repo');

    res.redirect(url.toString());
});

const fetchGithubPrimaryEmail = async (accessToken) => {
    const response = await fetch('https://api.github.com/user/emails', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'APILens',
        },
    });

    if (!response.ok) {
        return undefined;
    }

    const emails = await response.json();
    const primaryEmail = emails.find((email) => email.primary && email.verified) || emails.find((email) => email.verified);

    return primaryEmail?.email;
};

const githubCallback = asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        throw new ApiError(400, 'GitHub authorization code is required', 'MISSING_OAUTH_CODE');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: requireEnv('GITHUB_CLIENT_ID'),
            client_secret: requireEnv('GITHUB_CLIENT_SECRET'),
            code,
            redirect_uri: requireEnv('GITHUB_CALLBACK_URL'),
        }),
    });

    const tokenPayload = await tokenResponse.json();

    if (!tokenResponse.ok || tokenPayload.error) {
        throw new ApiError(401, tokenPayload.error_description || 'GitHub OAuth failed', 'GITHUB_OAUTH_FAILED');
    }

    const profileResponse = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'APILens',
        },
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok) {
        throw new ApiError(401, 'Unable to fetch GitHub profile', 'GITHUB_PROFILE_FAILED');
    }

    const email = profile.email || (await fetchGithubPrimaryEmail(tokenPayload.access_token));
    const query = email
        ? { $or: [{ 'providers.github.id': String(profile.id) }, { email: email.toLowerCase() }] }
        : { 'providers.github.id': String(profile.id) };

    const user = await User.findOneAndUpdate(
        query,
        {
            $set: {
                name: profile.name || profile.login,
                email: email?.toLowerCase(),
                avatarUrl: profile.avatar_url,
                'providers.github.id': String(profile.id),
                'providers.github.username': profile.login,
                'providers.github.accessToken': encryptToken(tokenPayload.access_token),
            },
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );

    const token = signAuthToken(user);

    res.redirect(buildOAuthRedirect('github', token));
});

module.exports = {
    register,
    login,
    me,
    logout,
    redirectToGoogle,
    googleCallback,
    redirectToGithub,
    githubCallback,
};
