// Payment processing. By default this runs in "mock" mode: it approves the payment locally
// without charging anything, so you can test booking end to end with no payment account.
// To take real payments, set PAYMENT_MODE=stripe and implement the TODO below.

const config = require('../config');

// Returns { status: 'paid', reference } on success.
async function charge({ amount, currency = 'usd', description }) {
  if (config.paymentMode === 'mock') {
    return {
      status: 'paid',
      reference: 'mock_' + Date.now(),
      note: 'Mock payment approved (no real charge).',
    };
  }

  // TODO: real payment. Example with Stripe (run `npm install stripe` first):
  //   const stripe = require('stripe')(config.stripeSecretKey);
  //   const intent = await stripe.paymentIntents.create({
  //     amount: Math.round(amount * 100), currency, description,
  //   });
  //   return { status: intent.status, reference: intent.id };
  void amount; void currency; void description;
  throw new Error('Real payments are enabled but not implemented; see src/services/payment.js');
}

module.exports = { charge };
