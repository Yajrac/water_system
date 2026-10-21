import { validateNotice } from '../validators/notification.validator.js';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';

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
    c.barangay_id AS barangayId FROM customers c
    WHERE EXISTS(SELECT 1 FROM customer_applications a WHERE a.customer_id=c.id
      AND a.id=(SELECT MAX(id) FROM customer_applications WHERE customer_id=c.id)
      AND a.status IN ('Approved','Installed')) ORDER BY c.last_name,c.first_name`);
  return rows;
}

export async function saveNotice(body, actorId) {
  const notice = validateNotice(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const filter = notice.audience === 'barangay' ? 'AND c.barangay_id=?'
      : notice.audience === 'customer' ? 'AND c.id=?' : '';
    const [recipients] = await connection.execute(`SELECT c.id FROM customers c
      WHERE EXISTS(SELECT 1 FROM customer_applications a WHERE a.customer_id=c.id
        AND a.id=(SELECT MAX(id) FROM customer_applications WHERE customer_id=c.id)
        AND a.status IN ('Approved','Installed')) ${filter} FOR UPDATE`,
      notice.audience === 'all' ? [] : [notice.target]);
    if (!recipients.length) throw new AppError('No registered customers match this audience.', 400);
    const [result] = await connection.execute(`INSERT INTO announcements
      (created_by,title,message,status,audience,published_at) VALUES (?,?,?,?,?,
      ${notice.status === 'Published' ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      [actorId,notice.type,notice.message,notice.status,notice.audience === 'barangay' ? 'Selected barangays' : 'All']);
    if (notice.audience === 'barangay') await connection.execute(
      'INSERT INTO announcement_barangays (announcement_id,barangay_id) VALUES (?,?)', [result.insertId,notice.target]);
    for (const customer of recipients) await connection.execute(
      'INSERT INTO announcement_recipients (announcement_id,customer_id) VALUES (?,?)', [result.insertId,customer.id]);
    await connection.execute(`INSERT INTO activity_logs
      (actor_id,actor_role,action,entity_type,entity_id,description)
      VALUES (?,'admin',?,'announcement',?,?)`,
      [actorId,notice.status === 'Published' ? 'announcement.published' : 'announcement.drafted',
        result.insertId,recipients.length + ' customer recipients']);
    await connection.commit();
    return { id: String(result.insertId), recipients: recipients.length, status: notice.status };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function consumerNotifications(userId) {
  const [[customer]] = await pool.execute('SELECT id FROM customers WHERE user_id=?', [userId]);
  if (!customer) throw new AppError('No customer profile is linked to this account.', 404);
  const id = customer.id;
  const [notices] = await pool.execute(`SELECT CONCAT('notice-',a.id) AS id,a.title,
    a.message AS body,'Advisory' AS category,DATE_FORMAT(CONVERT_TZ(a.published_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM announcements a JOIN announcement_recipients r ON r.announcement_id=a.id
    WHERE r.customer_id=? AND a.status='Published' AND a.published_at<=UTC_TIMESTAMP()
      AND (a.expires_at IS NULL OR a.expires_at>UTC_TIMESTAMP()) ORDER BY a.id DESC LIMIT 100`, [id]);
  const [bills] = await pool.execute(`SELECT CONCAT('bill-',b.id) AS id,'New water bill' AS title,
    CONCAT('Your ',DATE_FORMAT(b.billing_month,'%Y-%m'),' bill is PHP ',b.total_amount,
      '. Due: ',DATE_FORMAT(b.due_date,'%Y-%m-%d'),'.') AS body,'Billing' AS category,
    DATE_FORMAT(CONVERT_TZ(b.created_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date FROM bills b
    WHERE b.customer_id=? ORDER BY b.id DESC LIMIT 100`, [id]);
  const [payments] = await pool.execute(`SELECT CONCAT('payment-',p.id) AS id,'Payment recorded' AS title,
    CONCAT('Payment of PHP ',p.amount,' recorded. Receipt: ',p.receipt_number,'.') AS body,
    'Payment' AS category,DATE_FORMAT(CONVERT_TZ(p.created_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.customer_id=? ORDER BY p.id DESC LIMIT 100`, [id]);
  const [applications] = await pool.execute(`SELECT CONCAT('application-',id) AS id,
    CONCAT('Application ',status) AS title,CONCAT('Your water service application status is ',status,'.') AS body,
    'Application' AS category,DATE_FORMAT(CONVERT_TZ(updated_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i:%s') AS date
    FROM customer_applications WHERE customer_id=? ORDER BY id DESC LIMIT 20`, [id]);
  return [...notices,...bills,...payments,...applications].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100);
}
