// ── POST /api/upload ─────────────────────────────────────────────────────────
// Proxies image uploads to ImgBB so NEXT_PUBLIC_IMGBB_API_KEY is never needed
// The browser sends the raw file; this route sends it to ImgBB with the secret key.

// Allow up to 10 MB request bodies (Next.js App Router default is 4 MB)
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image');

    if (!file) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Size guard — 10 MB max (allows document uploads)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 10 MB' }, { status: 413 });
    }

    // Type guard — images only (ImgBB does not support PDFs)
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'File must be an image (JPG, PNG, etc.)' }, { status: 415 });
    }

    // Forward to ImgBB using server-only key
    const imgbbForm = new FormData();
    imgbbForm.append('image', file);

    const imgbbRes = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      { method: 'POST', body: imgbbForm }
    );

    const data = await imgbbRes.json();

    if (!data.success) {
      console.error('[ImgBB] Upload failed:', data.error?.message);
      return Response.json({ error: 'Upload failed' }, { status: 502 });
    }

    return Response.json({
      url:       data.data.url,
      deleteUrl: data.data.delete_url,
    });

  } catch (err) {
    console.error('[Upload] error:', err.message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
