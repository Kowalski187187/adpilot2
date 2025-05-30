const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const logger = require('./utils/logger');
const testEngine = require('./services/testEngine');
const config = require('./config');

// Initialize Express app
const app = express();
const port = config.port;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start test endpoint
app.post('/startTest', async (req, res) => {
  try {
    const campaign = await testEngine.startTest(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    logger.error('Error starting test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign status
app.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await testEngine.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    logger.error('Error getting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop test endpoint
app.post('/campaigns/:id/stop', async (req, res) => {
  try {
    const campaign = await testEngine.stopTest(req.params.id);
    res.json(campaign);
  } catch (error) {
    logger.error('Error stopping test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Hent alle kampanjer
app.get('/campaigns', async (req, res) => {
  try {
    // Valgfritt: filtrer på periode hvis ønskelig
    // const { period } = req.query;
    // For nå: hent alle kampanjer
    const campaigns = await require('./models/Campaign').find({});
    res.json(campaigns);
  } catch (error) {
    logger.error('Error getting all campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Schedule periodic stats check
cron.schedule('*/15 * * * *', async () => {
  try {
    logger.info('Running scheduled stats check');
    const campaigns = await testEngine.getActiveCampaigns();
    for (const campaign of campaigns) {
      await testEngine.collectStats(campaign._id);
    }
  } catch (error) {
    logger.error('Error in scheduled stats check:', error);
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Test Engine service listening on port ${port}`);
}); 