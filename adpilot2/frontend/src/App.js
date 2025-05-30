import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CampaignTabs from './components/CampaignTabs';
import NewCampaign from './components/NewCampaign';

// Components
import Dashboard from './components/Dashboard';
import CampaignList from './components/CampaignList';
import CampaignCreate from './components/CampaignCreate';
import Navbar from './components/Navbar';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/campaigns" element={<CampaignTabs />} />
              <Route path="/campaigns/new" element={<NewCampaign />} />
              <Route path="/campaigns/create" element={<CampaignCreate />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 