import { query } from './db.js';
import { AppError } from './errors.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface NotificationRow {
  id: string; type: string; message: string; vehicle_id: string | null; created_at: Date; read_at: Date | null;
}

function notification(row: NotificationRow) {
  return { id: row.id, type: row.type, message: row.message, vehicleId: row.vehicle_id,
    createdAt: row.created_at, readAt: row.read_at, read: row.read_at !== null };
}

function pageNumber(value: unknown, name: string, fallback: number, maximum = 2_147_483_647) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new AppError(400, `${name} is invalid`);
  }
  return Number(value);
}

export async function listNotifications(userId: string, input: Record<string, unknown>) {
  if (Object.keys(input).some((key) => !['page', 'limit'].includes(key))) throw new AppError(400, 'Unexpected query parameter');
  const page = pageNumber(input.page, 'page', 1);
  const limit = pageNumber(input.limit, 'limit', 20, 100);
  const counts = (await query<{ total: string; unread: string }>(
    'SELECT count(*) AS total, count(*) FILTER (WHERE read_at IS NULL) AS unread FROM notifications WHERE recipient_id = $1', [userId]
  )).rows[0];
  const rows = await query<NotificationRow>(
    `SELECT id, type, message, vehicle_id, created_at, read_at FROM notifications
     WHERE recipient_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit]
  );
  const total = Number(counts.total);
  return { notifications: rows.rows.map(notification), unreadCount: Number(counts.unread),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function markNotificationRead(userId: string, id: string) {
  if (!uuid.test(id)) throw new AppError(400, 'Notification ID must be a valid UUID');
  const result = await query<NotificationRow>(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_id = $2 RETURNING id, type, message, vehicle_id, created_at, read_at`, [id, userId]
  );
  if (!result.rows[0]) throw new AppError(404, 'Notification not found');
  return { notification: notification(result.rows[0]) };
}
