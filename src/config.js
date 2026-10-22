require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'change-me-to-a-long-random-string',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'no-reply@example-salon.test',
  paymentMode: process.env.PAYMENT_MODE || 'mock',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  reminderHoursBefore: Number(process.env.REMINDER_HOURS_BEFORE || 24),
};
