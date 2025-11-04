import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const IntegrationsPage = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔌 [IntegrationsPage] Component mounted', { isInitializing, isAuthenticated });
    if (!isInitializing && !isAuthenticated) {
      console.log('🔌 [IntegrationsPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }
  }, [isAuthenticated, isInitializing, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-2">
            Connect your favorite services to automate your workflows
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for future integrations */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 opacity-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">📧</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Gmail</h3>
                <p className="text-sm text-gray-500">Coming soon</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Email integration for triggering workflows from incoming emails.
            </p>
            <button disabled className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;

