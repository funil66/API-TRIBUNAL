import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { appConfig } from './app.config';

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: appConfig.logging.level,
    format: consoleFormat,
  }),
];

if (appConfig.logging.file_enabled) {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: appConfig.logging.max_size,
      maxFiles: appConfig.logging.max_files,
      format: logFormat,
      level: appConfig.logging.level,
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: appConfig.logging.max_size,
      maxFiles: appConfig.logging.max_files,
      format: logFormat,
      level: 'error',
    })
  );
}

export const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};
