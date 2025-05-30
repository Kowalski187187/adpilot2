import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function NewCampaign() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    campaignName: '',
    adsetName: '',
    adName: '',
    budgetPerDay: '',
    durationDays: '7',
    targeting: {
      locations: ['NO'],
      ageRange: {
        min: 18,
        max: 65
      },
      interests: []
    },
    creative: {
      imageUrl: '',
      text: '',
      productId: ''
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/campaigns', formData);
      navigate('/');
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Feil ved opprettelse av kampanje. Vennligst prøv igjen.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Opprett ny kampanje</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Kampanje</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kampanjenavn</label>
              <input
                type="text"
                name="campaignName"
                value={formData.campaignName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Ad Set Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Ad Set</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ad Set Navn</label>
              <input
                type="text"
                name="adsetName"
                value={formData.adsetName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Daglig budsjett (NOK)</label>
              <input
                type="number"
                name="budgetPerDay"
                value={formData.budgetPerDay}
                onChange={handleChange}
                min="0"
                step="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Varighet (dager)</label>
              <input
                type="number"
                name="durationDays"
                value={formData.durationDays}
                onChange={handleChange}
                min="1"
                max="365"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Ad Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Annonse</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Annonsenavn</label>
              <input
                type="text"
                name="adName"
                value={formData.adName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bildelenke</label>
              <input
                type="url"
                name="creative.imageUrl"
                value={formData.creative.imageUrl}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Annonsetekst</label>
              <textarea
                name="creative.text"
                value={formData.creative.text}
                onChange={handleChange}
                rows="3"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Produkt ID</label>
              <input
                type="text"
                name="creative.productId"
                value={formData.creative.productId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Opprett kampanje
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewCampaign; 