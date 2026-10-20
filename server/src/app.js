import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import barangayRoutes from './routes/barangay.routes.js';
import authRoutes from './routes/auth.routes.js';

import { env } from './config/env.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);

app.use(express.json({ limit: '100kb' }));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Water System API is running.',
  });
});

app.use('/api/v1/barangays', barangayRoutes);
app.use('/api/v1/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
