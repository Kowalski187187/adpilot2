const winston = require('winston');
require('winston-daily-rotate-file');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Configure file transport options
const fileTransportOptions = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Error log file
    new winston.transports.DailyRotateFile({
      ...fileTransportOptions,
      filename: 'logs/error-%DATE%.log',
      level: 'error'
    }),
    // Combined log file
    new winston.transports.DailyRotateFile({
      ...fileTransportOptions,
      filename: 'logs/combined-%DATE%.log'
    })
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      ...fileTransportOptions,
      filename: 'logs/exceptions-%DATE%.log'
    })
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      ...fileTransportOptions,
      filename: 'logs/rejections-%DATE%.log'
    })
  ]
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger; 