// Admin dashboard: manage customers and all appointments. Admin-only.

const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

// GET /api/admin/users  — all users
router.get('/users', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC').all());
});

// PUT /api/admin/users/:id/role  { role }  — change a user's role
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!['customer', 'staff', 'admin'].includes(role)) {
    return res.status(400).json({ error: "role must be 'customer', 'staff' or 'admin'" });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id  — remove a customer account
router.delete('/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/appointments  — every appointment with names
router.get('/appointments', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT a.*, s.name AS service_name, st.name AS staff_name, u.name AS customer_name, u.email AS customer_email
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN staff st ON st.id = a.staff_id
         JOIN users u ON u.id = a.user_id
         ORDER BY a.start_time DESC`
      )
      .all()
  );
});

// PUT /api/admin/appointments/:id  { status?, payment_status? }
router.put('/appointments/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Appointment not found' });
  const { status, payment_status } = req.body || {};
  db.prepare('UPDATE appointments SET status = ?, payment_status = ? WHERE id = ?').run(
    status ?? current.status,
    payment_status ?? current.payment_status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id));
});

module.exports = router;
