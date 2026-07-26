import createApp from './app';
import config from './config';
import logger from './utils/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.env}]`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

export default server;
