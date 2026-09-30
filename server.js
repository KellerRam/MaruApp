// server.js corregido 
const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');
require('dotenv').config();

const app = express();
const corsOrigins = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.has(origin) || (process.env.NODE_ENV !== 'production' && corsOrigins.size === 0)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const authRoutes = require('./src/routes/authRoutes');
const groupRoutes = require('./src/routes/groupRoutes');
const calendarRoutes = require('./src/routes/calendarRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');
const financeRoutes = require('./src/routes/financeRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const symptomRoutes = require('./src/routes/symptomRoutes');
const emergencyRoutes = require('./src/routes/emergencyRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');

app.use('/api/schedules', scheduleRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', message: 'Servidor activo y conectado', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check de PostgreSQL falló:', error.message);
    return res.status(503).json({ status: 'error', message: 'Base de datos no disponible' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/notifications', notificationRoutes);

if (require.main === module) {
  const { iniciarProgramadorNotificaciones } = require('./src/utils/notificationScheduler');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT} y http://0.0.0.0:${PORT}`);
    iniciarProgramadorNotificaciones();
  });
}

module.exports = app;