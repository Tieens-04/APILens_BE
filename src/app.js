const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const repoRoutes = require('./routes/repo.routes');
const parserRoutes = require('./routes/parser.routes');
const analysisRoutes = require('./routes/analysis.routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Restly Backend is running successfully' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/repos', repoRoutes);
app.use('/api/v1/parser', parserRoutes);
app.use('/api/v1/analyses', analysisRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
