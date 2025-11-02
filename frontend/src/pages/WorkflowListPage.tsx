import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { getWorkflows, deleteWorkflow } from '../api/workflows';
import type { WorkflowResponse } from '../types/workflows';

const WorkflowListPage = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEnabled, setFilterEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    console.log('📋 [WorkflowListPage] Component mounted', { isInitializing, isAuthenticated, filterEnabled });
    if (!isInitializing && !isAuthenticated) {
      console.log('📋 [WorkflowListPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (isAuthenticated) {
      console.log('📋 [WorkflowListPage] Authenticated, fetching workflows');
      fetchWorkflows();
    }
  }, [isAuthenticated, isInitializing, navigate, filterEnabled]);

  const fetchWorkflows = async () => {
    console.log('📋 [WorkflowListPage] fetchWorkflows() called', { filterEnabled });
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorkflows(filterEnabled);
      console.log('📋 [WorkflowListPage] Workflows fetched', { count: data.length });
      setWorkflows(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
      console.error('❌ [WorkflowListPage] Error fetching workflows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    console.log('📋 [WorkflowListPage] handleDelete() called', { workflowId: id });
    if (!window.confirm('Are you sure you want to delete this workflow?')) {
      console.log('📋 [WorkflowListPage] Delete cancelled by user');
      return;
    }

    try {
      await deleteWorkflow(id);
      console.log('✅ [WorkflowListPage] Workflow deleted', { workflowId: id });
      setWorkflows(workflows.filter((w) => w.id !== id));
    } catch (err: any) {
      console.error('❌ [WorkflowListPage] Error deleting workflow:', err);
      setError(err.message || 'Failed to delete workflow');
    }
  };

  const handleExecute = async (id: number) => {
    console.log('📋 [WorkflowListPage] handleExecute() called', { workflowId: id });
    try {
      console.log('📋 [WorkflowListPage] Navigating to execute page');
      navigate(`/workflows/${id}/execute`);
    } catch (err: any) {
      console.error('❌ [WorkflowListPage] Error navigating to execute:', err);
      setError(err.message || 'Failed to execute workflow');
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Workflows</h1>
          <button
            onClick={() => navigate('/workflows/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Workflow
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-4">
          <button
            onClick={() => setFilterEnabled(undefined)}
            className={`px-4 py-2 rounded ${
              filterEnabled === undefined ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterEnabled(true)}
            className={`px-4 py-2 rounded ${
              filterEnabled === true ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            Enabled
          </button>
          <button
            onClick={() => setFilterEnabled(false)}
            className={`px-4 py-2 rounded ${
              filterEnabled === false ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            Disabled
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="text-lg">Loading workflows...</div>
          </div>
        )}

        {/* Workflows List */}
        {!isLoading && workflows.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No workflows found.</p>
            <button
              onClick={() => navigate('/workflows/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Your First Workflow
            </button>
          </div>
        )}

        {!isLoading && workflows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-semibold">{workflow.name}</h3>
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

                <div className="text-sm text-gray-500 mb-3">
                  <div>Trigger: {workflow.trigger?.type || 'N/A'}</div>
                  <div>Actions: {workflow.actions.length}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleExecute(workflow.id)}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
                    disabled={!workflow.enabled}
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowListPage;

