const express = require('express');
const mongoose = require('mongoose');
const Redis = require('redis');
const cors = require('cors');
const winston = require('winston');

// Initialize Express app
const app = express();
const port = process.env.PORT || 4000;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/adpilot')
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Initialize Redis client
const redisClient = Redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', err => logger.error('Redis Client Error:', err));
redisClient.connect()
  .then(() => logger.info('Connected to Redis'))
  .catch(err => logger.error('Redis connection error:', err));

// Start server
app.listen(port, () => {
  logger.info(`Orchestrator service listening on port ${port}`);
}); 