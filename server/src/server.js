import app from './app.js';

import { env } from './config/env.js';
import {
  pool,
  checkDatabaseConnection,
} from './database/pool.js';

async function startServer() {
  try {
    await checkDatabaseConnection();
    console.log('Database connected.');

    const server = app.listen(env.port, env.host, () => {
      console.log(`Water System API: http://${env.host}:${env.port}`);
    });

    server.on('error', async (error) => {
      console.error('Could not start API:', error.message);
      process.exitCode = 1;
      await pool.end();
    });
  } catch (error) {
    console.error('Could not connect to database:', error.message);
    process.exitCode = 1;
    await pool.end();
  }
}

startServer();
