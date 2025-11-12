export type PendingNotification<T = any> = {
  callId: string;
  payload: T;
  queuedAt: number;
};

const MAX_QUEUE_PER_STAFF = 10;

const pendingNotifications = new Map<string, PendingNotification[]>();

export const queuePendingCallNotification = <T = any>(staffId: string, notification: PendingNotification<T>) => {
  if (!staffId || !notification?.callId) {
    return;
  }

  const queue = pendingNotifications.get(staffId) ?? [];
  // Avoid duplicate callId entries
  const filtered = queue.filter((item) => item.callId !== notification.callId);
  filtered.push({ ...notification, queuedAt: Date.now() });

  // Trim queue to max size (oldest first)
  if (filtered.length > MAX_QUEUE_PER_STAFF) {
    filtered.splice(0, filtered.length - MAX_QUEUE_PER_STAFF);
  }

  pendingNotifications.set(staffId, filtered);
};

export const consumePendingCallNotifications = <T = any>(staffId: string): PendingNotification<T>[] => {
  if (!staffId) {
    return [];
  }

  const queue = pendingNotifications.get(staffId);
  if (!queue || queue.length === 0) {
    return [];
  }

  pendingNotifications.delete(staffId);
  return queue;
};

export const clearPendingCallNotification = (staffId: string, callId: string) => {
  if (!staffId || !callId) {
    return;
  }

  const queue = pendingNotifications.get(staffId);
  if (!queue) {
    return;
  }

  const filtered = queue.filter((item) => item.callId !== callId);
  if (filtered.length === 0) {
    pendingNotifications.delete(staffId);
  } else {
    pendingNotifications.set(staffId, filtered);
  }
};
