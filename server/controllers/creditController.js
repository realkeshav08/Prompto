import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';

/* ---------------- PLANS (SERVER AUTHORITY) ---------------- */

const PLANS = [
  {
    _id: 'basic',
    name: 'Basic',
    price: 10,
    credits: 100,
    features: [
      '100 text generations',
      '50 image generations',
      'Standard support',
      'Access to basic models',
    ],
  },
  {
    _id: 'pro',
    name: 'Pro',
    price: 20,
    credits: 500,
    features: [
      '500 text generations',
      '200 image generations',
      'Priority support',
      'Access to pro models',
      'Faster response time',
    ],
  },
  {
    _id: 'premium',
    name: 'Premium',
    price: 30,
    credits: 1000,
    features: [
      '1000 text generations',
      '500 image generations',
      '24/7 VIP support',
      'Access to premium models',
      'Dedicated account manager',
    ],
  },
];

/* ---------------- STRIPE SETUP ---------------- */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error('❌ STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/* ---------------- GET PLANS ---------------- */

export const getPlans = async (_req, res) => {
  return res.status(200).json({
    success: true,
    plans: PLANS,
  });
};

/* ---------------- PURCHASE PLAN ---------------- */

export const purchasePlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user?._id;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required',
      });
    }

    const plan = PLANS.find(p => p._id === planId);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected',
      });
    }

    /* ---- Create transaction (pending) ---- */
    const transaction = await Transaction.create({
      userId,
      planId: plan._id,
      amount: plan.price,
      credits: plan.credits,
      isPaid: false,
    });

    const clientURL =
      process.env.CLIENT_URL || 'http://localhost:5173';

    /* ---- Stripe checkout ---- */
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: plan.price * 100,
            product_data: {
              name: `${plan.name} Plan`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${clientURL}/loading`,
      cancel_url: `${clientURL}/credits`,
      metadata: {
        transactionId: transaction._id.toString(),
        app: 'prompto',
      },
      expires_at:
        Math.floor(Date.now() / 1000) + 35 * 60,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
    });

  } catch (err) {
    console.error('Stripe purchase error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
    });
  }
};
