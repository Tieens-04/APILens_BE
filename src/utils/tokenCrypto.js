const crypto = require('crypto');

const getKey = () => {
    const secret = process.env.OAUTH_TOKEN_SECRET || process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('OAUTH_TOKEN_SECRET or JWT_SECRET is required to encrypt OAuth tokens');
    }

    return crypto.createHash('sha256').update(secret).digest();
};

const encryptToken = (token) => {
    if (!token) {
        return undefined;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted].map((part) => part.toString('base64url')).join('.');
};

const decryptToken = (encryptedToken) => {
    if (!encryptedToken) {
        return undefined;
    }

    const [ivValue, authTagValue, encryptedValue] = encryptedToken.split('.');
    const iv = Buffer.from(ivValue, 'base64url');
    const authTag = Buffer.from(authTagValue, 'base64url');
    const encrypted = Buffer.from(encryptedValue, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);

    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

module.exports = {
    encryptToken,
    decryptToken,
};
