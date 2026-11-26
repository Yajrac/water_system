import { AppError } from '../utils/app-error.js';

// Phone push notifications through the Expo push service (which uses Firebase on Android).
// The app registers its Expo push token after sign-in; a worker then sends every new,
// unread consumer notification once per device, with the app's "ting" sound.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
const MAX_ATTEMPTS = 5;
export const PUSH_CHANNEL = 'pwss-alerts';
export const PUSH_SOUND = 'ting.wav';

export function validPushToken(token) {
  if (typeof token !== 'string' || token.length > 255 || !TOKEN_PATTERN.test(token))
    throw new AppError('Provide a valid Expo push token.', 400);
  return token;
}

export function pushMessage(token, item) {
  return {
    to: token,
    title: item.title,
    body: item.body.length > 240 ? item.body.slice(0, 237) + '...' : item.body,
    sound: PUSH_SOUND,
    channelId: PUSH_CHANNEL,
    priority: 'high',
    data: { url: '/announcements', id: item.id },
  };
}

export function createPushService({ db, feed, fetchImpl = fetch, log = console.error }) {
  // Everything already in the feed counts as delivered, so a new phone is not flooded with history.
  async function seed(connection, deviceId, userId) {
    const items = await feed(userId);
    for (const item of items)
      await connection.execute(
        `INSERT IGNORE INTO push_deliveries (device_id, notification_key, status, attempts)
        VALUES (?, ?, 'Delivered', 0)`,
        [deviceId, item.id],
      );
  }

  return {
    async register(userId, token) {
      validPushToken(token);
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [[existing]] = await connection.execute(
          'SELECT id, user_id AS userId FROM push_devices WHERE token = ? FOR UPDATE',
          [token],
        );
        let deviceId = existing?.id;
        if (!existing) {
          const [result] = await connection.execute(
            'INSERT INTO push_devices (user_id, token, is_active) VALUES (?, ?, 1)',
            [userId, token],
          );
          deviceId = result.insertId;
        } else {
          // The same phone signed in to another account: start its history fresh.
          if (String(existing.userId) !== String(userId))
            await connection.execute('DELETE FROM push_deliveries WHERE device_id = ?', [deviceId]);
          await connection.execute(
            'UPDATE push_devices SET user_id = ?, is_active = 1, updated_at = UTC_TIMESTAMP() WHERE id = ?',
            [userId, deviceId],
          );
        }
        await seed(connection, deviceId, userId);
        await connection.commit();
        return { registered: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    // One pass: find unread notifications not yet sent to each active phone and send them.
    async sendPending() {
      const [devices] = await db.execute(
        `SELECT d.id, d.user_id AS userId, d.token FROM push_devices d
        JOIN users u ON u.id = d.user_id
        WHERE d.is_active = 1 AND u.is_active = 1 AND u.role = 'consumer'`,
      );
      const queue = [];
      for (const device of devices) {
        let items;
        try {
          items = (await feed(device.userId)).filter((item) => !item.read);
        } catch (error) {
          log('Push feed failed for device ' + device.id + ':', error.code || error.message);
          continue;
        }
        if (!items.length) continue;
        const [rows] = await db.execute(
          `SELECT notification_key AS id, status, attempts, next_attempt_at <= UTC_TIMESTAMP() AS due
          FROM push_deliveries WHERE device_id = ?`,
          [device.id],
        );
        const known = new Map(rows.map((row) => [row.id, row]));
        for (const item of items.slice(0, 20)) {
          const row = known.get(item.id);
          if (row && (row.status !== 'Pending' || !Number(row.due) || row.attempts >= MAX_ATTEMPTS)) continue;
          queue.push({ device, item });
        }
      }
      for (let start = 0; start < queue.length; start += 100) {
        const batch = queue.slice(start, start + 100);
        let tickets;
        try {
          const response = await fetchImpl(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(batch.map(({ device, item }) => pushMessage(device.token, item))),
          });
          tickets = (await response.json())?.data;
          if (!response.ok || !Array.isArray(tickets)) throw new Error('Expo push HTTP ' + response.status);
        } catch (error) {
          log('Push send failed:', error.message);
          tickets = batch.map(() => ({ status: 'error', retry: true }));
        }
        for (const [index, { device, item }] of batch.entries()) {
          const ticket = tickets[index] || { status: 'error', retry: true };
          if (ticket.status === 'ok') {
            await db.execute(
              `INSERT INTO push_deliveries (device_id, notification_key, status, attempts, ticket_id)
              VALUES (?, ?, 'Accepted', 1, ?)
              ON DUPLICATE KEY UPDATE status = 'Accepted', attempts = attempts + 1, ticket_id = VALUES(ticket_id)`,
              [device.id, item.id, String(ticket.id || '').slice(0, 255) || null],
            );
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            // The app was uninstalled or the token expired.
            await db.execute('UPDATE push_devices SET is_active = 0 WHERE id = ?', [device.id]);
          } else {
            await db.execute(
              `INSERT INTO push_deliveries (device_id, notification_key, status, attempts, next_attempt_at)
              VALUES (?, ?, 'Pending', 1, UTC_TIMESTAMP() + INTERVAL 5 MINUTE)
              ON DUPLICATE KEY UPDATE attempts = attempts + 1,
                status = IF(attempts >= ${MAX_ATTEMPTS}, 'Failed', 'Pending'),
                next_attempt_at = UTC_TIMESTAMP() + INTERVAL 5 MINUTE`,
              [device.id, item.id],
            );
          }
        }
      }
      return { sent: queue.length };
    },
  };
}

export function startPushWorker(push, { interval = 30000, log = console.error } = {}) {
  let pending = false;
  async function tick() {
    if (pending) return;
    pending = true;
    try { await push.sendPending(); }
    catch (error) { log('Push notifications failed:', error.code || error.message); }
    finally { pending = false; }
  }
  const timer = setInterval(tick, interval);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}
