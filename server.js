// server.js corregido 
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
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

app.use('/api/schedules', scheduleRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor activo y conectado', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/uploads', express.static('uploads'));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT} y http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;