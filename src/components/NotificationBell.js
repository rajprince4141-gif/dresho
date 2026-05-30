"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { onMessage } from "firebase/messaging";
import { db, messaging } from "@/lib/firebase";

// Premium sound chime generator using Web Audio API
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playNote = (frequency, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    playNote(523.25, now, 0.15); // C5 (pleasant tone)
    playNote(783.99, now + 0.12, 0.3); // G5 (ascending success chord)
  } catch (e) {
    console.warn("Failed to play sound chime:", e);
  }
};

export default function NotificationBell({ userId, role }) {
  const [personalNotifs, setPersonalNotifs] = useState([]);
  const [broadcastNotifs, setBroadcastNotifs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ── 1. Foreground Push Messaging Listener ──
  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      playNotificationSound();
      
      // Trigger native browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: "/logo.jpeg"
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // ── 2. Real-Time Personal Notifications listener ──
  useEffect(() => {
    if (!userId) return;
    let isInitialLoad = true;

    // Listen to notifications for this specific user
    const q1 = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(q1, (snap) => {
      let notifs = [];
      let unread = 0;
      let hasNewAdditions = false;
      
      snap.docChanges().forEach((change) => {
        if (change.type === "added" && !isInitialLoad) {
          hasNewAdditions = true;
        }
      });
      
      snap.forEach((doc) => {
        const data = doc.data();
        notifs.push({ id: doc.id, ...data });
        if (!data.read) unread++;
      });
      
      if (hasNewAdditions) {
        playNotificationSound();
      }
      isInitialLoad = false;
      
      setPersonalNotifs(notifs);
      setUnreadCount(unread);
    }, (err) => {
      console.error("Error listening to user notifications:", err);
    });

    return () => unsubscribe();
  }, [userId]);

  // ── 3. Role-based Broadcast Notifications listener ──
  useEffect(() => {
    if (!role || !userId) return;

    const targetRoles = [role, "all"];
    if (role === "user" || role === "customer") {
      targetRoles.push("user", "customer");
    } else if (role === "rider" || role === "delivery") {
      targetRoles.push("rider", "delivery");
    }

    const qBroadcast = query(
      collection(db, "broadcast_notifications"),
      where("role", "in", targetRoles)
    );

    let isInitialLoad = true;
    const unsubscribeBroadcast = onSnapshot(qBroadcast, (snap) => {
      let bNotifs = [];
      let hasNewAdditions = false;

      snap.docChanges().forEach((change) => {
        if (change.type === "added" && !isInitialLoad) {
          hasNewAdditions = true;
        }
      });

      snap.forEach((doc) => {
        const data = doc.data();
        bNotifs.push({ id: doc.id, ...data, isBroadcast: true });
      });
      
      if (hasNewAdditions) {
        playNotificationSound();
      }
      isInitialLoad = false;

      setBroadcastNotifs(bNotifs);
    }, (err) => {
      console.error("Error listening to broadcast notifications:", err);
    });

    return () => unsubscribeBroadcast();
  }, [role, userId]);

  // ── 4. Unified Reactive Notification Merging & Sorting ──
  useEffect(() => {
    const merged = [...personalNotifs, ...broadcastNotifs];
    // Deduplicate
    const unique = Array.from(new Set(merged.map(a => a.id))).map(id => merged.find(a => a.id === id));
    unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setNotifications(unique);
  }, [personalNotifs, broadcastNotifs]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id, isBroadcast, link) => {
    if (!isBroadcast) {
      try {
        await updateDoc(doc(db, "notifications", id), { read: true });
      } catch (err) {
        console.error("Error marking read", err);
      }
    }
    if (link) {
      window.location.href = link;
    }
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ display: 'flex', alignItems: 'center' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', padding: '8px' }}
      >
        <i className="fas fa-bell" style={{ fontSize: 24, color: "#14213D" }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4, background: '#D9534F', color: 'white', 
            borderRadius: '50%', fontSize: '10px', width: '16px', height: '16px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, width: '320px', 
          background: 'white', border: '1px solid #ddd', borderRadius: '8px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '400px', overflowY: 'auto',
          marginTop: '8px'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#14213D' }}>
            Notifications
          </div>
          
          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id}
                onClick={() => markAsRead(notif.id, notif.isBroadcast, notif.link)}
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid #eee', 
                  background: notif.read || notif.isBroadcast ? '#fff' : '#f0f4f8',
                  cursor: notif.link ? 'pointer' : 'default',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => { if(notif.link) e.currentTarget.style.background = '#f9f9f9'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = notif.read || notif.isBroadcast ? '#fff' : '#f0f4f8'; }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#14213D', marginBottom: '4px' }}>
                  {notif.title}
                </div>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  {notif.body}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>
                  {new Date(notif.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
