import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.isDevelopment()
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        )
      : winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
