// Appointment reminders. A cron job runs every 15 minutes and emails a reminder for each
// booked appointment starting within REMINDER_HOURS_BEFORE hours that has not been reminded
// yet. In the default console email mode, reminders print to the server log.

const cron = require('node-cron');
const db = require('../src/db');
const config = require('./config');
const { sendEmail } = require('./services/email');

async function runOnce() {
  const now = new Date();
  const horizon = new Date(now.getTime() + config.reminderHoursBefore * 3600 * 1000);

  const due = db
    .prepare(
      `SELECT a.*, s.name AS service_name, st.name AS staff_name, u.name AS customer_name, u.email AS customer_email
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
       JOIN users u ON u.id = a.user_id
       WHERE a.status = 'booked' AND a.reminder_sent = 0`
    )
    .all();

  for (const a of due) {
    const start = new Date(a.start_time);
    if (start > now && start <= horizon) {
      await sendEmail({
        to: a.customer_email,
        subject: 'Reminder: your salon appointment is coming up',
        text: `Hi ${a.customer_name}, a reminder that your ${a.service_name} with ${a.staff_name} is at ${a.start_time}.`,
      }).catch(() => {});
      db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(a.id);
    }
  }
}

function start() {
  // Every 15 minutes.
  cron.schedule('*/15 * * * *', () => {
    runOnce().catch((e) => console.error('reminder job error:', e.message));
  });
  console.log(`Reminder job scheduled (every 15 min, ${config.reminderHoursBefore}h before).`);
}

module.exports = { start, runOnce };
