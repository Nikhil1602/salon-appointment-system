// Email sending. By default this just prints the message to the server console, so the app
// runs with no email account. To send real email, install an email library and fill in the
// TODO below.

const config = require('../config');

async function sendEmail({ to, subject, text }) {
  if (!config.sendgridApiKey) {
    console.log('\n[EMAIL — console mode, not actually sent]');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  ${text}\n`);
    return { delivered: false, mode: 'console' };
  }

  // TODO: real email. Example with SendGrid (run `npm install @sendgrid/mail` first):
  //   const sg = require('@sendgrid/mail');
  //   sg.setApiKey(config.sendgridApiKey);
  //   await sg.send({ to, from: config.emailFrom, subject, text });
  // SMS would plug in the same way (e.g. Twilio) if you add a phone field.
  throw new Error('Real email is configured but not implemented; see src/services/email.js');
}

module.exports = { sendEmail };
