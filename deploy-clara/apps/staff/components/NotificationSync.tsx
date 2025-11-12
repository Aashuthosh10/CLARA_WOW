import React, { useEffect, useRef } from 'react';
import { useNotification } from './NotificationProvider';
import { apiService } from '../services/api';

interface NotificationSyncProps {
  userId: string;
  isActive: boolean;
}

const NotificationSync: React.FC<NotificationSyncProps> = ({ userId, isActive }) => {
  const { addNotification } = useNotification();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !userId) return;

    // Function to fetch and display new notifications
    const fetchNotifications = async () => {
      try {
        const response = await apiService.getNotifications();
        if (response.data && response.data.notifications) {
          const notifications = response.data.notifications;
          
          // Filter for unread notifications that are newer than last check
          const newNotifications = notifications.filter((n: any) => {
            const createdAt = new Date(n.createdAt).getTime();
            return !n.read && createdAt > lastCheckRef.current;
          });

          // Display new notifications
          newNotifications.forEach((notification: any) => {
            // Only show if notification is not read
            if (!notification.read) {
              addNotification({
                type: notification.type,
                title: notification.title,
                message: notification.message
              });

              // Mark as read after displaying (with a small delay to ensure it's visible)
              setTimeout(() => {
                apiService.markAsRead(notification._id).catch(console.error);
              }, 100);
            }
          });

          // Update last check time
          if (notifications.length > 0) {
            const latestTime = Math.max(...notifications.map((n: any) => new Date(n.createdAt).getTime()));
            lastCheckRef.current = latestTime;
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Poll for new notifications every 3 seconds
    pollingIntervalRef.current = setInterval(fetchNotifications, 3000);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [userId, isActive, addNotification]);

  return null; // This component doesn't render anything
};

export default NotificationSync;

