# Stage 1

## Core Notification Actions

The notification platform should support these actions for logged-in users:

- List notifications for the current user.
- Fetch unread notification count.
- Mark one notification as read.
- Mark all notifications as read.
- Create a notification for one or many users from an internal/admin workflow.
- Subscribe to real-time notification delivery.

All endpoints are versioned under `/api/v1`, use JSON, and require an authenticated user unless explicitly marked as internal.

## REST API Contract

### List Notifications

`GET /api/v1/notifications?limit=20&cursor=2026-04-22T17:51:30Z&type=Placement&status=unread`

Headers:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

Response `200`:

```json
{
  "data": [
    {
      "id": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
      "userId": 1042,
      "type": "Placement",
      "title": "Placement Update",
      "message": "CSX Corporation hiring",
      "metadata": {
        "companyId": "csx",
        "actionUrl": "/placements/csx"
      },
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18Z",
      "readAt": null
    }
  ],
  "page": {
    "limit": 20,
    "nextCursor": "2026-04-22T17:50:42Z",
    "hasMore": true
  }
}
```

### Unread Count

`GET /api/v1/notifications/unread-count`

Response `200`:

```json
{
  "count": 12
}
```

### Mark One Notification As Read

`PATCH /api/v1/notifications/{notificationId}/read`

Response `200`:

```json
{
  "id": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
  "isRead": true,
  "readAt": "2026-04-22T18:02:00Z"
}
```

### Mark All As Read

`PATCH /api/v1/notifications/read-all`

Request:

```json
{
  "before": "2026-04-22T18:02:00Z"
}
```

Response `200`:

```json
{
  "updatedCount": 12
}
```

### Create Notification

`POST /api/v1/internal/notifications`

Headers:

```http
Authorization: Bearer <service_token>
Idempotency-Key: placement-2026-csx-001
Content-Type: application/json
```

Request:

```json
{
  "recipientUserIds": [1042, 1043],
  "type": "Placement",
  "title": "Placement Update",
  "message": "CSX Corporation hiring",
  "metadata": {
    "companyId": "csx",
    "actionUrl": "/placements/csx"
  },
  "channels": ["in_app", "email"]
}
```

Response `202`:

```json
{
  "batchId": "notif_batch_01JZCSX",
  "accepted": 2,
  "status": "queued"
}
```

## Real-Time Notifications

Use WebSocket or Server-Sent Events for real-time delivery. For this use case, SSE is enough if clients only receive notifications and do not need to send messages over the same connection.

`GET /api/v1/notifications/stream`

Headers:

```http
Authorization: Bearer <access_token>
Accept: text/event-stream
```

Event:

```text
event: notification.created
data: {"id":"b283218f-ea5a-4b7c-93a9-1f2f240d64b0","type":"Placement","message":"CSX Corporation hiring","createdAt":"2026-04-22T17:51:18Z"}
```

The backend should publish notification events to Redis Pub/Sub, Kafka, or a managed event bus. API nodes subscribe to the event stream and forward matching user events to connected clients.

# Stage 2

## Storage Choice

I recommend PostgreSQL for the primary persistent store. Notifications are relational enough to benefit from SQL: each notification belongs to a user, has predictable filters, needs transactional read state updates, and requires strong query support for unread lists, type filters, and auditability. PostgreSQL also gives mature indexing, partitioning, JSONB metadata, and safe migration tooling.

## Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email');

CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ NULL
);

CREATE TABLE notification_delivery_attempts (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id),
  channel notification_channel NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Core indexes:

```sql
CREATE INDEX idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread_created
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_type_created
  ON notifications (notification_type, created_at DESC);
```

## Scaling Problems And Solutions

As volume grows, the main problems will be large unread scans, hot writes during bulk campaigns, table bloat from frequent read updates, and expensive offset pagination. Use cursor pagination, partial indexes for unread queries, table partitioning by time or user hash, and archive old notifications. For high fan-out campaigns, write through queues and batch inserts instead of synchronously inserting one row per user inside the request.

SQL is still suitable when the product needs reliable filtering and state transitions. NoSQL can help for append-heavy feed storage, but it complicates joins, reporting, read-state consistency, and query flexibility. A good compromise is PostgreSQL as source of truth plus Redis for counters/cache and Kafka/SQS for fan-out.

# Stage 3

## Query Review

Original query:

```sql
SELECT *
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

The query is logically valid if the requirement is "all unread notifications for one student, oldest first." It may be product-wise questionable because an inbox usually shows newest first and should have a limit.

It is slow because, without the right index, the database may scan many rows for `studentID`, filter `isRead`, then sort the remaining rows by `createdAt`. With 5,000,000 notifications, that becomes expensive.

Recommended query:

```sql
SELECT id, studentID, notificationType, message, createdAt
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC
LIMIT 20;
```

Recommended index:

```sql
CREATE INDEX idx_notifications_student_unread_created
  ON notifications (studentID, createdAt DESC)
  WHERE isRead = false;
```

Likely computation cost becomes `O(log N + K)` where `K` is the requested page size, instead of scanning and sorting a large part of the table. The index already contains unread rows ordered per student, so the database can seek and read the first page.

Adding indexes on every column is poor advice. Indexes slow writes, increase storage, require maintenance, and may not help multi-column predicates. Indexes should match real query patterns and selectivity.

## Placement Notifications In Last 7 Days

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= now() - interval '7 days';
```

Supporting index:

```sql
CREATE INDEX idx_notifications_type_created_student
  ON notifications (notificationType, createdAt DESC, studentID);
```

# Stage 4

Fetching notifications from the database on every page load for every student should be reduced through layered caching and push-based updates.

Recommended strategy:

- Cache unread count and first inbox page in Redis with a short TTL such as 30-120 seconds.
- Use SSE/WebSocket to push new notifications to active clients instead of polling on every page load.
- Use cursor pagination and load only the first page initially.
- Add HTTP caching headers with ETags for stable pages.
- Keep read state writes asynchronous where possible, but return the updated client state immediately.

Tradeoffs:

- Redis cache improves latency and protects the database, but cache invalidation must happen on create/read events.
- SSE gives a simpler real-time path than WebSocket, but WebSocket is better if the client later needs bidirectional actions.
- Longer TTLs reduce database load but can show stale counts.
- Cursor pagination is fast and stable, but the frontend must track cursors instead of page numbers.

The best production design is DB as source of truth, Redis for counts and hot inbox pages, and an event bus for notification fan-out and cache invalidation.

# Stage 5

## Problems In The Proposed Implementation

The loop performs email, database insert, and app push synchronously for every student. That means one failure stops progress, retries can duplicate messages, the request can time out, and 50,000 students create a large spike against the email API and database. If `send_email` fails after some database inserts already happened, the system has partial state with no reliable recovery plan.

Saving to DB and sending email should not be one synchronous transaction. The database write is the source of truth, while email and real-time delivery are side effects performed by workers. The system should use an outbox or queue so failed email sends can be retried without duplicating notifications.

## Reliable And Fast Redesign

```python
def notify_all(student_ids, message, notification_type, campaign_id):
    batch_id = create_batch(campaign_id, len(student_ids))

    for chunk in chunks(student_ids, 1000):
        notifications = [
            {
                "student_id": student_id,
                "message": message,
                "notification_type": notification_type,
                "batch_id": batch_id,
                "idempotency_key": f"{campaign_id}:{student_id}",
            }
            for student_id in chunk
        ]

        inserted = bulk_insert_notifications_ignore_duplicates(notifications)

        outbox_events = [
            {
                "notification_id": row["id"],
                "student_id": row["student_id"],
                "channels": ["email", "in_app"],
                "attempt": 0,
            }
            for row in inserted
        ]
        bulk_insert_outbox(outbox_events)

    enqueue_batch(batch_id)
    return {"batch_id": batch_id, "status": "queued"}


def delivery_worker():
    while True:
        event = reserve_next_outbox_event()
        if not event:
            continue

        try:
            push_to_app(event.student_id, event.notification_id)
            send_email(event.student_id, event.notification_id)
            mark_outbox_delivered(event.id)
        except TemporaryError as error:
            retry_later(event.id, backoff_seconds(event.attempt), str(error))
        except PermanentError as error:
            mark_outbox_failed(event.id, str(error))
```

If email fails for 200 students midway, those 200 outbox events remain retryable and visible in operations dashboards. Already delivered users are not duplicated because notification creation uses idempotency keys.

# Stage 6

Priority inbox ranking combines business importance and recency:

- Placement: highest weight.
- Result: medium weight.
- Event: lower weight.
- Newer notifications get a recency boost.
- Ties are broken by latest timestamp.

The implemented function lives in `frontend/src/utils/priorityInbox.js`. It sorts API notifications by calculated score and returns the top `n`. New notifications can be maintained efficiently by merging incoming events into the current top list and re-ranking only the small candidate set. At larger scale, use a bounded min-heap of size `n`, making each incoming update `O(log n)` instead of sorting all notifications.

The frontend uses this function on the Priority page and supports choosing top 5, 10, 15, or 20 notifications.

# Stage 7

The frontend implementation is in the `frontend` directory and runs on `http://localhost:3000`. It is a responsive React application styled with Material UI. The backend proxy runs on `http://localhost:5000` and forwards requests to the protected notification API while preserving the `Authorization` header. Backend request and runtime events are recorded through the logging middleware in `backend/src/middleware/logger.js`; the code avoids direct console logging.

Implemented pages:

- `/` displays all notifications with type, limit, page controls, and viewed/new state.
- `/priority` displays top priority notifications using the Stage 6 scoring function.

The UI stores viewed notification ids in `localStorage` so already viewed notifications remain visually distinct after refresh. The protected API token can be entered in the control panel; it is stored locally and sent as `Authorization: Bearer <token>` through the backend proxy.

Submitted evidence:

- `screenshots/desktop-notifications.png`
- `screenshots/mobile-priority.png`
- `videos/desktop-demo.webm`
- `videos/mobile-demo.webm`

Run commands:

```bash
cd backend && npm start
cd frontend && npm run dev -- --host 0.0.0.0 --port 3000
```
