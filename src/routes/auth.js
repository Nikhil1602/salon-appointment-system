// Registration and login.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const router = express.Router();

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// POST /api/auth/register  { name, email, password, phone? }
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  // New sign-ups are always customers. Staff and admins are created by an admin.
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, phone, role) VALUES (?,?,?,?,?)')
    .run(name, email, hash, phone || null, 'customer');
  const user = { id: info.lastInsertRowid, role: 'customer' };
  res.status(201).json({ token: makeToken(user), user: { id: user.id, name, email, role: 'customer' } });
});

// POST /api/auth/login  { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({
    token: makeToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

module.exports = router;
