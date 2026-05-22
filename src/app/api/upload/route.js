// ── POST /api/upload ─────────────────────────────────────────────────────────
// Handles all image/document uploads across the platform (Sellers, Riders, Admin)
// Uses ImgBB as the primary upload target — fast, reliable, no Firebase Storage needed.
// CRITICAL: Every code path MUST return Response.json() — never an HTML response.

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Hardened ImgBB upload function using server-side buffer → base64 → multipart form
async function uploadBufferToImgBB(buffer, apiKey) {
  const base64Image = buffer.toString('base64');

  // Build URLSearchParams — more reliable than FormData in Node.js edge environments
  const params = new URLSearchParams();
  params.append('image', base64Image);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`ImgBB returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok || !data?.data?.url) {
    throw new Error(data?.error?.message || `ImgBB upload failed with status ${res.status}`);
  }

  return data.data.url;
}

export async function POST(req) {
  // Wrap the ENTIRE handler in a try/catch to guarantee JSON output always
  try {
    let formData;
    try {
      formData = await req.formData();
    } catch (parseErr) {
      console.error('[Upload] Failed to parse formData:', parseErr.message);
      return Response.json(
        { success: false, error: 'Invalid request: could not parse form data.' },
        { status: 400 }
      );
    }

    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return Response.json(
        { success: false, error: 'No image file provided in request.' },
        { status: 400 }
      );
    }

    // Size guard — 10 MB max
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { success: false, error: 'File too large. Maximum allowed size is 10 MB.' },
        { status: 413 }
      );
    }

    // Convert file to a Buffer
    let buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (bufErr) {
      console.error('[Upload] Failed to read file buffer:', bufErr.message);
      return Response.json(
        { success: false, error: 'Failed to process the uploaded file.' },
        { status: 500 }
      );
    }

    if (!buffer || buffer.length === 0) {
      return Response.json(
        { success: false, error: 'The uploaded file appears to be empty.' },
        { status: 400 }
      );
    }

    // Use ImgBB as primary upload target
    const apiKey = process.env.IMGBB_API_KEY || 'b30c73255a6a72051bbb3576e64972ae';

    try {
      const url = await uploadBufferToImgBB(buffer, apiKey);
      console.log('[Upload] ✅ Successfully uploaded to ImgBB:', url);
      return Response.json({ success: true, url });
    } catch (imgbbErr) {
      console.error('[Upload] ❌ ImgBB upload failed:', imgbbErr.message);
      return Response.json(
        { success: false, error: 'Image upload failed: ' + imgbbErr.message },
        { status: 500 }
      );
    }

  } catch (criticalErr) {
    // Last-resort catch — must never return HTML
    console.error('[Upload] 🔥 Critical unhandled error:', criticalErr?.stack || criticalErr?.message);
    return Response.json(
      { success: false, error: 'Internal server error during upload.' },
      { status: 500 }
    );
  }
}
