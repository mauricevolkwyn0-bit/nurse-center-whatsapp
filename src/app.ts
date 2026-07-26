import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config';
import routes from './routes';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { notFoundHandler, globalErrorHandler } from './middlewares/error.middleware';

const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use(config.apiPrefix, routes);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};

export default createApp;
