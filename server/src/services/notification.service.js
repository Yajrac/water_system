import { validateNotice } from '../validators/notification.validator.js';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';

const outstandingBills = `SELECT b.customer_id,CAST(SUM(GREATEST(0,b.total_amount-COALESCE(p.paid,0))) AS CHAR) AS balance,
  MIN(CASE WHEN b.total_amount>COALESCE(p.paid,0) THEN b.due_date END) AS due
  FROM bills b LEFT JOIN (SELECT bill_id,SUM(amount) AS paid FROM payments GROUP BY bill_id) p ON p.bill_id=b.id
  GROUP BY b.customer_id`;

export async function listNotices() {
  const [rows] = await pool.query(`SELECT a.id, a.title AS type, a.message, a.status,
    a.audience, DATE_FORMAT(a.created_at, '%Y-%m-%d') AS date,
    (SELECT COUNT(*) FROM announcement_recipients r WHERE r.announcement_id=a.id) AS recipients
    FROM announcements a ORDER BY a.id DESC LIMIT 100`);
  return rows;
}

export async function recipientOptions() {
  const [rows] = await pool.query(`SELECT c.id,c.account_number AS account,
    CONCAT_WS(' ',c.last_name,c.first_name,NULLIF(c.middle_name,'')) AS name,
    c.submitter_number AS submitterNumber,u.username,
    c.barangay_id AS barangayId,COALESCE(debt.balance,'0') AS balance,DATE_FORMAT(debt.due,'%Y-%m-%d') AS due
    FROM customers c LEFT JOIN (${outstandingBills}) debt ON debt.customer_id=c.id
    LEFT JOIN users u ON u.id=c.user_id
    WHERE EXISTS(SELECT 1 FROM customer_applications a WHERE a.customer_id=c.id
      AND a.id=(SELECT MAX(id) FROM customer_applications WHERE customer_id=c.id)
      AND a.status IN ('Pending','Approved','Installed')) ORDER BY c.last_name,c.first_name`);
  return rows;
}

export async function saveNotice(body, actorId) {
  const notice = validateNotice(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const targets = notice.audience === 'customer' ? notice.targets || [notice.target] : [];
    const filter =
      notice.audience === 'barangay'
        ? 'AND c.barangay_id=?'
        : notice.audience === 'customer'
          ? 'AND c.id IN (' + targets.map(()=>'?').join(',') + ')'
          : '';
    const [recipients] = await connection.execute(
      `SELECT c.id FROM customers c LEFT JOIN (${outstandingBills}) debt ON debt.customer_id=c.id
      WHERE EXISTS(SELECT 1 FROM customer_applications a WHERE a.customer_id=c.id
        AND a.id=(SELECT MAX(id) FROM customer_applications WHERE customer_id=c.id)
        AND a.status IN ('Pending','Approved','Installed')) ${filter}
        ${['Due date','Unpaid bill'].includes(notice.type) ? 'AND debt.balance > 0' : ''} FOR UPDATE`,
      notice.audience === 'customer' ? targets : notice.audience === 'barangay' ? [notice.target] : [],
    );
    if (targets.length && recipients.length !== targets.length)
      throw new AppError('Some selected customers are no longer eligible. Refresh the recipient list before publishing.',409);
    if (!recipients.length) throw new AppError('No registered customers match this audience.', 400);
    const [result] = await connection.execute(
      `INSERT INTO announcements
      (created_by,title,message,status,audience,published_at) VALUES (?,?,?,?,?,
      ${notice.status === 'Published' ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      [
        actorId,
        notice.type,
        notice.message,
        notice.status,
        notice.audience === 'barangay' ? 'Selected barangays' : 'All',
      ],
    );
    if (notice.audience === 'barangay')
      await connection.execute(
        'INSERT INTO announcement_barangays (announcement_id,barangay_id) VALUES (?,?)',
        [result.insertId, notice.target],
      );
    for (const customer of recipients)
      await connection.execute(
        'INSERT INTO announcement_recipients (announcement_id,customer_id) VALUES (?,?)',
        [result.insertId, customer.id],
      );
    await connection.execute(
      `INSERT INTO activity_logs
      (actor_id,actor_role,action,entity_type,entity_id,description)
      VALUES (?,'admin',?,'announcement',?,?)`,
      [
        actorId,
        notice.status === 'Published' ? 'announcement.published' : 'announcement.drafted',
        result.insertId,
        recipients.length + ' customer recipients',
      ],
    );
    await connection.commit();
    return { id: String(result.insertId), recipients: recipients.length, status: notice.status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function consumerNotifications(userId) {
  const [[customer]] = await pool.execute(`SELECT c.id,
    (SELECT status FROM customer_applications WHERE customer_id=c.id ORDER BY id DESC LIMIT 1) AS applicationStatus
    FROM customers c WHERE user_id=?`, [userId]);
  if (!customer) throw new AppError('No customer profile is linked to this account.', 404);
  const id = customer.id;
  const [notices] = await pool.execute(
    `SELECT CONCAT('notice-',a.id) AS id,a.title,
    a.message AS body,'Advisory' AS category,DATE_FORMAT(CONVERT_TZ(a.published_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM announcements a JOIN announcement_recipients r ON r.announcement_id=a.id
    WHERE r.customer_id=? AND a.status='Published' AND a.published_at<=UTC_TIMESTAMP()
      AND (a.expires_at IS NULL OR a.expires_at>UTC_TIMESTAMP()) ORDER BY a.id DESC LIMIT 100`,
    [id],
  );
  const [bills] = await pool.execute(
    `SELECT CONCAT('bill-',b.id) AS id,'New water bill' AS title,
    CONCAT('Your ',DATE_FORMAT(b.billing_month,'%Y-%m'),' bill is PHP ',b.total_amount,
      '. Due: ',DATE_FORMAT(b.due_date,'%Y-%m-%d'),'.') AS body,'Billing' AS category,
    DATE_FORMAT(CONVERT_TZ(b.created_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date FROM bills b
    WHERE b.customer_id=? ORDER BY b.id DESC LIMIT 100`,
    [id],
  );
  const [payments] = await pool.execute(
    `SELECT CONCAT('payment-',p.id) AS id,'Payment recorded' AS title,
    CONCAT('Payment of PHP ',p.amount,' recorded. Receipt: ',p.receipt_number,'.') AS body,
    'Payment' AS category,DATE_FORMAT(CONVERT_TZ(p.created_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.customer_id=? ORDER BY p.id DESC LIMIT 100`,
    [id],
  );
  const [applications] = await pool.execute(
    `SELECT CONCAT('application-',id,'-',status,'-',DATE_FORMAT(updated_at,'%Y%m%d%H%i%s')) AS id,
    CONCAT('Application ',status) AS title,CONCAT('Your water service application status is ',status,'.') AS body,
    'Application' AS category,DATE_FORMAT(CONVERT_TZ(updated_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM customer_applications WHERE customer_id=? ORDER BY id DESC LIMIT 20`,
    [id],
  );
  const [reads] = await pool.execute(
    'SELECT notification_key FROM notification_reads WHERE user_id=?',
    [userId],
  );
  const keys = new Set(reads.map((row) => row.notification_key));
  return [...notices, ...(customer.applicationStatus === 'Installed' ? [...bills, ...payments] : []), ...applications]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100)
    .map((item) => ({ ...item, read: keys.has(item.id) }));
}

export async function markNotificationsRead(userId, body) {
  if (
    !Array.isArray(body?.ids) ||
    body.ids.length > 100 ||
    body.ids.some((id) => typeof id !== 'string' || id.length > 100)
  )
    throw new AppError('Select valid notifications.', 400);
  const accessible = new Set((await consumerNotifications(userId)).map((item) => item.id));
  if (body.ids.some((id) => !accessible.has(id)))
    throw new AppError('Notification not found.', 404);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const id of new Set(body.ids))
      await connection.execute(
        'INSERT IGNORE INTO notification_reads (user_id,notification_key,read_at) VALUES (?,?,UTC_TIMESTAMP())',
        [userId, id],
      );
    await connection.commit();
    return { read: body.ids.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

