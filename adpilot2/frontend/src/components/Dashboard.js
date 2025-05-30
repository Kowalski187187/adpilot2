import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const dummyStats = {
  activeCampaigns: 2,
  totalSpend: 4300,
  averageROAS: 3.0
};

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      try {
        const response = await axios.get('/stats');
        if (response.status === 200 && typeof response.data === 'object') {
          return response.data;
        } else {
          return dummyStats;
        }
      } catch (error) {
        return dummyStats;
      }
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Active Campaigns Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Campaigns
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.activeCampaigns || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Spend Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Spend
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${stats?.totalSpend || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* ROAS Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Average ROAS
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.averageROAS || 0}x
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 