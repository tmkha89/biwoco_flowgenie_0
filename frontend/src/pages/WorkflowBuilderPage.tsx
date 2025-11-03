/**
 * Main Workflow Builder Page with drag-and-drop interface
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useWorkflowBuilderStore } from '../store/workflow-builder.store';
import { getWorkflowById } from '../api/workflows';
import { convertFromBackendFormat } from '../utils/workflow-converter';
import ActionSidebar from '../components/workflow-builder/ActionSidebar';
import WorkflowCanvas from '../components/workflow-builder/WorkflowCanvas';
import PropertiesPanel from '../components/workflow-builder/PropertiesPanel';
import WorkflowToolbar from '../components/workflow-builder/WorkflowToolbar';
import { ACTION_TYPES, ActionType } from '../types/workflow-builder';
import { TriggerType } from '../types/workflows';
import type { WorkflowResponse } from '../types/workflows';

const WorkflowBuilderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isInitializing, refreshUser } = useAuth();
  const { setNodes, setEdges, loadWorkflow, reset, nodes, addNode } = useWorkflowBuilderStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback messages (googleConnected/googleError)
  useEffect(() => {
    const googleConnected = searchParams.get('googleConnected');
    const googleErrorParam = searchParams.get('googleError');

    if (googleConnected === 'true') {
      console.log('✅ [WorkflowBuilderPage] Google connected successfully, refreshing user data');
      // Clear the URL parameter
      setSearchParams({}, { replace: true });
      // Refresh user data to get updated googleLinked status
      if (refreshUser) {
        refreshUser().catch(err => {
          console.error('❌ [WorkflowBuilderPage] Failed to refresh user after Google connection:', err);
        });
      }
    }

    if (googleErrorParam) {
      console.error('❌ [WorkflowBuilderPage] Google connection error:', decodeURIComponent(googleErrorParam));
      // Clear the URL parameter
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshUser]);

  useEffect(() => {
    console.log('🎨 [WorkflowBuilderPage] Component mounted', { isInitializing, isAuthenticated, workflowId: id });
    if (!isInitializing && !isAuthenticated) {
      console.log('🎨 [WorkflowBuilderPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (id) {
      console.log('🎨 [WorkflowBuilderPage] Loading existing workflow', { workflowId: id });
      fetchWorkflow(parseInt(id));
    } else {
      console.log('🎨 [WorkflowBuilderPage] Creating new workflow');
      reset();
      // Add default trigger node at top left
      // Note: reset() already creates trigger at (10, 10), so this is redundant but kept for consistency
      const { setNodes } = useWorkflowBuilderStore.getState();
      setNodes([
        {
          id: 'trigger',
          type: 'default',
          position: { x: 10, y: 10 },
          data: {
            id: 'trigger',
            type: 'trigger' as any,
            name: 'Trigger',
            config: {},
          },
          style: {
            background: '#4F46E5',
            color: 'white',
            border: '2px solid #222',
            borderRadius: '8px',
            padding: '10px',
            minWidth: 150,
            textAlign: 'center',
          },
          deletable: false, // Prevent deletion
          draggable: true, // Allow repositioning
        },
      ]);
    }
  }, [isAuthenticated, isInitializing, navigate, id]);

  const fetchWorkflow = async (workflowId: number) => {
    console.log('🎨 [WorkflowBuilderPage] fetchWorkflow() called', { workflowId });
    try {
      setIsLoading(true);
      setError(null);
      const workflow = await getWorkflowById(workflowId);
      console.log('🎨 [WorkflowBuilderPage] Workflow fetched', { id: workflow.id, name: workflow.name });

      // Convert backend format to React Flow format
      const { nodes: flowNodes, edges: flowEdges } = convertFromBackendFormat(workflow);
      console.log('🎨 [WorkflowBuilderPage] Setting nodes and edges:', {
        nodesCount: flowNodes.length,
        edgesCount: flowEdges.length,
        nodes: flowNodes.map(n => n.id),
        edges: flowEdges.map(e => `${e.source} -> ${e.target}`),
      });
      setNodes(flowNodes);
      setEdges(flowEdges);
      // Update workflow meta separately (don't call loadWorkflow as it has its own conversion)
      const { setWorkflowMeta, setTrigger } = useWorkflowBuilderStore.getState();
      setWorkflowMeta({
        name: workflow.name,
        description: workflow.description || '',
        enabled: workflow.enabled,
      });
      if (workflow.trigger) {
        setTrigger({
          type: workflow.trigger.type as TriggerType,
          config: workflow.trigger.config || {},
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow');
      console.error('❌ [WorkflowBuilderPage] Error fetching workflow:', err);
    } finally {
      setIsLoading(false);
    }
  };


  if (isInitializing || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <WorkflowToolbar workflowId={id ? parseInt(id) : undefined} />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 mx-4 mt-2 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ActionSidebar />
        
        <div className="flex-1 relative border-2 border-gray-300 bg-gray-50 m-2 rounded-lg overflow-hidden">
          <WorkflowCanvas />
        </div>

        <PropertiesPanel />
      </div>
    </div>
  );
};

export default WorkflowBuilderPage;

