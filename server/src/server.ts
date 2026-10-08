import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';
import { schedulerService } from './services/scheduler.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

const startServer = async (): Promise<void> => {
  const server = app.listen(PORT, () => {
    console.log(`[Server] Tele App Server listening on port ${PORT}`);
    console.log(`[Server] Health check endpoint: http://localhost:${PORT}/api/health`);
  });

  // Connect to MongoDB
  await connectDB();

  // Start background schedulers (follow-up checks, inactive agent reassignments)
  schedulerService.start();

  const shutdown = (): void => {
    console.log('[Server] Gracefully shutting down...');
    schedulerService.stop();
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer().catch((error) => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});
