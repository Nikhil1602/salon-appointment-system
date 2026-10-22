// Creates a starter admin, a few services and staff, so the app is usable immediately.
// Safe to run more than once: it skips anything that already exists. Run with `npm run seed`.

const bcrypt = require('bcryptjs');
const db = require('./db');

function ensureUser(name, email, password, role) {
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
      .run(name, email, bcrypt.hashSync(password, 10), role);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    console.log(`created ${role}: ${email} / ${password}`);
  }
  return user;
}

function ensureService(name, description, duration, price) {
  let s = db.prepare('SELECT * FROM services WHERE name = ?').get(name);
  if (!s) {
    const info = db
      .prepare('INSERT INTO services (name, description, duration_min, price) VALUES (?,?,?,?)')
      .run(name, description, duration, price);
    s = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
  }
  return s;
}

function ensureStaff(name, specialization, serviceIds) {
  let st = db.prepare('SELECT * FROM staff WHERE name = ?').get(name);
  if (!st) {
    const info = db
      .prepare('INSERT INTO staff (name, specialization) VALUES (?,?)')
      .run(name, specialization);
    st = db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid);
  }
  const link = db.prepare('INSERT OR IGNORE INTO staff_services (staff_id, service_id) VALUES (?,?)');
  for (const sid of serviceIds) link.run(st.id, sid);
  return st;
}

ensureUser('Salon Admin', 'admin@salon.test', 'admin123', 'admin');
ensureUser('Demo Customer', 'customer@salon.test', 'customer123', 'customer');

const haircut = ensureService('Haircut', 'Wash, cut and style', 45, 30);
const color = ensureService('Hair Colour', 'Full colour treatment', 90, 80);
const manicure = ensureService('Manicure', 'Classic manicure', 30, 25);

ensureStaff('Alex Rivera', 'Cutting & styling', [haircut.id, color.id]);
ensureStaff('Jordan Lee', 'Nails', [manicure.id]);
ensureStaff('Sam Patel', 'Colour specialist', [haircut.id, color.id, manicure.id]);

console.log('Seed complete.');
console.log('Admin login:    admin@salon.test / admin123');
console.log('Customer login: customer@salon.test / customer123');
