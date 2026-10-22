// Customer reviews and staff replies.

const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews?staff_id=  (public) — all reviews, or one staff member's
router.get('/', (req, res) => {
  const { staff_id } = req.query;
  const sql = `SELECT r.*, u.name AS customer_name, st.name AS staff_name
               FROM reviews r
               JOIN users u ON u.id = r.user_id
               JOIN staff st ON st.id = r.staff_id`;
  const rows = staff_id
    ? db.prepare(`${sql} WHERE r.staff_id = ? ORDER BY r.created_at DESC`).all(staff_id)
    : db.prepare(`${sql} ORDER BY r.created_at DESC`).all();
  res.json(rows);
});

// POST /api/reviews  (customer)  { appointment_id, rating, comment? }
// You can only review your own completed appointment, once.
router.post('/', authRequired, (req, res) => {
  const { appointment_id, rating, comment } = req.body || {};
  if (!appointment_id || !rating) {
    return res.status(400).json({ error: 'appointment_id and rating are required' });
  }
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1 to 5' });

  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id);
  if (!appt || appt.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  const exists = db.prepare('SELECT id FROM reviews WHERE appointment_id = ?').get(appointment_id);
  if (exists) return res.status(409).json({ error: 'This appointment is already reviewed' });

  const info = db
    .prepare('INSERT INTO reviews (appointment_id, user_id, staff_id, rating, comment) VALUES (?,?,?,?,?)')
    .run(appointment_id, req.user.id, appt.staff_id, rating, comment || null);
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/reviews/:id/reply  (staff or admin)  { reply }
router.put('/:id/reply', authRequired, requireRole('staff', 'admin'), (req, res) => {
  const { reply } = req.body || {};
  if (!reply) return res.status(400).json({ error: 'reply is required' });
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  db.prepare('UPDATE reviews SET staff_reply = ? WHERE id = ?').run(reply, req.params.id);
  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

module.exports = router;
