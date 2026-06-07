import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/services/supabase/client";
import { NotificationRow, fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/services/supabase/community";
import { useAuth } from "./AuthContext";

interface NotificationContextProps {
  notifications: NotificationRow[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearReadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const { session, profile } = useAuth();
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const currentRole = profile?.role?.toLowerCase() || 'resident';

  const loadNotifications = async () => {
    if (!session?.user) return;
    const data = await fetchNotifications(currentRole, session.user.id);
    setNotifications(data);
  };

  useEffect(() => {
    loadNotifications();

    if (!session?.user) return;

    // Subscribe to realtime notifications without DB-level filter, filter in JS
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Remove deleted notification from local state
            const deletedId = (payload.old as any)?.id;
            if (deletedId) setNotifications(prev => prev.filter(n => n.id !== deletedId));
            return;
          }
          
          const newNotif = payload.new as NotificationRow;
          const isForUser = newNotif.user_id === session.user.id;
          const isForRole = newNotif.user_role && newNotif.user_role.toLowerCase() === currentRole;
          
          if (isForUser || isForRole) {
            if (payload.eventType === 'INSERT') {
              setNotifications(prev => [newNotif, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev => prev.map(n => n.id === newNotif.id ? newNotif : n));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user, currentRole]);

  const markAsRead = async (id: string) => {
    // Only update local state — do NOT close the panel
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await markNotificationRead(id);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markAllNotificationsRead(currentRole, session?.user?.id);
  };

  const clearReadNotifications = async () => {
    const readIds = notifications.filter(n => n.read).map(n => n.id);
    if (readIds.length === 0) return;
    // Optimistically remove from UI
    setNotifications(prev => prev.filter(n => !n.read));
    // Delete from DB
    await supabase.from('notifications').delete().in('id', readIds);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllRead, clearReadNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
