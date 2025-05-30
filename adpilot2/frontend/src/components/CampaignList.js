import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

function CampaignList() {
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState(new Set());
  
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns', selectedPeriod],
    queryFn: async () => {
      const response = await axios.get(`http://localhost:3001/campaigns?period=${selectedPeriod}`);
      return response.data;
    }
  });

  const toggleCampaign = (campaignId) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  const toggleAdSet = (adSetId) => {
    const newExpanded = new Set(expandedAdSets);
    if (newExpanded.has(adSetId)) {
      newExpanded.delete(adSetId);
    } else {
      newExpanded.add(adSetId);
    }
    setExpandedAdSets(newExpanded);
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'meta':
        return '📱';
      case 'google':
        return '🔍';
      default:
        return '📊';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
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

  // Hjelpefunksjon for valuta
  const getCurrencySymbol = (currency) => {
    if (!currency) return 'kr';
    if (currency === 'NOK') return 'kr';
    if (currency === 'USD') return '$';
    if (currency === 'EUR') return '€';
    return currency;
  };

  // Hjelpefunksjon for ROAS farge
  const getRoasColor = (roas) => {
    if (!roas || isNaN(roas)) return 'text-gray-500';
    if (roas >= 4) return 'text-green-600 font-semibold';
    if (roas >= 2) return 'text-green-500 font-semibold';
    if (roas >= 1) return 'text-yellow-500 font-semibold';
    return 'text-red-500 font-semibold';
  };

  // Hjelpefunksjon for ROAS formatering
  const formatRoas = (roas) => {
    if (!roas || isNaN(roas)) return '-';
    return `${roas.toFixed(2)}x`;
  };

  // Hjelpefunksjon for datoformat
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('no-NO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatCurrency = (amount, currency = 'NOK') => {
    const formatter = new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return formatter.format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('no-NO').format(num);
  };

  const getROASColor = (roas) => {
    if (roas >= 4) return 'text-green-600';
    if (roas >= 2) return 'text-green-500';
    if (roas >= 1) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) return <div className="text-center py-8">Laster kampanjer...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Feil ved lasting av kampanjer</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kampanjer</h1>
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
            {campaigns?.map((campaign) => (
              <React.Fragment key={campaign.id}>
                {/* Campaign Row */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleCampaign(campaign.id)}
                        className="mr-2 text-gray-500 hover:text-gray-700"
                      >
                        {expandedCampaigns.has(campaign.id) ? (
                          <ChevronDownIcon className="h-5 w-5" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5" />
                        )}
                      </button>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-sm text-gray-500">Kampanje</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    -
                  </td>
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

                {/* Ad Sets */}
                {expandedCampaigns.has(campaign.id) && campaign.adSets?.map((adSet) => (
                  <React.Fragment key={adSet.id}>
                    <tr className="bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center pl-8">
                          <button
                            onClick={() => toggleAdSet(adSet.id)}
                            className="mr-2 text-gray-500 hover:text-gray-700"
                          >
                            {expandedAdSets.has(adSet.id) ? (
                              <ChevronDownIcon className="h-5 w-5" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5" />
                            )}
                          </button>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{adSet.name}</div>
                            <div className="text-sm text-gray-500">Ad Set</div>
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

                    {/* Ads */}
                    {expandedAdSets.has(adSet.id) && adSet.ads?.map((ad) => (
                      <tr key={ad.id} className="bg-gray-100 hover:bg-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center pl-16">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{ad.name}</div>
                              <div className="text-sm text-gray-500">Ad</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ad.status)}`}>
                            {ad.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                          -
                        </td>
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
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CampaignList; 