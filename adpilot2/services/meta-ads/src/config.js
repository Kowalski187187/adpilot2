const Joi = require('joi');
require('dotenv').config();

const schema = Joi.object({
  facebook: Joi.object({
    accessToken: Joi.string().required(),
    adAccountId: Joi.string().required(),
    appId: Joi.string().required(),
    appSecret: Joi.string().required(),
    pageId: Joi.string().optional(),
    apiVersion: Joi.string().default('v18.0'),
    currency: Joi.string().default('NOK')
  }).required(),
  server: Joi.object({
    port: Joi.number().port().default(3001),
    env: Joi.string().valid('development', 'production', 'test').default('development')
  }).required(),
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
  }).required()
});

const config = {
  facebook: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    adAccountId: process.env.META_ADS_ACCOUNT_ID,
    appId: process.env.META_ADS_APP_ID,
    appSecret: process.env.META_ADS_APP_SECRET,
    pageId: process.env.META_ADS_PAGE_ID,
    apiVersion: process.env.META_ADS_API_VERSION || 'v18.0',
    currency: process.env.META_ADS_CURRENCY || 'NOK'
  },
  server: {
    port: parseInt(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

const { error, value } = schema.validate(config, { abortEarly: false });

if (error) {
  const missingVars = error.details.map(detail => detail.path.join('.')).join(', ');
  throw new Error(`Configuration validation failed. Missing or invalid variables: ${missingVars}`);
}

module.exports = value; 