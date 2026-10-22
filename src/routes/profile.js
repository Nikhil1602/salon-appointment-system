// The logged-in customer's own profile.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/profile
router.get('/', (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, phone, role, preferences, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(user);
});

// PUT /api/profile  { name?, phone?, preferences?, password? }
router.put('/', (req, res) => {
  const { name, phone, preferences, password } = req.body || {};
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  db.prepare('UPDATE users SET name = ?, phone = ?, preferences = ?, password_hash = ? WHERE id = ?').run(
    name ?? current.name,
    phone ?? current.phone,
    preferences ?? current.preferences,
    password ? bcrypt.hashSync(password, 10) : current.password_hash,
    req.user.id
  );
  const updated = db
    .prepare('SELECT id, name, email, phone, role, preferences FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(updated);
});

module.exports = router;
