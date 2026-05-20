// ── POST /api/upload ─────────────────────────────────────────────────────────
// Handles all image/document uploads across the platform (Sellers, Riders, Admin)
// Highly resilient: tries Firebase Storage first, falls back to ImgBB if Firebase fails.

import { adminStorage } from "@/lib/firebase-admin";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function uploadToImgBB(buffer) {
  const apiKey = process.env.IMGBB_API_KEY || "b30c73255a6a72051bbb3576e64972ae";
  const base64Image = buffer.toString('base64');
  
  const formData = new FormData();
  formData.append('image', base64Image);
  
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await res.json();
  if (!res.ok || !data.data || !data.data.url) {
    throw new Error(data.error?.message || 'ImgBB upload failed');
  }
  
  return data.data.url;
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image'); // Usually named 'image' in the frontend

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Size guard — 10 MB max
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 10 MB' }, { status: 413 });
    }

    // Process file into a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1️⃣ Try Firebase Storage first
    if (adminStorage) {
      try {
        // Generate unique filename
        const ext = file.name.split('.').pop() || 'png';
        const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanName}.${ext}`;

        const bucket = adminStorage.bucket();
        const fileUpload = bucket.file(fileName);

        await fileUpload.save(buffer, {
          metadata: {
            contentType: file.type || 'application/octet-stream',
          },
        });

        // Make the file public (optional)
        try {
          await fileUpload.makePublic();
        } catch (e) {
          console.warn("Could not make file public (uniform access may be enabled):", e.message);
        }

        // Generate download URL
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
        
        console.log('[Upload] Successfully uploaded to Firebase Storage.');
        return Response.json({
          url: url,
          success: true
        });

      } catch (fbErr) {
        console.error('[Upload] Firebase Storage failed, trying ImgBB fallback...', fbErr.message);
      }
    } else {
      console.warn('[Upload] Firebase Storage is not initialized, skipping to ImgBB.');
    }

    // 2️⃣ Fallback to ImgBB if Firebase was not initialized or failed
    try {
      const url = await uploadToImgBB(buffer);
      console.log('[Upload] Successfully uploaded to ImgBB.');
      return Response.json({
        url: url,
        success: true
      });
    } catch (imgbbErr) {
      console.error('[Upload] ImgBB fallback failed:', imgbbErr.message);
      return Response.json({ error: 'Upload failed: ' + imgbbErr.message }, { status: 500 });
    }

  } catch (err) {
    console.error('[Upload] general error:', err.stack);
    return Response.json({ error: 'Internal upload error' }, { status: 500 });
  }
}

