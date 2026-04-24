require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const db = require('./config/database');

const contentRoutes = require('./routes/content');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const mediaRoutes = require('./routes/media');
const progressRoutes = require('./routes/progress');
const favoritesRoutes = require('./routes/favorites');
const aiRoutes = require('./routes/ai');
const ttsRoutes = require('./routes/tts');
const adminRoutes = require('./routes/admin');

const app = express();
const port = parseInt(process.env.PORT, 10) || 3002;
const apiBase = process.env.API_BASE || '/api/v1';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.get('/health', function (_req, res) {
  res.json({ status: 'ok', service: 'lyc-media-server', storage: process.env.STORAGE_MODE || 'local' });
});

app.get(apiBase + '/status', async function (_req, res) {
  await db.ready;
  res.json({
    status: 'running',
    service: 'lyc-media-server',
    version: '1.0.0',
    storage: process.env.STORAGE_MODE || 'local',
    endpoints: {
      content: apiBase + '/content',
      auth: apiBase + '/auth',
      upload: apiBase + '/upload',
      media: apiBase + '/media',
      progress: apiBase + '/progress',
      favorites: apiBase + '/favorites',
      ai: apiBase + '/ai',
    },
  });
});

app.use(apiBase + '/content', contentRoutes);
app.use(apiBase + '/auth', authRoutes);
app.use(apiBase + '/upload', uploadRoutes);
app.use(apiBase + '/media', mediaRoutes);
app.use(apiBase + '/progress', progressRoutes);
app.use(apiBase + '/favorites', favoritesRoutes);
app.use(apiBase + '/ai', aiRoutes);
app.use(apiBase + '/tts', ttsRoutes);
app.use(apiBase + '/admin', adminRoutes);

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin', function (_req, res) {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.use(function (_req, res) {
  res.status(404).json({ error: 'Route not found.' });
});

app.use(function (err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

async function start() {
  await db.ready;
  app.listen(port, function () {
    console.log('='.repeat(50));
    console.log('LYC Media Server is ready');
    console.log('HTTP   : http://127.0.0.1:' + port);
    console.log('Status : http://127.0.0.1:' + port + apiBase + '/status');
    console.log('Storage: ' + (process.env.STORAGE_MODE || 'local'));
    console.log('='.repeat(50));
  });
}

if (require.main === module) {
  start().catch(function (err) { console.error(err); process.exit(1); });
}

module.exports = app;
