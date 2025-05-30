const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const MetaAdsService = require('./services/metaAds');
const config = require('./config');

const app = express();
const metaAdsService = new MetaAdsService();

app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get campaign stats
app.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || '1d';
    const campaigns = await metaAdsService.getAllCampaigns(period);
    res.json(campaigns);
  } catch (error) {
    logger.error('Error in /stats endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all campaigns
app.get('/campaigns', async (req, res) => {
  try {
    const period = req.query.period || '1d';
    const campaigns = await metaAdsService.getAllCampaigns(period);
    res.json(campaigns);
  } catch (error) {
    logger.error('Error in /campaigns endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new campaign
app.post('/campaigns', async (req, res) => {
  try {
    const campaign = await metaAdsService.createCampaign(req.body);
    res.json(campaign);
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause campaign
app.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const result = await metaAdsService.pauseCampaign(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign insights endpoint
app.get('/campaigns/:id/insights', async (req, res) => {
  try {
    const insights = await metaAdsService.getCampaignInsights(req.params.id);
    res.json(insights);
  } catch (error) {
    logger.error('Error in /campaigns/:id/insights endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Meta Ads Service listening on port ${PORT}`);
}); 