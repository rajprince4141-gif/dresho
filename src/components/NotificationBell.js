"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function NotificationBell({ userId, role }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Listen to notifications for this specific user
    const q1 = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(q1, (snap) => {
      let notifs = [];
      let unread = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        notifs.push({ id: doc.id, ...data });
        if (!data.read) unread++;
      });
      
      // Sort by createdAt descending
      notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setNotifications(notifs);
      setUnreadCount(unread);
    }, (err) => {
      console.error("Error listening to user notifications:", err);
    });

    return () => unsubscribe();
  }, [userId]);

  // For riders, listen to broadcast notifications too
  useEffect(() => {
    if (role !== "rider") return;

    const qBroadcast = query(
      collection(db, "broadcast_notifications"),
      where("role", "==", "rider")
    );

    const unsubscribeBroadcast = onSnapshot(qBroadcast, (snap) => {
      let bNotifs = [];
      snap.forEach((doc) => {
        const data = doc.data();
        bNotifs.push({ id: doc.id, ...data, isBroadcast: true });
      });
      
      setNotifications(prev => {
        const merged = [...prev, ...bNotifs];
        // Deduplicate
        const unique = Array.from(new Set(merged.map(a => a.id))).map(id => merged.find(a => a.id === id));
        unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return unique;
      });
    }, (err) => {
      console.error("Error listening to broadcast notifications:", err);
    });

    return () => unsubscribeBroadcast();
  }, [role]);

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
