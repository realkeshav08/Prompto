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

        if (app !== 'prompto' || !transactionId) {
          return res.json({ received: true });
        }

        /* ---- Claim the transaction atomically, THEN credit ----
           Stripe retries delivery for days, so this handler must be exactly-
           once. We flip isPaid:false → true in a single compare-and-set: only
           the call that wins the flip proceeds to credit the user. Crediting
           first (the old order) risked a crash between the credit and the save
           leaving isPaid=false, so a retry would credit the user a second
           time. Claiming first makes a duplicate delivery a harmless no-op. */
        const transaction = await Transaction.findOneAndUpdate(
          { _id: transactionId, isPaid: false },
          { $set: { isPaid: true, paidAt: new Date(), stripeSessionId: session.id } },
          { new: true }
        );

        // No match ⇒ unknown id or already processed ⇒ nothing to do.
        if (!transaction) {
          return res.json({ received: true });
        }

        try {
          await User.updateOne(
            { _id: transaction.userId },
            { $inc: { credits: transaction.credits } }
          );
        } catch (creditErr) {
          // Crediting failed after we claimed the transaction. Release the
          // claim so Stripe's automatic retry can re-process and credit the
          // user, instead of leaving them paid-but-not-credited.
          await Transaction.updateOne(
            { _id: transaction._id },
            { $set: { isPaid: false }, $unset: { paidAt: '', stripeSessionId: '' } }
          ).catch(() => {});
          throw creditErr;
        }

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
