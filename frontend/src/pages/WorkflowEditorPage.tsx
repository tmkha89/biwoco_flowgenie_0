import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
} from '../api/workflows';
import type {
  CreateWorkflow,
  WorkflowResponse,
  UpdateWorkflowRequest,
  CreateAction,
  CreateTrigger,
} from '../types/workflows';
import { TriggerType } from '../types/workflows';

const WorkflowEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [workflow, setWorkflow] = useState<CreateWorkflow>({
    name: '',
    description: '',
    enabled: true,
    trigger: {
      type: TriggerType.MANUAL,
      config: {},
    },
    actions: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('✏️ [WorkflowEditorPage] Component mounted', { isInitializing, isAuthenticated, isEditing, id });
    if (!isInitializing && !isAuthenticated) {
      console.log('✏️ [WorkflowEditorPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (isEditing && id) {
      console.log('✏️ [WorkflowEditorPage] Editing mode, fetching workflow', { workflowId: id });
      fetchWorkflow(parseInt(id));
    } else {
      console.log('✏️ [WorkflowEditorPage] Creating new workflow');
    }
  }, [isAuthenticated, isInitializing, navigate, id, isEditing]);

  const fetchWorkflow = async (workflowId: number) => {
    console.log('✏️ [WorkflowEditorPage] fetchWorkflow() called', { workflowId });
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorkflowById(workflowId);
      console.log('✏️ [WorkflowEditorPage] Workflow fetched', { id: data.id, name: data.name, actionsCount: data.actions.length });
      setWorkflow({
        name: data.name,
        description: data.description || '',
        enabled: data.enabled,
        trigger: data.trigger
          ? {
              type: data.trigger.type as TriggerType,
              config: data.trigger.config,
            }
          : {
              type: TriggerType.MANUAL,
              config: {},
            },
        actions: data.actions.map((action) => ({
          type: action.type,
          name: action.name,
          config: action.config,
          order: action.order,
          retryConfig: action.retryConfig
            ? {
                type: action.retryConfig.type === 'exponential' ? 'exponential' : 'fixed',
                delay: action.retryConfig.delay || 1000,
              }
            : undefined,
        })),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow');
      console.error('❌ [WorkflowEditorPage] Error fetching workflow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('✏️ [WorkflowEditorPage] handleSave() called', { isEditing, workflowId: id, name: workflow.name, actionsCount: workflow.actions.length });
    try {
      setIsSaving(true);
      setError(null);

      if (isEditing && id) {
        const updateData: UpdateWorkflowRequest = {
          name: workflow.name,
          description: workflow.description,
          enabled: workflow.enabled,
          trigger: workflow.trigger,
          actions: workflow.actions,
        };
        console.log('✏️ [WorkflowEditorPage] Updating workflow', { ...updateData, actionsCount: updateData.actions?.length });
        await updateWorkflow(parseInt(id), updateData);
        console.log('✅ [WorkflowEditorPage] Workflow updated successfully');
      } else {
        console.log('✏️ [WorkflowEditorPage] Creating new workflow');
        await createWorkflow(workflow);
        console.log('✅ [WorkflowEditorPage] Workflow created successfully');
      }

      console.log('✏️ [WorkflowEditorPage] Navigating to workflows list');
      navigate('/workflows');
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow');
      console.error('❌ [WorkflowEditorPage] Error saving workflow:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAction = () => {
    console.log('✏️ [WorkflowEditorPage] handleAddAction() called', { currentActionsCount: workflow.actions.length });
    setWorkflow({
      ...workflow,
      actions: [
        ...workflow.actions,
        {
          type: 'example_action',
          name: `Action ${workflow.actions.length + 1}`,
          config: {},
          order: workflow.actions.length,
        },
      ],
    });
    console.log('✏️ [WorkflowEditorPage] Action added', { newActionsCount: workflow.actions.length + 1 });
  };

  const handleRemoveAction = (index: number) => {
    console.log('✏️ [WorkflowEditorPage] handleRemoveAction() called', { index, actionName: workflow.actions[index]?.name });
    setWorkflow({
      ...workflow,
      actions: workflow.actions.filter((_, i) => i !== index).map((action, i) => ({
        ...action,
        order: i,
      })),
    });
    console.log('✏️ [WorkflowEditorPage] Action removed', { remainingActionsCount: workflow.actions.length - 1 });
  };

  const handleUpdateAction = (index: number, updatedAction: CreateAction) => {
    const newActions = [...workflow.actions];
    newActions[index] = updatedAction;
    setWorkflow({ ...workflow, actions: newActions });
  };

  if (isInitializing || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Workflow' : 'Create Workflow'}
          </h1>
          <button
            onClick={() => navigate('/workflows')}
            className="text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workflow Name *
            </label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              placeholder="Enter workflow name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              rows={3}
              placeholder="Describe what this workflow does"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={workflow.enabled}
              onChange={(e) => setWorkflow({ ...workflow, enabled: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger *
            </label>
            <select
              value={workflow.trigger.type}
              onChange={(e) =>
                setWorkflow({
                  ...workflow,
                  trigger: {
                    type: e.target.value as TriggerType,
                    config: {},
                  },
                })
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value={TriggerType.MANUAL}>Manual</option>
              <option value={TriggerType.WEBHOOK}>Webhook</option>
              <option value={TriggerType.GOOGLE_MAIL}>Google-Mail</option>
              <option value={TriggerType.SCHEDULE}>Schedule</option>
            </select>
          </div>

          {/* Actions */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">Actions</label>
              <button
                onClick={handleAddAction}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              >
                Add Action
              </button>
            </div>

            {workflow.actions.length === 0 && (
              <p className="text-gray-500 text-sm mb-4">No actions added yet.</p>
            )}

            <div className="space-y-4">
              {workflow.actions.map((action, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium">Action {index + 1}</h4>
                    <button
                      onClick={() => handleRemoveAction(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Type</label>
                      <input
                        type="text"
                        value={action.type}
                        onChange={(e) =>
                          handleUpdateAction(index, { ...action, type: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
                        placeholder="Action type"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={action.name}
                        onChange={(e) =>
                          handleUpdateAction(index, { ...action, name: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
                        placeholder="Action name"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button
              onClick={() => navigate('/workflows')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !workflow.name || workflow.actions.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditorPage;

