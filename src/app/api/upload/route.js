// ── POST /api/upload ─────────────────────────────────────────────────────────
// Handles all image/document uploads across the platform (Sellers, Riders, Admin)
// Uploads directly to Firebase Storage using the Admin SDK.

import { adminStorage } from "@/lib/firebase-admin";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image'); // Usually named 'image' in the frontend

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Size guard — 10 MB max (allows document uploads)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 10 MB' }, { status: 413 });
    }

    // Process file into a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanName}.${ext}`;

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    // Make the file public (optional, but good practice if bucket allows it)
    try {
      await fileUpload.makePublic();
    } catch (e) {
      // If uniform bucket-level access is enabled, makePublic() might throw. 
      // We catch it and ignore, as the alt=media URL still works if Firebase rules allow read.
      console.warn("Could not make file public (uniform access may be enabled):", e.message);
    }

    // Generate Firebase Storage direct download URL
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

    return Response.json({
      url: url,
      success: true
    });

  } catch (err) {
    console.error('[Upload] error:', err.stack);
    return Response.json({ error: 'Internal upload error' }, { status: 500 });
  }
}

