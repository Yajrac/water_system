import mysql from 'mysql2/promise';

import { databaseOptions } from '../config/database.js';

const options = await databaseOptions();

export const pool = mysql.createPool({
  ...options,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 20,
  multipleStatements: false,
});

export async function checkDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}