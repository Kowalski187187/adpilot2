const bizSdk = require('facebook-nodejs-business-sdk');
const logger = require('../utils/logger');
const config = require('../config');
const moment = require('moment');

class MetaAdsService {
  constructor() {
    this.api = bizSdk.FacebookAdsApi.init(config.facebook.accessToken);
    this.account = new bizSdk.AdAccount(config.facebook.adAccountId);
    this.currency = config.facebook.currency;
  }

  async createCampaign(campaignData) {
    try {
      logger.info('Creating Facebook campaign:', campaignData);

      // Create campaign
      const campaign = await this.account.createCampaign(
        [],
        {
          name: campaignData.campaignName,
          objective: bizSdk.Campaign.Objective.VALUE_CONVERSIONS,
          status: bizSdk.Campaign.Status.ACTIVE,
          currency: this.currency
        }
      );

      // Create ad set
      const adSet = await campaign.createAdSet(
        [],
        {
          name: campaignData.adsetName,
          optimization_goal: bizSdk.AdSet.OptimizationGoal.VALUE_CONVERSIONS,
          billing_event: bizSdk.AdSet.BillingEvent.VALUE_IMPRESSIONS,
          bid_amount: 2000, // 20.00 in account currency
          daily_budget: campaignData.budgetPerDay * 100, // Convert to cents
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + campaignData.durationDays * 24 * 60 * 60 * 1000).toISOString(),
          targeting: {
            geo_locations: {
              countries: campaignData.targeting.locations || ['NO']
            },
            age_min: campaignData.targeting.ageRange?.min || 18,
            age_max: campaignData.targeting.ageRange?.max || 65,
            interests: campaignData.targeting.interests || []
          }
        }
      );

      // Create ad
      const ad = await adSet.createAd(
        [],
        {
          name: campaignData.adName,
          creative: {
            object_story_spec: {
              page_id: config.facebook.pageId,
              link_data: {
                image_url: campaignData.creative.imageUrl,
                link: `https://your-shop.myshopify.com/products/${campaignData.productId}`,
                message: campaignData.creative.text
              }
            }
          }
        }
      );

      logger.info('Successfully created Facebook campaign:', {
        campaignId: campaign.id,
        adSetId: adSet.id,
        adId: ad.id
      });

      return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        adId: ad.id,
        status: 'ACTIVE'
      };
    } catch (error) {
      logger.error('Error creating Facebook campaign:', error);
      throw error;
    }
  }

  async getCampaignInsights(campaignId, period = '1d') {
    try {
      logger.info('Fetching insights for campaign:', campaignId);

      const timeRange = this.getTimeRange(period);
      const campaign = new bizSdk.Campaign(campaignId);
      const insights = await campaign.getInsights(
        ['spend', 'impressions', 'clicks', 'actions'],
        {
          time_range: timeRange
        }
      );

      const stats = insights[0] || {};
      const actions = stats.actions || [];
      const purchaseValue = actions.find(a => a.action_type === 'purchase')?.value || 0;
      
      logger.info('Successfully fetched campaign insights:', stats);

      return {
        campaignId,
        spend: parseFloat(stats.spend || 0),
        impressions: parseInt(stats.impressions || 0),
        clicks: parseInt(stats.clicks || 0),
        conversions: parseInt(purchaseValue),
        roas: parseFloat(stats.spend || 0) > 0 ? parseFloat(purchaseValue) / parseFloat(stats.spend) : 0
      };
    } catch (error) {
      logger.error('Error fetching campaign insights:', error);
      throw error;
    }
  }

  getTimeRange(period) {
    const now = moment();
    let since;

    switch (period) {
      case '3d':
        since = now.clone().subtract(3, 'days');
        break;
      case '7d':
        since = now.clone().subtract(7, 'days');
        break;
      case '14d':
        since = now.clone().subtract(14, 'days');
        break;
      case '30d':
        since = now.clone().subtract(30, 'days');
        break;
      default:
        since = now.clone().subtract(1, 'day');
    }

    return {
      since: since.format('YYYY-MM-DD'),
      until: now.format('YYYY-MM-DD')
    };
  }

  calculateROAS(spend, actions) {
    const purchaseValue = actions.find(a => a.action_type === 'purchase_value')?.value || 0;
    return spend > 0 ? purchaseValue / spend : 0;
  }

  async pauseCampaign(campaignId) {
    try {
      logger.info('Pausing campaign:', campaignId);

      const campaign = new bizSdk.Campaign(campaignId);
      await campaign.update({
        status: bizSdk.Campaign.Status.PAUSED
      });

      logger.info('Successfully paused campaign:', campaignId);
      return { status: 'PAUSED' };
    } catch (error) {
      logger.error('Error pausing campaign:', error);
      throw error;
    }
  }

  async getAllCampaigns(period = '1d') {
    try {
      const campaigns = await this.account.getCampaigns(['id', 'name', 'status', 'objective']);
      const timeRange = this.getTimeRange(period);
      
      const campaignsWithInsights = await Promise.all(
        campaigns.map(async (campaign) => {
          // Get campaign insights
          const insights = await campaign.getInsights(
            ['spend', 'impressions', 'clicks', 'actions', 'action_values'],
            { time_range: timeRange }
          );
          
          const campaignData = campaign._data;
          let totalSpend = 0;
          let totalImpressions = 0;
          let totalClicks = 0;
          let totalConversions = 0;
          let totalPurchaseValue = 0;

          insights.forEach(insight => {
            totalSpend += parseFloat(insight.spend || 0);
            totalImpressions += parseInt(insight.impressions || 0);
            totalClicks += parseInt(insight.clicks || 0);
            const actions = insight.actions || [];
            const actionValues = insight.action_values || [];
            const purchaseAction = actions.find(a => a.action_type === 'purchase');
            totalConversions += purchaseAction?.value ? parseInt(purchaseAction.value) : 0;
            const purchaseValueAction = actionValues.find(a => a.action_type === 'purchase');
            if (purchaseValueAction?.value) {
              totalPurchaseValue += parseFloat(purchaseValueAction.value);
            }
          });

          // Get ad sets for this campaign
          const adSets = await campaign.getAdSets(['id', 'name', 'status', 'daily_budget', 'bid_amount']);
          logger.info(`Campaign ${campaign.id} - found ${adSets.length} ad sets`);
          const adSetsWithInsights = await Promise.all(
            adSets.map(async (adSet) => {
              const adSetInsights = await adSet.getInsights(
                ['spend', 'impressions', 'clicks', 'actions', 'action_values'],
                { time_range: timeRange }
              );

              let adSetSpend = 0;
              let adSetImpressions = 0;
              let adSetClicks = 0;
              let adSetConversions = 0;
              let adSetPurchaseValue = 0;

              adSetInsights.forEach(insight => {
                adSetSpend += parseFloat(insight.spend || 0);
                adSetImpressions += parseInt(insight.impressions || 0);
                adSetClicks += parseInt(insight.clicks || 0);
                const actions = insight.actions || [];
                const actionValues = insight.action_values || [];
                const purchaseAction = actions.find(a => a.action_type === 'purchase');
                adSetConversions += purchaseAction?.value ? parseInt(purchaseAction.value) : 0;
                const purchaseValueAction = actionValues.find(a => a.action_type === 'purchase');
                if (purchaseValueAction?.value) {
                  adSetPurchaseValue += parseFloat(purchaseValueAction.value);
                }
              });

              // Get ads for this ad set
              const ads = await adSet.getAds(['id', 'name', 'status', 'creative']);
              logger.info(`Ad set ${adSet.id} - found ${ads.length} ads`);
              const adsWithInsights = await Promise.all(
                ads.map(async (ad) => {
                  const adInsights = await ad.getInsights(
                    ['spend', 'impressions', 'clicks', 'actions', 'action_values'],
                    { time_range: timeRange }
                  );

                  let adSpend = 0;
                  let adImpressions = 0;
                  let adClicks = 0;
                  let adConversions = 0;
                  let adPurchaseValue = 0;

                  adInsights.forEach(insight => {
                    adSpend += parseFloat(insight.spend || 0);
                    adImpressions += parseInt(insight.impressions || 0);
                    adClicks += parseInt(insight.clicks || 0);
                    const actions = insight.actions || [];
                    const actionValues = insight.action_values || [];
                    const purchaseAction = actions.find(a => a.action_type === 'purchase');
                    adConversions += purchaseAction?.value ? parseInt(purchaseAction.value) : 0;
                    const purchaseValueAction = actionValues.find(a => a.action_type === 'purchase');
                    if (purchaseValueAction?.value) {
                      adPurchaseValue += parseFloat(purchaseValueAction.value);
                    }
                  });

                  return {
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    creative: ad.creative,
                    spend: adSpend,
                    impressions: adImpressions,
                    clicks: adClicks,
                    conversions: adConversions,
                    roas: adSpend > 0 ? adPurchaseValue / adSpend : 0
                  };
                })
              );

              return {
                id: adSet.id,
                name: adSet.name,
                status: adSet.status,
                dailyBudget: adSet.daily_budget / 100,
                bidAmount: adSet.bid_amount / 100,
                spend: adSetSpend,
                impressions: adSetImpressions,
                clicks: adSetClicks,
                conversions: adSetConversions,
                roas: adSetSpend > 0 ? adSetPurchaseValue / adSetSpend : 0,
                ads: adsWithInsights
              };
            })
          );

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
            conversions: totalConversions,
            roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
            adSets: adSetsWithInsights
          };
        })
      );

      return campaignsWithInsights;
    } catch (error) {
      logger.error('Error fetching campaigns:', error);
      throw error;
    }
  }
}

module.exports = MetaAdsService; 