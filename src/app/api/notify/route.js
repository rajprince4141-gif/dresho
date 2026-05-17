import { adminMessaging } from '@/lib/firebase-admin';

export const maxDuration = 30; // 30 seconds limit

export async function POST(req) {
  try {
    const { token, title, body, icon, data } = await req.json();

    if (!token) {
      return Response.json({ error: 'FCM Token is required' }, { status: 400 });
    }

    const message = {
      notification: {
        title: title || 'New Notification',
        body: body || 'You have a new message.',
      },
      token: token,
    };

    // Add optional custom data payload
    if (data) {
      message.data = data;
    }

    const response = await adminMessaging.send(message);

    return Response.json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return Response.json({ error: 'Failed to send notification', details: error.message }, { status: 500 });
  }
}
