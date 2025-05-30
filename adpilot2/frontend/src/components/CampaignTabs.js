import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { dummyCampaigns } from '../data/dummyCampaigns';

function CampaignTabs() {
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [activeTab, setActiveTab] = useState('campaigns');
  
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', selectedPeriod],
    queryFn: async () => {
      try {
        const response = await axios.get(`http://localhost:3001/campaigns?period=${selectedPeriod}`);
        if (response.status === 200 && Array.isArray(response.data)) {
          return response.data;
        } else {
          return dummyCampaigns;
        }
      } catch (error) {
        return dummyCampaigns;
      }
    }
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoasColor = (roas) => {
    if (!roas || isNaN(roas)) return 'text-gray-500';
    if (roas >= 4) return 'text-green-600 font-semibold';
    if (roas >= 2) return 'text-green-500 font-semibold';
    if (roas >= 1) return 'text-yellow-500 font-semibold';
    return 'text-red-500 font-semibold';
  };

  const formatRoas = (roas) => {
    if (!roas || isNaN(roas)) return '-';
    return `${roas.toFixed(2)}x`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('no-NO').format(num);
  };

  if (isLoading) return <div className="text-center py-8">Laster data...</div>;

  // Flatten data for ad sets and ads tabs
  const allAdSets = campaigns?.flatMap(campaign => 
    campaign.adSets?.map(adSet => ({
      ...adSet,
      campaignName: campaign.name,
      campaignId: campaign.id
    })) || []
  );

  const allAds = campaigns?.flatMap(campaign => 
    campaign.adSets?.flatMap(adSet => 
      adSet.ads?.map(ad => ({
        ...ad,
        campaignName: campaign.name,
        campaignId: campaign.id,
        adSetName: adSet.name,
        adSetId: adSet.id
      })) || []
    ) || []
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {activeTab === 'campaigns' && 'Kampanjer'}
          {activeTab === 'adsets' && 'Ad Sets'}
          {activeTab === 'ads' && 'Annonser'}
        </h1>
        <div className="flex items-center space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1d">Siste 24 timer</option>
            <option value="3d">Siste 3 dager</option>
            <option value="7d">Siste 7 dager</option>
            <option value="14d">Siste 14 dager</option>
            <option value="30d">Siste 30 dager</option>
          </select>
          <Link
            to="/campaigns/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Opprett kampanje
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`${
              activeTab === 'campaigns'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Kampanjer ({campaigns?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('adsets')}
            className={`${
              activeTab === 'adsets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Ad Sets ({allAdSets?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('ads')}
            className={`${
              activeTab === 'ads'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Annonser ({allAds?.length || 0})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Navn</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budsjett</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Kostnad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Konverteringer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Klikk</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Visninger</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activeTab === 'campaigns' && campaigns?.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-sm text-gray-500">Kampanje</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(campaign.spend)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={getRoasColor(campaign.roas)}>
                    {formatRoas(campaign.roas)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(campaign.conversions)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(campaign.clicks)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(campaign.impressions)}
                </td>
              </tr>
            ))}

            {activeTab === 'adsets' && allAdSets?.map((adSet) => (
              <tr key={adSet.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{adSet.name}</div>
                    <div className="text-sm text-gray-500">
                      {adSet.campaignName} • Ad Set
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(adSet.status)}`}>
                    {adSet.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(adSet.dailyBudget)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(adSet.spend)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={getRoasColor(adSet.roas)}>
                    {formatRoas(adSet.roas)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(adSet.conversions)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(adSet.clicks)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(adSet.impressions)}
                </td>
              </tr>
            ))}

            {activeTab === 'ads' && allAds?.map((ad) => (
              <tr key={ad.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{ad.name}</div>
                    <div className="text-sm text-gray-500">
                      {ad.campaignName} • {ad.adSetName} • Ad
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ad.status)}`}>
                    {ad.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(ad.spend)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={getRoasColor(ad.roas)}>
                    {formatRoas(ad.roas)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(ad.conversions)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(ad.clicks)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatNumber(ad.impressions)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CampaignTabs; 