const Campaign = require('../models/Campaign');
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

// Configure axios with defaults
const apiClient = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

class TestEngine {
  constructor() {
    this.metaAdsUrl = config.services.metaAds;
    this.googleAdsUrl = config.services.googleAds;
    this.roasThreshold = config.testEngine.roasThreshold;
    this.minTestDuration = config.testEngine.minTestDuration;
    this.minSpendForEvaluation = config.testEngine.minSpendForEvaluation;
    this.maxRetries = config.testEngine.maxRetries;
    this.retryDelay = config.testEngine.retryDelay;
  }

  async makeApiRequest(url, method, data = null, retryCount = 0) {
    try {
      const response = await apiClient({
        method,
        url,
        data
      });
      return response.data;
    } catch (error) {
      if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
        logger.warn(`Retrying API request to ${url} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.makeApiRequest(url, method, data, retryCount + 1);
      }
      throw this.handleApiError(error);
    }
  }

  shouldRetry(error) {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      (error.response && error.response.status >= 500)
    );
  }

  handleApiError(error) {
    if (error.response) {
      logger.error(`API Error: ${error.response.status} - ${error.response.data}`);
      return new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    if (error.request) {
      logger.error(`No response received: ${error.message}`);
      return new Error(`No response received: ${error.message}`);
    }
    logger.error(`Request setup error: ${error.message}`);
    return new Error(`Request setup error: ${error.message}`);
  }

  async startTest(campaignData) {
    try {
      // Validate campaign data
      if (!campaignData.variants || campaignData.variants.length !== 2) {
        throw new Error('Campaign must have exactly 2 variants');
      }

      // Create campaign document
      const campaign = new Campaign(campaignData);
      await campaign.save();
      logger.info(`Created new test campaign: ${campaign._id}`);

      // Create ads for each variant
      for (const variant of campaign.variants) {
        await this.createAdsForVariant(campaign, variant);
      }

      // Update campaign status
      campaign.status = 'running';
      await campaign.save();

      return campaign;
    } catch (error) {
      logger.error('Error starting test:', error);
      throw error;
    }
  }

  async createAdsForVariant(campaign, variant) {
    try {
      // Calculate budget per variant (split evenly)
      const variantBudget = campaign.budgetPerDay / campaign.variants.length;

      // Create Facebook ad if channel selected
      if (campaign.channels.includes('facebook')) {
        const fbResponse = await this.makeApiRequest(
          `${this.metaAdsUrl}/campaigns`,
          'post',
          {
            campaignName: `${campaign.name} - ${variant.name}`,
            adsetName: `Variant ${variant.id} - ${variant.name}`,
            adName: `Ad for ${variant.name}`,
            productId: variant.productId,
            productName: variant.name,
            creative: variant.creative,
            targeting: campaign.targeting,
            budgetPerDay: variantBudget,
            durationDays: campaign.durationDays
          }
        );
        variant.adIds.facebook = fbResponse.adId;
      }

      // Create Google ad if channel selected
      if (campaign.channels.includes('google')) {
        const googleResponse = await this.makeApiRequest(
          `${this.googleAdsUrl}/campaigns`,
          'post',
          {
            campaignName: `${campaign.name} - ${variant.name}`,
            productId: variant.productId,
            productName: variant.name,
            adText: variant.creative.text,
            url: `https://your-shop.myshopify.com/products/${variant.productId}`,
            dailyBudget: variantBudget,
            targeting: campaign.targeting
          }
        );
        variant.adIds.google = googleResponse.adId;
      }

      variant.status = 'active';
      await campaign.save();
      logger.info(`Created ads for variant ${variant.id} in campaign ${campaign._id}`);
    } catch (error) {
      logger.error(`Error creating ads for variant ${variant.id}:`, error);
      throw error;
    }
  }

  async collectStats(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Collect stats for each variant
      for (const variant of campaign.variants) {
        await this.updateVariantStats(campaign, variant);
      }

      // Check if we should auto-switch
      await this.evaluateTest(campaign);

      await campaign.save();
      return campaign;
    } catch (error) {
      logger.error(`Error collecting stats for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  async updateVariantStats(campaign, variant) {
    try {
      let totalSpend = 0;
      let totalRevenue = 0;
      let totalImpressions = 0;
      let totalConversions = 0;

      // Get Facebook stats if applicable
      if (variant.adIds.facebook) {
        const fbStats = await this.makeApiRequest(
          `${this.metaAdsUrl}/campaigns/${variant.adIds.facebook}/insights`,
          'get'
        );
        totalSpend += fbStats.spend || 0;
        totalRevenue += fbStats.purchase_value || 0;
        totalImpressions += fbStats.impressions || 0;
        totalConversions += fbStats.conversions || 0;
      }

      // Get Google stats if applicable
      if (variant.adIds.google) {
        const googleStats = await this.makeApiRequest(
          `${this.googleAdsUrl}/campaigns/${variant.adIds.google}/stats`,
          'get'
        );
        totalSpend += googleStats.cost || 0;
        totalRevenue += googleStats.conversion_value || 0;
        totalImpressions += googleStats.impressions || 0;
        totalConversions += googleStats.conversions || 0;
      }

      // Calculate ROAS (Return on Ad Spend)
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      // Update campaign results
      if (variant.id === 'A') {
        campaign.results.spendA = totalSpend;
        campaign.results.revenueA = totalRevenue;
        campaign.results.roasA = roas;
        campaign.results.impressionsA = totalImpressions;
        campaign.results.conversionsA = totalConversions;
      } else {
        campaign.results.spendB = totalSpend;
        campaign.results.revenueB = totalRevenue;
        campaign.results.roasB = roas;
        campaign.results.impressionsB = totalImpressions;
        campaign.results.conversionsB = totalConversions;
      }

      // Calculate and update overall campaign ROAS
      const totalCampaignSpend = campaign.results.spendA + campaign.results.spendB;
      const totalCampaignRevenue = campaign.results.revenueA + campaign.results.revenueB;
      campaign.results.overallRoas = totalCampaignSpend > 0 ? totalCampaignRevenue / totalCampaignSpend : 0;

      logger.info(`Updated stats for variant ${variant.id} in campaign ${campaign._id}:`, {
        spend: totalSpend,
        revenue: totalRevenue,
        roas: roas,
        impressions: totalImpressions,
        conversions: totalConversions,
        overallRoas: campaign.results.overallRoas
      });

      await campaign.save();
    } catch (error) {
      logger.error(`Error updating stats for variant ${variant.id}:`, error);
      throw error;
    }
  }

  async evaluateTest(campaign) {
    // Check if minimum test duration has passed
    const testDuration = (new Date() - campaign.startDate) / (1000 * 60 * 60); // in hours
    if (testDuration < this.minTestDuration) {
      logger.info(`Campaign ${campaign._id} hasn't reached minimum duration yet`);
      return;
    }

    // Check if minimum spend has been reached
    const totalSpend = campaign.getTotalSpend();
    if (totalSpend < this.minSpendForEvaluation) {
      logger.info(`Campaign ${campaign._id} hasn't reached minimum spend yet`);
      return;
    }

    // Calculate basic metrics
    const roasDiff = Math.abs(campaign.results.roasA - campaign.results.roasB);
    const betterVariant = campaign.results.roasA > campaign.results.roasB ? 'A' : 'B';
    const worseVariant = betterVariant === 'A' ? 'B' : 'A';
    const minRoas = Math.min(campaign.results.roasA, campaign.results.roasB);
    const roasImprovement = roasDiff / minRoas;

    // Calculate statistical significance using Chi-square test
    const significance = this.calculateStatisticalSignificance(campaign);
    
    // Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(campaign);
    
    // Calculate sample size adequacy
    const sampleSizeAdequacy = this.calculateSampleSizeAdequacy(campaign);

    // Evaluate multiple criteria
    const evaluationResults = {
      roasImprovement: {
        value: roasImprovement,
        threshold: this.roasThreshold,
        passed: roasImprovement >= this.roasThreshold
      },
      statisticalSignificance: {
        value: significance,
        threshold: 0.05, // 95% confidence level
        passed: significance < 0.05
      },
      confidenceInterval: {
        value: confidenceInterval,
        threshold: 0.1, // 10% margin of error
        passed: confidenceInterval <= 0.1
      },
      sampleSize: {
        value: sampleSizeAdequacy,
        threshold: 0.8, // 80% adequacy
        passed: sampleSizeAdequacy >= 0.8
      },
      lastEvaluated: new Date()
    };

    // Store evaluation results in campaign
    campaign.results.evaluationResults = evaluationResults;

    // Log detailed evaluation results
    logger.info(`Evaluation results for campaign ${campaign._id}:`, evaluationResults);

    // Make decision based on all criteria
    const allCriteriaPassed = Object.values(evaluationResults)
      .filter(criterion => criterion !== evaluationResults.lastEvaluated)
      .every(criterion => criterion.passed);
    
    if (allCriteriaPassed) {
      logger.info(`Auto-switching campaign ${campaign._id} to variant ${betterVariant} - All criteria passed`);
      await this.switchToWinner(campaign, betterVariant);
    } else {
      // Log which criteria failed
      const failedCriteria = Object.entries(evaluationResults)
        .filter(([key, criterion]) => key !== 'lastEvaluated' && !criterion.passed)
        .map(([name]) => name);
      
      logger.info(`No auto-switch for campaign ${campaign._id} - Failed criteria: ${failedCriteria.join(', ')}`);
    }

    // Save campaign with updated evaluation results
    await campaign.save();
  }

  calculateStatisticalSignificance(campaign) {
    try {
      // Validate input data
      const conversionsA = campaign.results.conversionsA || 0;
      const impressionsA = campaign.results.impressionsA || 0;
      const conversionsB = campaign.results.conversionsB || 0;
      const impressionsB = campaign.results.impressionsB || 0;

      // Check for minimum data requirements
      if (impressionsA === 0 || impressionsB === 0) {
        logger.warn(`Insufficient impression data for statistical significance calculation in campaign ${campaign._id}`);
        return 1.0; // Return non-significant result
      }

      // Calculate expected values
      const totalConversions = conversionsA + conversionsB;
      const totalImpressions = impressionsA + impressionsB;
      
      if (totalImpressions === 0) {
        logger.warn(`No impressions data available for campaign ${campaign._id}`);
        return 1.0;
      }

      const expectedRate = totalConversions / totalImpressions;
      const expectedA = impressionsA * expectedRate;
      const expectedB = impressionsB * expectedRate;

      // Check for minimum expected values (Chi-square assumption)
      if (expectedA < 5 || expectedB < 5) {
        logger.warn(`Expected values too low for reliable Chi-square test in campaign ${campaign._id}`);
        return 1.0;
      }

      // Calculate Chi-square statistic
      const chiSquare = Math.pow(conversionsA - expectedA, 2) / expectedA +
                       Math.pow(conversionsB - expectedB, 2) / expectedB;

      // Convert to p-value (simplified)
      return Math.exp(-chiSquare / 2);
    } catch (error) {
      logger.error(`Error calculating statistical significance for campaign ${campaign._id}:`, error);
      return 1.0; // Return non-significant result on error
    }
  }

  calculateConfidenceInterval(campaign) {
    try {
      // Validate input data
      const roasA = campaign.results.roasA || 0;
      const roasB = campaign.results.roasB || 0;
      const spendA = campaign.results.spendA || 0;
      const spendB = campaign.results.spendB || 0;

      // Check for minimum spend requirements
      if (spendA === 0 || spendB === 0) {
        logger.warn(`Insufficient spend data for confidence interval calculation in campaign ${campaign._id}`);
        return 1.0; // Return maximum uncertainty
      }

      // Calculate standard error
      const seA = Math.sqrt(roasA * (1 - roasA) / spendA);
      const seB = Math.sqrt(roasB * (1 - roasB) / spendB);
      const seDiff = Math.sqrt(Math.pow(seA, 2) + Math.pow(seB, 2));

      // Check for invalid standard error
      if (!Number.isFinite(seDiff)) {
        logger.warn(`Invalid standard error calculated for campaign ${campaign._id}`);
        return 1.0;
      }

      // Calculate margin of error (95% confidence)
      return 1.96 * seDiff;
    } catch (error) {
      logger.error(`Error calculating confidence interval for campaign ${campaign._id}:`, error);
      return 1.0; // Return maximum uncertainty on error
    }
  }

  calculateSampleSizeAdequacy(campaign) {
    try {
      // Calculate if we have enough data for reliable results
      const minRequiredConversions = 30; // Minimum conversions needed for statistical validity
      const totalConversions = (campaign.results.conversionsA || 0) + 
                              (campaign.results.conversionsB || 0);
      
      // Check for minimum conversion requirements
      if (totalConversions === 0) {
        logger.warn(`No conversions recorded for campaign ${campaign._id}`);
        return 0;
      }

      const adequacy = Math.min(1, totalConversions / minRequiredConversions);
      
      // Log adequacy level
      if (adequacy < 0.5) {
        logger.warn(`Low sample size adequacy (${adequacy.toFixed(2)}) for campaign ${campaign._id}`);
      }

      return adequacy;
    } catch (error) {
      logger.error(`Error calculating sample size adequacy for campaign ${campaign._id}:`, error);
      return 0; // Return minimum adequacy on error
    }
  }

  async switchToWinner(campaign, winnerVariant) {
    try {
      // Pause the losing variant
      const losingVariant = campaign.variants.find(v => v.id !== winnerVariant);
      
      if (losingVariant.adIds.facebook) {
        await this.makeApiRequest(
          `${this.metaAdsUrl}/campaigns/${losingVariant.adIds.facebook}/pause`,
          'post'
        );
      }
      
      if (losingVariant.adIds.google) {
        await this.makeApiRequest(
          `${this.googleAdsUrl}/campaigns/${losingVariant.adIds.google}/pause`,
          'post'
        );
      }

      // Update campaign status
      campaign.status = 'completed';
      campaign.results.winner = winnerVariant;
      campaign.endDate = new Date();

      // Update variant statuses
      campaign.variants.find(v => v.id === winnerVariant).status = 'completed';
      campaign.variants.find(v => v.id !== winnerVariant).status = 'paused';

      await campaign.save();
      logger.info(`Successfully switched campaign ${campaign._id} to variant ${winnerVariant}`);
    } catch (error) {
      logger.error(`Error switching to winner in campaign ${campaign._id}:`, error);
      throw error;
    }
  }

  async getActiveCampaigns() {
    try {
      const campaigns = await Campaign.find({
        status: 'running',
        startDate: { $lte: new Date() },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gt: new Date() } }
        ]
      }).sort({ startDate: 1 });

      logger.info(`Found ${campaigns.length} active campaigns`);
      return campaigns;
    } catch (error) {
      logger.error('Error fetching active campaigns:', error);
      throw error;
    }
  }

  async getCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      return campaign;
    } catch (error) {
      logger.error(`Error fetching campaign ${campaignId}:`, error);
      throw error;
    }
  }

  async stopTest(campaignId) {
    try {
      const campaign = await this.getCampaign(campaignId);
      
      // Pause all variants
      for (const variant of campaign.variants) {
        if (variant.adIds.facebook) {
          await this.makeApiRequest(
            `${this.metaAdsUrl}/campaigns/${variant.adIds.facebook}/pause`,
            'post'
          );
        }
        
        if (variant.adIds.google) {
          await this.makeApiRequest(
            `${this.googleAdsUrl}/campaigns/${variant.adIds.google}/pause`,
            'post'
          );
        }
        
        variant.status = 'paused';
      }

      // Update campaign status
      campaign.status = 'paused';
      campaign.endDate = new Date();
      await campaign.save();

      logger.info(`Successfully stopped campaign ${campaignId}`);
      return campaign;
    } catch (error) {
      logger.error(`Error stopping campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

module.exports = new TestEngine(); 