import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import barangayRoutes from './routes/barangay.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import billingSetupRoutes from './routes/billing-setup.routes.js';
import meterEntryRoutes from './routes/meter-entry.routes.js';
import billRoutes from './routes/bill.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import consumerRoutes from './routes/consumer.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';

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
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/billing-setups', billingSetupRoutes);
app.use('/api/v1/meter-entries', meterEntryRoutes);
app.use('/api/v1/bills', billRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/consumer', consumerRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
