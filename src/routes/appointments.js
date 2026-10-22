// Appointment booking, viewing, rescheduling and cancelling.

const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const { charge } = require('../services/payment');

const router = express.Router();

// --- helpers ---------------------------------------------------------------

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function pad(n) {
  return String(n).padStart(2, '0');
}
// "2026-11-01" + minutes-from-midnight -> "2026-11-01T10:30"
function slotToIso(date, minutes) {
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// Free start times for a staff member on a date, given the service length.
// Slots step every 30 minutes within working hours and skip times that overlap a booked
// appointment. Returns an array of ISO date-times.
function availableSlots(staffId, serviceId, date) {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!staff || !service) return [];

  const dayStart = toMinutes(staff.work_start);
  const dayEnd = toMinutes(staff.work_end);
  const step = 30;

  // Existing appointments for this staff member on this date, as [start, end] minute pairs.
  const busy = db
    .prepare(
      `SELECT start_time, end_time FROM appointments
       WHERE staff_id = ? AND status = 'booked' AND substr(start_time, 1, 10) = ?`
    )
    .all(staffId, date)
    .map((a) => [toMinutes(a.start_time.slice(11, 16)), toMinutes(a.end_time.slice(11, 16))]);

  const slots = [];
  for (let t = dayStart; t + service.duration_min <= dayEnd; t += step) {
    const end = t + service.duration_min;
    const clash = busy.some(([bs, be]) => t < be && end > bs);
    if (!clash) slots.push(slotToIso(date, t));
  }
  return slots;
}

// --- availability ----------------------------------------------------------

// GET /api/appointments/slots?staff_id=&service_id=&date=YYYY-MM-DD  (public)
router.get('/slots', (req, res) => {
  const { staff_id, service_id, date } = req.query;
  if (!staff_id || !service_id || !date) {
    return res.status(400).json({ error: 'staff_id, service_id and date are required' });
  }
  res.json({ slots: availableSlots(staff_id, service_id, date) });
});

// --- everything below needs login -----------------------------------------
router.use(authRequired);

function detailed(appt) {
  return db
    .prepare(
      `SELECT a.*, s.name AS service_name, s.price, st.name AS staff_name, u.name AS customer_name, u.email AS customer_email
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
       JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`
    )
    .get(appt.id);
}

// POST /api/appointments  { staff_id, service_id, start_time, pay? }
// Books a slot. If pay is true the mock/real payment runs and the booking is marked paid.
router.post('/', (req, res) => {
  const { staff_id, service_id, start_time, pay } = req.body || {};
  if (!staff_id || !service_id || !start_time) {
    return res.status(400).json({ error: 'staff_id, service_id and start_time are required' });
  }
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  // The staff member must offer this service.
  const offers = db
    .prepare('SELECT 1 FROM staff_services WHERE staff_id = ? AND service_id = ?')
    .get(staff_id, service_id);
  if (!offers) return res.status(400).json({ error: 'This staff member does not offer that service' });

  // The chosen start must be a currently free slot.
  const date = start_time.slice(0, 10);
  if (!availableSlots(staff_id, service_id, date).includes(start_time)) {
    return res.status(409).json({ error: 'That slot is not available' });
  }

  const endMin = toMinutes(start_time.slice(11, 16)) + service.duration_min;
  const end_time = slotToIso(date, endMin);

  let payment_status = 'unpaid';
  let paymentInfo = null;
  if (pay) {
    // In mock mode this always succeeds; see src/services/payment.js.
    // (await is fine: express allows async handlers via the catch wrapper in server.js)
  }

  const info = db
    .prepare(
      `INSERT INTO appointments (user_id, staff_id, service_id, start_time, end_time, payment_status)
       VALUES (?,?,?,?,?,?)`
    )
    .run(req.user.id, staff_id, service_id, start_time, end_time, payment_status);
  const appt = { id: info.lastInsertRowid };

  const finish = (extra) => {
    const full = detailed(appt);
    // Confirmation email (console by default).
    sendEmail({
      to: full.customer_email,
      subject: 'Your salon appointment is confirmed',
      text: `Hi ${full.customer_name}, your ${full.service_name} with ${full.staff_name} is booked for ${full.start_time}.`,
    }).catch(() => {});
    res.status(201).json({ ...full, payment: extra || paymentInfo });
  };

  if (pay) {
    charge({ amount: service.price, description: `Service: ${service.name}` })
      .then((result) => {
        db.prepare('UPDATE appointments SET payment_status = ? WHERE id = ?').run('paid', appt.id);
        finish(result);
      })
      .catch((e) => res.status(502).json({ error: 'Payment failed: ' + e.message }));
  } else {
    finish();
  }
});

// GET /api/appointments  — the logged-in customer's own appointments (staff/admin see all)
router.get('/', (req, res) => {
  const base = `SELECT a.*, s.name AS service_name, s.price, st.name AS staff_name
                FROM appointments a
                JOIN services s ON s.id = a.service_id
                JOIN staff st ON st.id = a.staff_id`;
  const rows =
    req.user.role === 'customer'
      ? db.prepare(`${base} WHERE a.user_id = ? ORDER BY a.start_time DESC`).all(req.user.id)
      : db.prepare(`${base} ORDER BY a.start_time DESC`).all();
  res.json(rows);
});

// Loads an appointment and checks the caller owns it (customers) or is staff/admin.
function loadOwned(req, res) {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found' });
    return null;
  }
  if (req.user.role === 'customer' && appt.user_id !== req.user.id) {
    res.status(403).json({ error: 'Not your appointment' });
    return null;
  }
  return appt;
}

// PUT /api/appointments/:id/reschedule  { start_time }
router.put('/:id/reschedule', (req, res) => {
  const appt = loadOwned(req, res);
  if (!appt) return;
  if (appt.status !== 'booked') return res.status(400).json({ error: 'Only booked appointments can be moved' });

  const { start_time } = req.body || {};
  if (!start_time) return res.status(400).json({ error: 'start_time is required' });

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(appt.service_id);
  const date = start_time.slice(0, 10);
  // Allow keeping the same slot; otherwise it must be free.
  const free = availableSlots(appt.staff_id, appt.service_id, date);
  if (start_time !== appt.start_time && !free.includes(start_time)) {
    return res.status(409).json({ error: 'That slot is not available' });
  }
  const end_time = slotToIso(date, toMinutes(start_time.slice(11, 16)) + service.duration_min);
  db.prepare('UPDATE appointments SET start_time = ?, end_time = ?, reminder_sent = 0 WHERE id = ?').run(
    start_time,
    end_time,
    appt.id
  );
  res.json(detailed(appt));
});

// DELETE /api/appointments/:id  — cancel
router.delete('/:id', (req, res) => {
  const appt = loadOwned(req, res);
  if (!appt) return;
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
  res.json({ ok: true, status: 'cancelled' });
});

module.exports = router;
