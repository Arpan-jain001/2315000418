const TYPE_WEIGHT = {
  Placement: 100,
  Result: 70,
  Event: 40,
};

const normalizeDate = (value) => {
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

export function scoreNotification(notification, now = new Date()) {
  const ageHours = Math.max(
    0,
    (now.getTime() - normalizeDate(notification.timestamp).getTime()) / 36e5
  );
  const recencyScore = Math.max(0, 48 - ageHours);
  return (TYPE_WEIGHT[notification.type] || 10) + recencyScore;
}

export function getPriorityNotifications(notifications, limit = 10, now = new Date()) {
  return [...notifications]
    .sort((left, right) => {
      const scoreDelta =
        scoreNotification(right, now) - scoreNotification(left, now);

      if (scoreDelta !== 0) return scoreDelta;

      return (
        normalizeDate(right.timestamp).getTime() -
        normalizeDate(left.timestamp).getTime()
      );
    })
    .slice(0, limit);
}

export function updateTopNotifications(currentTop, incoming, limit = 10) {
  const byId = new Map(currentTop.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return getPriorityNotifications([...byId.values()], limit);
}
