# Salon Appointment Booking System

A simple salon booking system: a Node.js + Express backend with a SQLite database (one file,
nothing to install or run separately), JWT authentication, and a plain HTML/CSS/JS frontend to
try the APIs.

Email reminders and payments work out of the box in **safe local modes** (reminders print to
the console, payments are mock-approved), so the whole app runs with **no API keys**. Where to
plug in real SendGrid and Stripe is marked with `TODO` in `src/services/`.

## Features

- **Auth & profiles** — register, login (JWT), edit your profile.
- **Services** — list, create, edit (admin).
- **Staff** — profiles, working hours, assigned services (admin).
- **Booking** — see available slots, book, pay (mock), with conflict and skill checks.
- **Reminders** — a cron job emails a reminder before each appointment.
- **Manage** — reschedule and cancel.
- **Reviews** — customers review; staff/admin reply.
- **Admin** — manage users and all appointments.

## Tech

| Part | Choice |
|---|---|
| Backend | Node.js, Express |
| Database | SQLite (via `better-sqlite3`) — a real SQL DB in a single file |
| Auth | JWT (`jsonwebtoken`), passwords hashed with `bcryptjs` |
| Reminders | `node-cron` |
| Frontend | HTML + CSS + vanilla JS (in `public/`) |

SQLite keeps setup to zero. To use MySQL or Postgres instead, the SQL in `src/db.js` and the
queries in `src/routes/` are standard and port over with small changes.

## Run it

```bash
npm install
npm run seed     # sample services, staff, and two logins (see below)
npm start        # http://localhost:3000
```

Open **http://localhost:3000** for the test frontend.

**Seeded logins:**
- Admin: `admin@salon.test` / `admin123`
- Customer: `customer@salon.test` / `customer123`

Configuration is optional; copy `.env.example` to `.env` to change the port, JWT secret,
reminder timing, or to switch on real email/payments.

## API

Base URL `http://localhost:3000/api`. Send the token from login/register as
`Authorization: Bearer <token>`. Bodies and responses are JSON.

### Auth
| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password, phone? }` |
| POST | `/auth/login` | public | `{ email, password }` |

Both return `{ token, user }`.

### Profile
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/profile` | logged in | — |
| PUT | `/profile` | logged in | `{ name?, phone?, preferences?, password? }` |

### Services
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/services` | public | — (add `?all=1` to include inactive) |
| GET | `/services/:id` | public | — |
| POST | `/services` | admin | `{ name, description?, duration_min, price }` |
| PUT | `/services/:id` | admin | any of the above + `active` |
| DELETE | `/services/:id` | admin | — (soft delete) |

### Staff
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/staff` | public | — (each includes its `services`) |
| GET | `/staff/:id` | public | — |
| POST | `/staff` | admin | `{ name, specialization?, work_start?, work_end?, user_id?, service_ids? }` |
| PUT | `/staff/:id` | admin | same fields |
| DELETE | `/staff/:id` | admin | — |

`work_start`/`work_end` are `"HH:MM"` (default `09:00`–`17:00`). `service_ids` sets which
services the staff member can perform.

### Appointments
| Method | Path | Who | Body / query |
|---|---|---|---|
| GET | `/appointments/slots` | public | query `?staff_id=&service_id=&date=YYYY-MM-DD` → `{ slots: [...] }` |
| POST | `/appointments` | logged in | `{ staff_id, service_id, start_time, pay? }` |
| GET | `/appointments` | logged in | customer sees own; staff/admin see all |
| PUT | `/appointments/:id/reschedule` | owner | `{ start_time }` |
| DELETE | `/appointments/:id` | owner | — (cancel) |

`start_time` is `"YYYY-MM-DDTHH:MM"` and must be one of the returned slots. Booking checks the
staff member offers the service and the slot is free. `pay: true` runs the (mock) payment and
marks the appointment paid. A confirmation email is sent (console by default).

### Reviews
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/reviews` | public | — (add `?staff_id=` to filter) |
| POST | `/reviews` | customer | `{ appointment_id, rating, comment? }` (rating 1–5, once per appointment) |
| PUT | `/reviews/:id/reply` | staff/admin | `{ reply }` |

### Admin
| Method | Path | Body |
|---|---|---|
| GET | `/admin/users` | — |
| PUT | `/admin/users/:id/role` | `{ role }` (`customer`/`staff`/`admin`) |
| DELETE | `/admin/users/:id` | — |
| GET | `/admin/appointments` | — |
| PUT | `/admin/appointments/:id` | `{ status?, payment_status? }` |

## Reminders

`src/reminders.js` schedules a cron job every 15 minutes. It emails a reminder for each booked
appointment starting within `REMINDER_HOURS_BEFORE` hours (default 24) that has not been
reminded yet. In the default console mode, reminders print to the server log.

## Turning on real email and payments

- **Email / SMS:** fill `SENDGRID_API_KEY` in `.env`, then implement the `TODO` in
  `src/services/email.js` (install `@sendgrid/mail`, or a Twilio client for SMS).
- **Payments:** set `PAYMENT_MODE=stripe` and `STRIPE_SECRET_KEY`, then implement the `TODO` in
  `src/services/payment.js` (install `stripe` or a Razorpay client).

Nothing else changes: the booking flow already calls these services.

## Project layout

```
src/
  server.js        Express app, wires up routes, starts the cron job
  db.js            SQLite connection + schema
  config.js        env config with safe defaults
  seed.js          sample data + two logins
  reminders.js     cron reminder job
  middleware/auth.js   JWT + role checks
  routes/          auth, profile, services, staff, appointments, reviews, admin
  services/        email.js, payment.js (stubs with real-integration TODOs)
public/            index.html, style.css, app.js (test frontend)
```

## Deploying to AWS (outline)

- Run the Node app on EC2, Elastic Beanstalk, or in a container on ECS/App Runner.
- For more than one instance, move the database from SQLite to **Amazon RDS** (MySQL or
  Postgres) and update `src/db.js`.
- Set `JWT_SECRET` and the email/payment keys as environment variables, not in the repo.

## Licence

MIT.
