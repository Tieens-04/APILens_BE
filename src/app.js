const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { corsOptions } = require('./config/cors');
const authRoutes = require('./routes/auth.routes');
const repoRoutes = require('./routes/repo.routes');
const parserRoutes = require('./routes/parser.routes');
const analysisRoutes = require('./routes/analysis.routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(helmet());
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(cors(corsOptions));
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    name: 'APILens Backend',
    health: '/health',
    apiBase: '/api/v1',
  });
});

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
