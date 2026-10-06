require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./db');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const lessonRoutes = require('./routes/lessons');

const app = express();
const PORT = process.env.PORT || 4000;

// Allows the React dev server (a different origin: localhost:5173) to call
// this API from the browser. Without this, browsers block the requests
// even though the server itself is reachable - tools like curl/PowerShell
// aren't affected since CORS is enforced by browsers, not the server.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: FRONTEND_URL }));

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/enrollments', enrollmentRoutes);
app.use('/courses/:courseId/lessons', lessonRoutes);

// Health check: confirms the API is up AND can reach Postgres.
app.get('/health', async (req, res) => {
  try {
    const dbOk = await checkConnection();
    res.json({
      status: 'ok',
      db: dbOk ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(503).json({
      status: 'error',
      db: 'unreachable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Javlearn API listening on http://localhost:${PORT}`);
});
