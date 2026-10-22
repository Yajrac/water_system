import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';
import { validateFeedback } from '../validators/feedback.validator.js';

async function linkedCustomer(userId, connection = pool) {
  const [[customer]] = await connection.execute('SELECT id FROM customers WHERE user_id=?', [
    userId,
  ]);
  if (!customer) throw new AppError('No customer profile is linked to this account.', 404);
  return customer.id;
}
export async function ownProfile(userId) {
  const id = await linkedCustomer(userId);
  const [[row]] = await pool.execute(
    `SELECT c.id,c.account_number AS account,c.submitter_number AS submitter,
    CONCAT_WS(' ',c.first_name,NULLIF(c.middle_name,''),c.last_name,NULLIF(c.extension_name,'')) AS name,
    c.first_name AS firstName,c.customer_type AS customerType,c.connection_status AS status,
    CONCAT_WS(', ',NULLIF(c.purok,''),NULLIF(c.street,''),b.name) AS address,c.contact_number AS contact,
    COALESCE((SELECT meter_number FROM water_meters WHERE customer_id=c.id AND is_active=1 ORDER BY id DESC LIMIT 1),'Not recorded') AS meter
    FROM customers c JOIN barangays b ON b.id=c.barangay_id WHERE c.id=?`,
    [id],
  );
  return row;
}

export async function ownFinances(userId, query = {}) {
  const pageValue = (value) => {
    const page = Number(value || 1);
    if (!Number.isInteger(page) || page < 1 || page > 1000000)
      throw new AppError('Invalid page.', 400);
    return page;
  };
  const billsPage = pageValue(query.billsPage),
    paymentsPage = pageValue(query.paymentsPage),
    limit = 10,
    billsLimit = 10;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = await linkedCustomer(userId, connection);
    const source = `FROM bills b LEFT JOIN (SELECT bill_id,SUM(amount) AS paid FROM payments GROUP BY bill_id) p ON p.bill_id=b.id WHERE b.customer_id=?`;
    const [[summary]] = await connection.execute(
      `SELECT COUNT(*) AS billCount,
      CAST(COALESCE(SUM(GREATEST(0,b.total_amount-COALESCE(p.paid,0))),0) AS CHAR) AS balance,
      CAST(COALESCE(SUM(COALESCE(p.paid,0)),0) AS CHAR) AS totalPaid ${source}`,
      [id],
    );
    const [[count]] = await connection.execute(
      'SELECT COUNT(*) AS total FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.customer_id=?',
      [id],
    );
    const columns = `b.id,b.bill_number AS number,DATE_FORMAT(b.billing_month,'%Y-%m') AS month,
      DATE_FORMAT(b.due_date,'%Y-%m-%d') AS due,CAST(b.previous_reading AS CHAR) AS previous,
      CAST(b.current_reading AS CHAR) AS current,CAST(b.consumption AS CHAR) AS consumption,
      CAST(b.rate_per_cubic_meter AS CHAR) AS rate,CAST(b.water_charge AS CHAR) AS water,
      CAST(b.connection_charge AS CHAR) AS connection,CAST(b.late_fee AS CHAR) AS late,
      CAST(b.other_charge AS CHAR) AS other,CAST(b.total_amount AS CHAR) AS total,
      CAST(COALESCE(p.paid,0) AS CHAR) AS paid,
      CAST(GREATEST(0,b.total_amount-COALESCE(p.paid,0)) AS CHAR) AS balance,
      CASE WHEN b.total_amount<=COALESCE(p.paid,0) THEN 'Paid'
        WHEN b.due_date<DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')) THEN 'Overdue' ELSE 'Unpaid' END AS status`;
    const [bills] = await connection.execute(
      `SELECT ${columns} ${source} ORDER BY b.billing_month DESC,b.id DESC LIMIT ${billsLimit} OFFSET ${(billsPage - 1) * billsLimit}`,
      [id],
    );
    const [latest] = await connection.execute(
      `SELECT ${columns} ${source} ORDER BY b.billing_month DESC,b.id DESC LIMIT 1`,
      [id],
    );
    const [payments] = await connection.execute(
      `SELECT p.id,p.receipt_number AS receipt,p.bill_id AS billId,
      DATE_FORMAT(b.billing_month,'%Y-%m') AS month,CAST(p.amount AS CHAR) AS amount,
      p.payment_method AS method,COALESCE(p.reference_number,'') AS reference,
      DATE_FORMAT(CONVERT_TZ(p.paid_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i') AS date,
      CAST(b.previous_reading AS CHAR) AS previous,CAST(b.current_reading AS CHAR) AS current,
      CAST(b.consumption AS CHAR) AS consumption,b.bill_number AS billNumber,
      CAST(b.total_amount-COALESCE((SELECT SUM(pr.amount) FROM payments pr WHERE pr.bill_id=p.bill_id AND pr.id<p.id),0) AS CHAR) AS balanceBefore,
      CAST(GREATEST(0,b.total_amount-COALESCE((SELECT SUM(pr.amount) FROM payments pr WHERE pr.bill_id=p.bill_id AND pr.id<=p.id),0)) AS CHAR) AS balanceAfter
      FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.customer_id=?
      ORDER BY p.paid_at DESC,p.id DESC LIMIT 10 OFFSET ${(paymentsPage - 1) * limit}`,
      [id],
    );
    await connection.commit();
    return {
      summary: {
        ...summary,
        billCount: Number(summary.billCount),
        paymentCount: Number(count.total),
      },
      latestBill: latest[0] || null,
      bills,
      payments,
      billsPagination: { page: billsPage, limit: billsLimit, total: Number(summary.billCount) },
      paymentsPagination: { page: paymentsPage, limit, total: Number(count.total) },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function submitFeedback(userId, body) {
  const feedback = validateFeedback(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const customerId = await linkedCustomer(userId, connection);
    const [thread] = await connection.execute(
      'INSERT INTO feedback_threads (customer_id,category) VALUES (?,?)',
      [customerId, feedback.category],
    );
    await connection.execute(
      'INSERT INTO feedback_messages (thread_id,sender_id,message) VALUES (?,?,?)',
      [thread.insertId, userId, feedback.message],
    );
    await connection.execute(
      `INSERT INTO activity_logs (actor_id,actor_role,action,entity_type,entity_id,description)
      VALUES (?,'consumer','feedback.submitted','feedback',?,'Consumer submitted feedback.')`,
      [userId, thread.insertId],
    );
    await connection.commit();
    return { id: String(thread.insertId), status: 'New' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
const feedbackSelect = `SELECT t.id,t.customer_id AS customerId,t.category,t.status,
  c.account_number AS account,CONCAT_WS(' ',c.last_name,c.first_name,NULLIF(c.middle_name,'')) AS name,
  DATE_FORMAT(CONVERT_TZ(t.created_at,'+00:00','+08:00'),'%Y-%m-%d %H:%i') AS date,
  (SELECT message FROM feedback_messages m WHERE m.thread_id=t.id AND m.sender_id=c.user_id ORDER BY m.id LIMIT 1) AS message
  FROM feedback_threads t JOIN customers c ON c.id=t.customer_id`;
export async function ownFeedback(userId) {
  const id = await linkedCustomer(userId);
  const [rows] = await pool.execute(
    feedbackSelect + ' WHERE t.customer_id=? ORDER BY t.id DESC LIMIT 100',
    [id],
  );
  return rows;
}
export async function adminFeedback(query) {
  const search = query.search || '',
    status = query.status || '';
  const page = Number(query.page || 1),
    limit = 10;
  if (
    typeof search !== 'string' ||
    search.length > 100 ||
    !['', 'New', 'In progress', 'Resolved'].includes(status) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000000
  )
    throw new AppError('Invalid feedback filters.', 400);
  const where = ` WHERE (?='' OR t.status=?) AND (?='' OR CONCAT_WS(' ',c.first_name,c.last_name,c.account_number,t.category) LIKE ?)`;
  const values = [status, status, search, '%' + search + '%'];
  const [[count]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM feedback_threads t JOIN customers c ON c.id=t.customer_id' +
      where,
    values,
  );
  const [rows] = await pool.execute(
    feedbackSelect + where + ` ORDER BY t.id DESC LIMIT 10 OFFSET ${(page - 1) * limit}`,
    values,
  );
  return { feedback: rows, pagination: { page, limit, total: Number(count.total) } };
}
export async function updateFeedback(id, body, actorId) {
  if (
    !/^[1-9]\d{0,19}$/.test(id) ||
    !body ||
    Object.keys(body).some((key) => key !== 'status') ||
    !['New', 'In progress', 'Resolved'].includes(body.status)
  )
    throw new AppError('Select a valid feedback status. Replies are not supported.', 400);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[thread]] = await connection.execute(
      'SELECT id FROM feedback_threads WHERE id=? FOR UPDATE',
      [id],
    );
    if (!thread) throw new AppError('Feedback not found.', 404);
    await connection.execute(
      `UPDATE feedback_threads SET status=?,resolved_at=${body.status === 'Resolved' ? 'UTC_TIMESTAMP()' : 'NULL'} WHERE id=?`,
      [body.status, id],
    );
    await connection.execute(
      `INSERT INTO activity_logs (actor_id,actor_role,action,entity_type,entity_id,description)
      VALUES (?,'admin','feedback.status_changed','feedback',?,?)`,
      [actorId, id, body.status],
    );
    await connection.commit();
    return { id, status: body.status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
