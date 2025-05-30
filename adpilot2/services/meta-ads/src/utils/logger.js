const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  ]
});

module.exports = logger; 