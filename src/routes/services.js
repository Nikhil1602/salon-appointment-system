// Service listings. Anyone can read them; only an admin can change them.

const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/services  (public) — active services, or all with ?all=1 for admins
router.get('/', (req, res) => {
  const all = req.query.all === '1';
  const rows = all
    ? db.prepare('SELECT * FROM services ORDER BY name').all()
    : db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();
  res.json(rows);
});

// GET /api/services/:id  (public)
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Service not found' });
  res.json(row);
});

// POST /api/services  (admin)  { name, description?, duration_min, price }
router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const { name, description, duration_min, price } = req.body || {};
  if (!name || !duration_min || price == null) {
    return res.status(400).json({ error: 'name, duration_min and price are required' });
  }
  const info = db
    .prepare('INSERT INTO services (name, description, duration_min, price) VALUES (?,?,?,?)')
    .run(name, description || null, duration_min, price);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/services/:id  (admin)
router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Service not found' });
  const { name, description, duration_min, price, active } = req.body || {};
  db.prepare(
    'UPDATE services SET name=?, description=?, duration_min=?, price=?, active=? WHERE id=?'
  ).run(
    name ?? current.name,
    description ?? current.description,
    duration_min ?? current.duration_min,
    price ?? current.price,
    active ?? current.active,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

// DELETE /api/services/:id  (admin) — soft delete by marking inactive
router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
