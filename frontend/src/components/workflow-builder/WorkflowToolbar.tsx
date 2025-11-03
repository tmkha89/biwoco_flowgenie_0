/**
 * Toolbar component for workflow builder actions
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';
import { convertToBackendFormat } from '../../utils/workflow-converter';
import { createWorkflow, updateWorkflow, executeWorkflow } from '../../api/workflows';
import type { WorkflowResponse } from '../../types/workflows';

interface WorkflowToolbarProps {
  workflowId?: number;
  onExecute?: () => void;
}

const WorkflowToolbar = ({ workflowId, onExecute }: WorkflowToolbarProps) => {
  const navigate = useNavigate();
  const { workflowMeta, nodes, reset } = useWorkflowBuilderStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    console.log('🎨 [WorkflowToolbar] Save clicked');
    
    if (!workflowMeta.name) {
      setError('Please enter a workflow name');
      return;
    }

    if (nodes.length === 0) {
      setError('Please add at least one action to the workflow');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const workflowData = convertToBackendFormat();
      console.log('🎨 [WorkflowToolbar] Converted workflow data:', workflowData);

      if (workflowId) {
        // Update existing workflow
        console.log('🎨 [WorkflowToolbar] Updating workflow:', workflowId);
        await updateWorkflow(workflowId, {
          name: workflowData.name,
          description: workflowData.description,
          enabled: workflowData.enabled,
          trigger: workflowData.trigger,
          actions: workflowData.actions,
        });
        console.log('✅ [WorkflowToolbar] Workflow updated successfully');
      } else {
        // Create new workflow
        console.log('🎨 [WorkflowToolbar] Creating new workflow');
        const created = await createWorkflow(workflowData);
        console.log('✅ [WorkflowToolbar] Workflow created successfully:', created.id);
        navigate(`/workflows/${created.id}`);
      }

      // Show success message
      alert('Workflow saved successfully!');
    } catch (err: any) {
      console.error('❌ [WorkflowToolbar] Error saving workflow:', err);
      setError(err.message || 'Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
    console.log('🎨 [WorkflowToolbar] Execute clicked');
    
    if (!workflowId) {
      setError('Please save the workflow first');
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);

      const execution = await executeWorkflow(workflowId);
      console.log('✅ [WorkflowToolbar] Workflow execution started:', execution.id);
      
      if (onExecute) {
        onExecute();
      } else {
        navigate(`/workflows/${workflowId}/execute`);
      }
    } catch (err: any) {
      console.error('❌ [WorkflowToolbar] Error executing workflow:', err);
      setError(err.message || 'Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the workflow? All unsaved changes will be lost.')) {
      reset();
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-800">
          {workflowMeta.name || 'Untitled Workflow'}
        </h1>
        <input
          type="text"
          value={workflowMeta.name}
          onChange={(e) =>
            useWorkflowBuilderStore.getState().setWorkflowMeta({
              ...workflowMeta,
              name: e.target.value,
            })
          }
          placeholder="Workflow name"
          className="border border-gray-300 rounded px-3 py-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
        >
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </button>
        {workflowId && (
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkflowToolbar;

