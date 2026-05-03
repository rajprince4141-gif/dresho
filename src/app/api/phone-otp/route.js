
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin (server-side Firestore for OTP token storage) ────────────
// We store OTP tokens in Firestore so they work across Vercel serverless instances
let adminDb;
try {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }
  adminDb = getFirestore();
} catch (e) {
  console.warn('[OTP] Firebase Admin init:', e.message);
}

// ── POST /api/phone-otp → send OTP via MSG91 ──────────────────────────────
export async function POST(req) {
  try {
    const { phone } = await req.json();

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Rate limiting: check if already sent in last 60s
    if (adminDb) {
      const tokenRef = adminDb.collection('otp_tokens').doc(`91${phone}`);
      const existing = await tokenRef.get();
      if (existing.exists) {
        const sentAt = existing.data()?.sentAt?.toDate?.() || new Date(0);
        if (Date.now() - sentAt.getTime() < 60_000) {
          return Response.json({ error: 'OTP already sent. Please wait 60 seconds.' }, { status: 429 });
        }
      }
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // Store OTP in Firestore (server-side, not visible to client)
    if (adminDb) {
      await adminDb.collection('otp_tokens').doc(`91${phone}`).set({
        code: otp,
        expiresAt,
        sentAt: new Date(),
        attempts: 0,
      });
    }

    // Send OTP via MSG91
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      // Dev mode: log OTP to console when MSG91 is not configured
      console.log(`[DEV MODE] OTP for +91${phone}: ${otp}`);
      return Response.json({ success: true, dev: true });
    }

    const msg91Res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: `91${phone}`,
        otp,
      }),
    });

    const msg91Data = await msg91Res.json();

    if (msg91Data.type !== 'success') {
      console.error('[MSG91] Error:', msg91Data);
      return Response.json({ error: 'Failed to send OTP. Please try again.' }, { status: 502 });
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('[OTP Send]', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/phone-otp → verify OTP ───────────────────────────────────────
export async function PUT(req) {
  try {
    const { phone, otp } = await req.json();

    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(otp)) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (!adminDb) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const tokenRef = adminDb.collection('otp_tokens').doc(`91${phone}`);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return Response.json({ verified: false, error: 'OTP not found or expired' }, { status: 400 });
    }

    const { code, expiresAt, attempts } = tokenDoc.data();

    // Check expiry
    if (new Date() > expiresAt.toDate()) {
      await tokenRef.delete();
      return Response.json({ verified: false, error: 'OTP expired. Please request a new one.' }, { status: 400 });
    }

    // Max 5 attempts
    if (attempts >= 5) {
      await tokenRef.delete();
      return Response.json({ verified: false, error: 'Too many attempts. Request a new OTP.' }, { status: 429 });
    }

    if (code !== otp) {
      await tokenRef.update({ attempts: attempts + 1 });
      return Response.json({ verified: false, error: 'Incorrect OTP. Try again.' }, { status: 400 });
    }

    // ✅ Verified — delete token
    await tokenRef.delete();
    return Response.json({ verified: true });

  } catch (err) {
    console.error('[OTP Verify]', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
