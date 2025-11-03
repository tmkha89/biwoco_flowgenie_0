import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { getWorkflowById, executeWorkflow, getExecutionById } from '../api/workflows';
import type { WorkflowResponse, ExecutionResponse } from '../types/workflows';

const WorkflowRunPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [execution, setExecution] = useState<ExecutionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerData, setTriggerData] = useState<string>('{}');

  useEffect(() => {
    console.log('▶️ [WorkflowRunPage] Component mounted', { isInitializing, isAuthenticated, workflowId: id });
    if (!isInitializing && !isAuthenticated) {
      console.log('▶️ [WorkflowRunPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (id) {
      console.log('▶️ [WorkflowRunPage] Fetching workflow', { workflowId: id });
      fetchWorkflow(parseInt(id));
    }
  }, [isAuthenticated, isInitializing, navigate, id]);

  const fetchWorkflow = async (workflowId: number) => {
    console.log('▶️ [WorkflowRunPage] fetchWorkflow() called', { workflowId });
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorkflowById(workflowId);
      console.log('▶️ [WorkflowRunPage] Workflow fetched', { id: data.id, name: data.name, enabled: data.enabled });
      setWorkflow(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow');
      console.error('❌ [WorkflowRunPage] Error fetching workflow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    console.log('▶️ [WorkflowRunPage] handleExecute() called', { workflowId: workflow?.id, hasTriggerData: !!triggerData.trim() });
    if (!workflow) {
      console.error('❌ [WorkflowRunPage] Cannot execute: workflow not loaded');
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);

      let parsedTriggerData: Record<string, any> | undefined;
      if (triggerData.trim()) {
        try {
          parsedTriggerData = JSON.parse(triggerData);
          console.log('▶️ [WorkflowRunPage] Trigger data parsed', parsedTriggerData);
        } catch {
          throw new Error('Invalid JSON in trigger data');
        }
      }

      console.log('▶️ [WorkflowRunPage] Executing workflow...');
      const executionResult = await executeWorkflow(workflow.id, parsedTriggerData);
      console.log('▶️ [WorkflowRunPage] Workflow execution started', { executionId: executionResult.id, status: executionResult.status });
      setExecution(executionResult);

      // Poll for execution status if it's still running
      if (executionResult.status === 'pending' || executionResult.status === 'running') {
        console.log('▶️ [WorkflowRunPage] Starting status polling', { executionId: executionResult.id });
        pollExecutionStatus(executionResult.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute workflow');
      console.error('❌ [WorkflowRunPage] Error executing workflow:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const pollExecutionStatus = async (executionId: number) => {
    console.log('▶️ [WorkflowRunPage] pollExecutionStatus() started', { executionId });
    const maxAttempts = 30;
    let attempts = 0;

    const poll = setInterval(async () => {
      try {
        attempts++;
        console.log(`▶️ [WorkflowRunPage] Polling execution status (attempt ${attempts}/${maxAttempts})`, { executionId });
        const updatedExecution = await getExecutionById(executionId);
        console.log('▶️ [WorkflowRunPage] Execution status updated', { status: updatedExecution.status });
        setExecution(updatedExecution);

        if (
          updatedExecution.status === 'completed' ||
          updatedExecution.status === 'failed' ||
          updatedExecution.status === 'cancelled'
        ) {
          console.log('▶️ [WorkflowRunPage] Execution finished', { status: updatedExecution.status });
          clearInterval(poll);
        }

        if (attempts >= maxAttempts) {
          console.log('▶️ [WorkflowRunPage] Max polling attempts reached, stopping');
          clearInterval(poll);
        }
      } catch (err) {
        clearInterval(poll);
        console.error('❌ [WorkflowRunPage] Error polling execution status:', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  if (isInitializing || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div>
        <Navbar />
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Workflow not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-gray-600 mt-1">{workflow.description}</p>
            )}
          </div>
          <button
            onClick={() => navigate('/workflows')}
            className="text-gray-600 hover:text-gray-800"
          >
            Back to Workflows
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Workflow Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Workflow Details</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Status:</span>{' '}
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
            <div>
              <span className="font-medium">Trigger:</span> {workflow.trigger?.type || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Actions:</span> {workflow.actions.length}
            </div>
          </div>
        </div>

        {/* Execution Form */}
        {workflow.enabled && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Execute Workflow</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Data (JSON, optional)
              </label>
              <textarea
                value={triggerData}
                onChange={(e) => setTriggerData(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm"
                rows={6}
                placeholder='{"event": "user_signup", "userId": 123}'
              />
            </div>
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isExecuting ? 'Executing...' : 'Execute Workflow'}
            </button>
          </div>
        )}

        {!workflow.enabled && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            This workflow is disabled. Enable it to execute.
          </div>
        )}

        {/* Execution Result */}
        {execution && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Execution Result</h2>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    execution.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : execution.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {execution.status}
                </span>
              </div>

              {execution.error && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <div className="font-medium text-red-800">Error:</div>
                  <div className="text-red-700 text-sm mt-1">{execution.error}</div>
                </div>
              )}

              {execution.result && (
                <div>
                  <div className="font-medium mb-2">Result:</div>
                  <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-sm overflow-x-auto">
                    {JSON.stringify(execution.result, null, 2)}
                  </pre>
                </div>
              )}

              {execution.executionSteps && execution.executionSteps.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Execution Steps:</div>
                  <div className="space-y-2">
                    {execution.executionSteps.map((step, index) => (
                      <div key={step.id} className="border border-gray-200 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Step {index + 1}</span>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              step.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : step.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        {step.error && (
                          <div className="text-red-700 text-sm mt-1">{step.error}</div>
                        )}
                        {step.output && (
                          <pre className="bg-gray-50 rounded p-2 text-xs mt-2 overflow-x-auto">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {execution.startedAt && (
                <div className="text-sm text-gray-600">
                  Started: {new Date(execution.startedAt).toLocaleString()}
                </div>
              )}
              {execution.completedAt && (
                <div className="text-sm text-gray-600">
                  Completed: {new Date(execution.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowRunPage;

