const parseOrigins = (value) => (value || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const getAllowedOrigins = () => {
  const origins = [
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.CLIENT_URL),
    ...parseOrigins(process.env.FRONTEND_URL),
    'http://localhost:3000',
  ];

  return [...new Set(origins)];
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, '');
    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};

module.exports = {
  corsOptions,
  getAllowedOrigins,
};
