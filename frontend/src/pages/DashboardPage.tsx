import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkflows, getExecutionHistory } from '../api/workflows';
import { connectGoogle, disconnectGoogle } from '../api/auth';
import type { WorkflowResponse, ExecutionResponse, WorkflowStatus } from '../types/workflows';

const DashboardPage = () => {
  const { user, isAuthenticated, isInitializing, accessToken, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [executions, setExecutions] = useState<ExecutionResponse[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Handle OAuth callback messages FIRST (before loading data)
  useEffect(() => {
    const googleConnected = searchParams.get('googleConnected');
    const googleErrorParam = searchParams.get('googleError');

    if (googleConnected === 'true') {
      setGoogleMessage('Google account connected successfully!');
      setGoogleError(null);
      // Clear the URL parameter
      setSearchParams({});
      // Refresh user data to get updated googleLinked status (instead of reloading)
      if (accessToken && refreshUser) {
        refreshUser().catch(err => {
          console.error('Failed to refresh user after Google connection:', err);
        });
      }
    }

    if (googleErrorParam) {
      setGoogleError(decodeURIComponent(googleErrorParam));
      setGoogleMessage(null);
      // Clear the URL parameter
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, accessToken, refreshUser]);

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
        // Load workflows and executions when authenticated
        console.log('📊 [DashboardPage] Authenticated, loading workflows and executions');
        loadWorkflows();
        loadExecutions();
      }
    }
  }, [isAuthenticated, isInitializing, navigate, searchParams]);

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

  const loadExecutions = async () => {
    console.log('📊 [DashboardPage] loadExecutions() called');
    try {
      setIsLoadingExecutions(true);
      const data = await getExecutionHistory(10); // Show last 10 executions
      console.log('📊 [DashboardPage] Executions loaded', { count: data.length });
      setExecutions(data);
    } catch (err) {
      console.error('❌ [DashboardPage] Failed to load executions:', err);
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  const getStatusBadgeClass = (status: WorkflowStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleConnectGoogle = async () => {
    if (!accessToken) return;
    
    setGoogleConnecting(true);
    setGoogleError(null);
    setGoogleMessage(null);
    
    try {
      await connectGoogle(accessToken);
      // The redirect will happen, so we don't need to do anything else
    } catch (err: any) {
      console.error('Failed to connect Google:', err);
      setGoogleError(err.message || 'Failed to connect Google account');
      setGoogleConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!accessToken) return;
    
    setGoogleDisconnecting(true);
    setGoogleError(null);
    setGoogleMessage(null);
    
    try {
      await disconnectGoogle(accessToken);
      setGoogleMessage('Google account disconnected successfully');
      // Refresh user data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to disconnect Google:', err);
      setGoogleError(err.message || 'Failed to disconnect Google account');
      setGoogleDisconnecting(false);
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

        {/* Google Connection Status */}
        <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Google Account</h3>
          
          {googleMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
              {googleMessage}
            </div>
          )}
          
          {googleError && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
              {googleError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 mb-2">
                Status: <span className={`font-semibold ${user?.googleLinked ? 'text-green-600' : 'text-gray-500'}`}>
                  {user?.googleLinked ? '✓ Connected' : 'Not Connected'}
                </span>
              </p>
              <p className="text-sm text-gray-500">
                {user?.googleLinked 
                  ? 'Your Google account is connected. You can use Gmail and Calendar actions in your workflows.'
                  : 'Connect your Google account to enable Gmail and Calendar actions in your workflows.'}
              </p>
            </div>
            
            <div className="flex gap-2">
              {user?.googleLinked ? (
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={googleDisconnecting}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {googleDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={googleConnecting || !accessToken}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {googleConnecting ? 'Connecting...' : 'Connect with Google'}
                </button>
              )}
            </div>
          </div>
        </div>

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

        {/* Execution History */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Execution History</h3>
            {executions.length > 0 && (
              <Link to="/workflows" className="text-blue-600 hover:text-blue-800 text-sm">
                View all →
              </Link>
            )}
          </div>

          {isLoadingExecutions && (
            <div className="text-center py-8">
              <div className="text-gray-600">Loading execution history...</div>
            </div>
          )}

          {!isLoadingExecutions && executions.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">No executions yet.</p>
              <p className="text-gray-500 text-sm mt-2">Execute a workflow to see execution history here.</p>
            </div>
          )}

          {!isLoadingExecutions && executions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Steps
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {executions.map((execution) => (
                    <tr key={execution.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.workflow?.name || `Workflow #${execution.workflowId}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            execution.status
                          )}`}
                        >
                          {execution.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(execution.startedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(execution.completedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {execution.executionSteps?.length || 0} steps
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/workflows/${execution.workflowId}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Workflow
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage
