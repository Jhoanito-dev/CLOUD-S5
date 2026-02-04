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

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy pour servir les tuiles offline via /tiles/
// Désactivé en mode local sans Docker - le frontend utilisera OpenStreetMap
// Pour activer: décommenter et lancer TileServer sur le port 8080
/*
app.use('/tiles', require('http-proxy-middleware').createProxyMiddleware({
  target: 'http://localhost:8080/data/antananarivo',
  pathRewrite: { '^/tiles': '' },
  changeOrigin: true,
}));
*/

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
