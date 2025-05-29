import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';

function CampaignList() {
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns', selectedPeriod],
    queryFn: async () => {
      const response = await axios.get(`/campaigns?period=${selectedPeriod}`);
      return response.data;
    }
  });

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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kampanje</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budsjett</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Startdato</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sluttdato</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Kostnad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Konverteringer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Klikk</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Visninger</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Detaljer</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns?.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="mr-2">{getPlatformIcon(campaign.platform)}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-sm text-gray-500">ID: {campaign.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(campaign.budgetPerDay)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatDate(campaign.startDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatDate(campaign.endDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {formatCurrency(campaign.spend)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex flex-col items-end">
                    <span className={`${getRoasColor(campaign.results?.overallRoas)}`}>
                      {formatRoas(campaign.results?.overallRoas)}
                    </span>
                    <div className="text-xs text-gray-500">
                      <span className={getRoasColor(campaign.results?.roasA)}>A: {formatRoas(campaign.results?.roasA)}</span>
                      {' | '}
                      <span className={getRoasColor(campaign.results?.roasB)}>B: {formatRoas(campaign.results?.roasB)}</span>
                    </div>
                  </div>
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/campaigns/${campaign.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Se detaljer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CampaignList; 