import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkflows } from '../api/workflows';
import type { WorkflowResponse } from '../types/workflows';

const DashboardPage = () => {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  useEffect(() => {
    console.log('📊 [DashboardPage] Component mounted', { isInitializing, isAuthenticated });
    // 1. Wait until initialization is complete
    if (!isInitializing) {
      // 2. Only check authentication status AFTER initialization is done
      if (!isAuthenticated) {
        console.log('📊 [DashboardPage] Not authenticated, redirecting to login');
        // Redirect to the login page and replace history entry
        navigate('/login', { replace: true });
      } else {
        // Load workflows when authenticated
        console.log('📊 [DashboardPage] Authenticated, loading workflows');
        loadWorkflows();
      }
    }
  }, [isAuthenticated, isInitializing, navigate]);

  const loadWorkflows = async () => {
    console.log('📊 [DashboardPage] loadWorkflows() called');
    try {
      setIsLoadingWorkflows(true);
      const data = await getWorkflows();
      console.log('📊 [DashboardPage] Workflows loaded', { count: data.length });
      setWorkflows(data.slice(0, 5)); // Show only first 5 on dashboard
    } catch (err) {
      console.error('❌ [DashboardPage] Failed to load workflows:', err);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">
          {user?.name ? `Welcome, ${user.name}!` : 'Welcome!'}
        </h2>
        <p className="text-gray-600 mb-6">
          {user ? 'You are logged in 🎉' : ''}
        </p>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="flex gap-4">
            <Link
              to="/workflows/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create Workflow
            </Link>
            <Link
              to="/workflows"
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
            >
              View All Workflows
            </Link>
          </div>
        </div>

        {/* Recent Workflows */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Recent Workflows</h3>
            {workflows.length > 0 && (
              <Link to="/workflows" className="text-blue-600 hover:text-blue-800 text-sm">
                View all →
              </Link>
            )}
          </div>

          {isLoadingWorkflows && (
            <div className="text-center py-8">
              <div className="text-gray-600">Loading workflows...</div>
            </div>
          )}

          {!isLoadingWorkflows && workflows.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">You don't have any workflows yet.</p>
              <Link
                to="/workflows/new"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Create Your First Workflow
              </Link>
            </div>
          )}

          {!isLoadingWorkflows && workflows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-semibold">{workflow.name}</h4>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        workflow.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {workflow.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-gray-600 text-sm mb-3">{workflow.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Link
                      to={`/workflows/${workflow.id}`}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm text-center hover:bg-blue-700"
                    >
                      Edit
                    </Link>
                    <Link
                      to={`/workflows/${workflow.id}/execute`}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm text-center hover:bg-green-700"
                    >
                      Run
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage
