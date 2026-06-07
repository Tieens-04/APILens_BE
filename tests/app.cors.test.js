describe('CORS configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      CORS_ORIGINS: 'https://restly-fe.vercel.app, https://preview-restly-fe.vercel.app/',
      FRONTEND_URL: '',
      CLIENT_URL: '',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows configured Vercel origins without a trailing slash mismatch', () => {
    const { corsOptions } = require('../src/config/cors');
    const callback = jest.fn();

    corsOptions.origin('https://preview-restly-fe.vercel.app', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects origins that are not configured', () => {
    const { corsOptions } = require('../src/config/cors');
    const callback = jest.fn();

    corsOptions.origin('https://unknown.example.com', callback);

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
