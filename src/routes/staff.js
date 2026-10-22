// Staff profiles and the services each staff member can perform.
// Reading is public (so customers can pick a stylist); changes are admin-only.

const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

function withServices(staff) {
  const services = db
    .prepare(
      `SELECT s.* FROM services s
       JOIN staff_services ss ON ss.service_id = s.id
       WHERE ss.staff_id = ?`
    )
    .all(staff.id);
  return { ...staff, services };
}

// GET /api/staff  (public)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM staff ORDER BY name').all();
  res.json(rows.map(withServices));
});

// GET /api/staff/:id  (public)
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Staff not found' });
  res.json(withServices(row));
});

// POST /api/staff  (admin)  { name, specialization?, work_start?, work_end?, user_id?, service_ids? }
router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const { name, specialization, work_start, work_end, user_id, service_ids } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const info = db
    .prepare(
      'INSERT INTO staff (name, specialization, work_start, work_end, user_id) VALUES (?,?,?,?,?)'
    )
    .run(name, specialization || null, work_start || '09:00', work_end || '17:00', user_id || null);
  const staffId = info.lastInsertRowid;

  // If linked to a user account, promote that user to the 'staff' role.
  if (user_id) db.prepare("UPDATE users SET role = 'staff' WHERE id = ?").run(user_id);
  assignServices(staffId, service_ids);

  res.status(201).json(withServices(db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId)));
});

// PUT /api/staff/:id  (admin)
router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Staff not found' });
  const { name, specialization, work_start, work_end, service_ids } = req.body || {};
  db.prepare(
    'UPDATE staff SET name=?, specialization=?, work_start=?, work_end=? WHERE id=?'
  ).run(
    name ?? current.name,
    specialization ?? current.specialization,
    work_start ?? current.work_start,
    work_end ?? current.work_end,
    req.params.id
  );
  if (Array.isArray(service_ids)) assignServices(req.params.id, service_ids);
  res.json(withServices(db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)));
});

// DELETE /api/staff/:id  (admin)
router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Replaces a staff member's assigned services with the given list.
function assignServices(staffId, serviceIds) {
  if (!Array.isArray(serviceIds)) return;
  db.prepare('DELETE FROM staff_services WHERE staff_id = ?').run(staffId);
  const insert = db.prepare('INSERT OR IGNORE INTO staff_services (staff_id, service_id) VALUES (?,?)');
  for (const sid of serviceIds) insert.run(staffId, sid);
}

module.exports = router;
