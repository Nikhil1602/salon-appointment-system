// Express server entry point. Wires up the routes, serves the test frontend, and starts the
// reminder cron job.

const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
require('./db'); // create the schema on startup
const reminders = require('./reminders');

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/services', require('./routes/services'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the plain HTML/JS test frontend from /public.
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSON 404 for unknown API routes.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Catch errors thrown in handlers so the process does not crash.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(config.port, () => {
  console.log(`Salon appointment system running at http://localhost:${config.port}`);
  console.log('Open that URL in a browser to use the test frontend.');
  reminders.start();
});
