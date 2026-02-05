import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

/* ---------------- STRIPE SETUP ---------------- */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('❌ Stripe environment variables not set');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/* ---------------- WEBHOOK HANDLER ---------------- */

export const stripeWebhooks = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Invalid signature');
  }

  try {
    switch (event.type) {

      /* ✅ Correct event for Checkout */
      case 'checkout.session.completed': {
        const session = event.data.object;

        const { transactionId, app } = session.metadata || {};

        /* ---- Validate metadata ---- */
        /* ---- Idempotent transaction lookup ---- */
        const transaction = await Transaction.findOne({
          _id: transactionId,
          isPaid: false,
        });

        if (!transaction || app !== 'prompto') {
          // Already processed or invalid
          return res.json({ received: true });
        }

        /* ---- Credit user ---- */
        await User.updateOne(
          { _id: transaction.userId },
          { $inc: { credits: transaction.credits } }
        );

        /* ---- Mark transaction paid ---- */
        transaction.isPaid = true;
        transaction.paidAt = new Date();
        transaction.stripeSessionId = session.id;
        await transaction.save();

        break;
      }

      default:
        console.log('Unhandled webhook event:', event.type);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).send('Webhook handler failed');
  }
};
