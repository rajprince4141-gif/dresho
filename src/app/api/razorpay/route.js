import Razorpay from 'razorpay';
import crypto from 'crypto';

// ── Initialise Razorpay with server-only secret ──────────────────────────────
// RAZORPAY_KEY_SECRET is never sent to the browser (no NEXT_PUBLIC_ prefix)
const razorpay = new Razorpay({
  key_id:     process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── POST /api/razorpay/create-order ─────────────────────────────────────────
export async function POST(req) {
  try {
    const { amount, currency = 'INR', receipt } = await req.json();

    // Basic server-side validation
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (amount > 10_000_000) {           // ₹1,00,000 cap (in paise)
      return Response.json({ error: 'Amount exceeds limit' }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount,           // in paise — e.g. ₹499 → 49900
      currency,
      receipt: receipt || `dr_${Date.now()}`,
    });

    return Response.json({ orderId: order.id, amount: order.amount });

  } catch (err) {
    console.error('[Razorpay] create-order error:', err.message);
    return Response.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}

// ── POST /api/razorpay/verify-payment ───────────────────────────────────────
// Call this BEFORE writing the order to Firestore to confirm payment is genuine
export async function PUT(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Missing payment fields' }, { status: 400 });
    }

    // HMAC-SHA256 signature verification — only possible with the secret key
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.warn('[Razorpay] Signature mismatch — possible tampered payment');
      return Response.json({ verified: false }, { status: 400 });
    }

    return Response.json({ verified: true });

  } catch (err) {
    console.error('[Razorpay] verify-payment error:', err.message);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
