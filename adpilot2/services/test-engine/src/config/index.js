const Joi = require('joi');

// Configuration schema for validation
const configSchema = Joi.object({
  // Server configuration
  port: Joi.number().port().default(5000),
  
  // Database configuration
  mongodb: Joi.object({
    uri: Joi.string().uri().required(),
    options: Joi.object({
      useNewUrlParser: Joi.boolean().default(true),
      useUnifiedTopology: Joi.boolean().default(true)
    }).default()
  }).required(),

  // Service URLs
  services: Joi.object({
    metaAds: Joi.string().uri().required(),
    googleAds: Joi.string().uri().required()
  }).required(),

  // Test Engine specific configuration
  testEngine: Joi.object({
    checkInterval: Joi.number().integer().min(60).default(3600), // Minimum 1 minute
    roasThreshold: Joi.number().min(0).max(1).default(0.2), // 20% better ROAS required
    minTestDuration: Joi.number().integer().min(24).default(72), // Minimum 24 hours
    minSpendForEvaluation: Joi.number().min(0).default(100),
    maxRetries: Joi.number().integer().min(1).default(3),
    retryDelay: Joi.number().integer().min(100).default(1000)
  }).required(),

  // Logging configuration
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
      .default('info'),
    maxFiles: Joi.string().default('14d'),
    maxSize: Joi.string().default('20m')
  }).required()
});

// Load and validate configuration
const config = {
  port: process.env.PORT || 5000,
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://mongo:27017/adpilot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  services: {
    metaAds: process.env.METAADS_URL || 'http://meta-ads:5001',
    googleAds: process.env.GOOGLEADS_URL || 'http://google-ads:5002'
  },

  testEngine: {
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 3600,
    roasThreshold: parseFloat(process.env.ROAS_THRESHOLD) || 0.2,
    minTestDuration: parseInt(process.env.MIN_TEST_DURATION_HOURS) || 72,
    minSpendForEvaluation: parseFloat(process.env.MIN_SPEND_FOR_EVALUATION) || 100,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m'
  }
};

// Validate configuration
const { error, value } = configSchema.validate(config, { abortEarly: false });

if (error) {
  throw new Error(`Configuration validation failed: ${error.message}`);
}

module.exports = value; 