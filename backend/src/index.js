require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const statsRoutes = require('./routes/stats');
const syncRoutes = require('./routes/sync');
const photosRoutes = require('./routes/photos');
const configRoutes = require('./routes/config');
const settingsRoutes = require('./routes/settings');

const { errorHandler } = require('./middleware/errorHandler');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy pour servir les tuiles offline via /tiles/
const TILESERVER_URL = process.env.TILESERVER_URL || 'http://localhost:8080';
app.use('/tiles', createProxyMiddleware({
  target: `${TILESERVER_URL}/data/antananarivo`,
  pathRewrite: { '^/tiles': '' },
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.warn('⚠️ TileServer non disponible, les tuiles offline ne sont pas accessibles');
      res.status(503).json({ error: 'TileServer not available' });
    }
  }
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/config', configRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
});

module.exports = app;
