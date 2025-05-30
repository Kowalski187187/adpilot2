import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function CampaignCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    budget: '',
    platform: 'meta',
    objective: 'conversions',
    targetAudience: '',
    startDate: '',
    endDate: '',
    // Meta Ads specific fields
    adFormat: 'image',
    adPlacement: ['facebook', 'instagram'],
    targeting: {
      ageRange: ['18-24', '25-34', '35-44'],
      gender: ['all'],
      locations: [],
      interests: []
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('targeting.')) {
      const targetingField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        targeting: {
          ...prev.targeting,
          [targetingField]: value.split(',').map(v => v.trim())
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (formData.platform === 'meta') {
        // Call Meta Ads service
        const response = await axios.post('http://localhost:3001/campaigns', {
          name: formData.name,
          daily_budget: parseFloat(formData.budget),
          objective: formData.objective,
          start_time: new Date(formData.startDate).toISOString(),
          end_time: new Date(formData.endDate).toISOString(),
          targeting: formData.targeting,
          ad_format: formData.adFormat,
          ad_placement: formData.adPlacement
        });
        
        // Store campaign ID in orchestrator
        await axios.post('/api/campaigns', {
          ...formData,
          metaCampaignId: response.data.id
        });
      } else {
        // Handle other platforms
        await axios.post('/api/campaigns', formData);
      }
      
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Create New Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Campaign Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
            Daily Budget ($)
          </label>
          <input
            type="number"
            name="budget"
            id="budget"
            required
            min="1"
            value={formData.budget}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700">
            Platform
          </label>
          <select
            name="platform"
            id="platform"
            required
            value={formData.platform}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="meta">Meta (Facebook/Instagram)</option>
            <option value="google">Google Ads</option>
          </select>
        </div>

        {formData.platform === 'meta' && (
          <>
            <div>
              <label htmlFor="adFormat" className="block text-sm font-medium text-gray-700">
                Ad Format
              </label>
              <select
                name="adFormat"
                id="adFormat"
                required
                value={formData.adFormat}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>

            <div>
              <label htmlFor="adPlacement" className="block text-sm font-medium text-gray-700">
                Ad Placement
              </label>
              <select
                name="adPlacement"
                id="adPlacement"
                multiple
                required
                value={formData.adPlacement}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="audience_network">Audience Network</option>
              </select>
            </div>

            <div>
              <label htmlFor="targeting.ageRange" className="block text-sm font-medium text-gray-700">
                Age Range (comma-separated)
              </label>
              <input
                type="text"
                name="targeting.ageRange"
                id="targeting.ageRange"
                required
                value={formData.targeting.ageRange.join(', ')}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="18-24, 25-34, 35-44"
              />
            </div>

            <div>
              <label htmlFor="targeting.gender" className="block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                name="targeting.gender"
                id="targeting.gender"
                required
                value={formData.targeting.gender}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label htmlFor="objective" className="block text-sm font-medium text-gray-700">
            Campaign Objective
          </label>
          <select
            name="objective"
            id="objective"
            required
            value={formData.objective}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="conversions">Conversions</option>
            <option value="traffic">Traffic</option>
            <option value="awareness">Brand Awareness</option>
          </select>
        </div>

        <div>
          <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700">
            Target Audience Description
          </label>
          <textarea
            name="targetAudience"
            id="targetAudience"
            rows="3"
            required
            value={formData.targetAudience}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Describe your target audience..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              id="startDate"
              required
              value={formData.startDate}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              id="endDate"
              required
              value={formData.endDate}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isSubmitting ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CampaignCreate; 