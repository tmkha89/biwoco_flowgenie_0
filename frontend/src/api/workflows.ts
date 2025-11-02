import {
  CreateWorkflow,
  WorkflowResponse,
  UpdateWorkflowRequest,
  TriggerWorkflowRequest,
  ExecutionResponse,
} from '../types/workflows';
import { apiClient } from './axios';

/**
 * Get all workflows for the current user
 */
export const getWorkflows = async (enabled?: boolean): Promise<WorkflowResponse[]> => {
  try {
    const params = enabled !== undefined ? { enabled: enabled.toString() } : {};
    console.log('📡 [API] GET /workflows - Request sent', params);
    const res = await apiClient.get<WorkflowResponse[]>('/workflows', { params });
    console.log('✅ [API] GET /workflows - Response received', { count: res.data.length });
    return res.data;
  } catch (err: any) {
    console.error('❌ [API] GET /workflows - Error:', err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch workflows');
  }
};

/**
 * Get a specific workflow by ID
 */
export const getWorkflowById = async (id: number): Promise<WorkflowResponse> => {
  try {
    console.log(`📡 [API] GET /workflows/${id} - Request sent`);
    const res = await apiClient.get<WorkflowResponse>(`/workflows/${id}`);
    console.log(`✅ [API] GET /workflows/${id} - Response received`, { name: res.data.name });
    return res.data;
  } catch (err: any) {
    console.error(`❌ [API] GET /workflows/${id} - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch workflow');
  }
};

/**
 * Create a new workflow
 */
export const createWorkflow = async (data: CreateWorkflow): Promise<WorkflowResponse> => {
  try {
    console.log('📡 [API] POST /workflows - Request sent', { name: data.name, actionsCount: data.actions.length });
    const res = await apiClient.post<WorkflowResponse>('/workflows', data);
    console.log('✅ [API] POST /workflows - Response received', { id: res.data.id, name: res.data.name });
    return res.data;
  } catch (err: any) {
    console.error('❌ [API] POST /workflows - Error:', err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to create workflow');
  }
};

/**
 * Update a workflow
 */
export const updateWorkflow = async (
  id: number,
  data: UpdateWorkflowRequest,
): Promise<WorkflowResponse> => {
  try {
    console.log(`📡 [API] PUT /workflows/${id} - Request sent`, { name: data.name });
    const res = await apiClient.put<WorkflowResponse>(`/workflows/${id}`, data);
    console.log(`✅ [API] PUT /workflows/${id} - Response received`, { id: res.data.id });
    return res.data;
  } catch (err: any) {
    console.error(`❌ [API] PUT /workflows/${id} - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to update workflow');
  }
};

/**
 * Delete a workflow
 */
export const deleteWorkflow = async (id: number): Promise<void> => {
  try {
    console.log(`📡 [API] DELETE /workflows/${id} - Request sent`);
    await apiClient.delete(`/workflows/${id}`);
    console.log(`✅ [API] DELETE /workflows/${id} - Success`);
  } catch (err: any) {
    console.error(`❌ [API] DELETE /workflows/${id} - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to delete workflow');
  }
};

/**
 * Trigger/execute a workflow
 */
export const executeWorkflow = async (
  id: number,
  triggerData?: Record<string, any>,
): Promise<ExecutionResponse> => {
  try {
    console.log(`📡 [API] POST /workflows/${id}/trigger - Request sent`, { hasTriggerData: !!triggerData });
    const res = await apiClient.post<ExecutionResponse>(`/workflows/${id}/trigger`, {
      triggerData,
    });
    console.log(`✅ [API] POST /workflows/${id}/trigger - Response received`, { executionId: res.data.id, status: res.data.status });
    return res.data;
  } catch (err: any) {
    console.error(`❌ [API] POST /workflows/${id}/trigger - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to execute workflow');
  }
};

/**
 * Get execution history for a workflow
 */
export const getWorkflowExecutions = async (
  workflowId: number,
  limit?: number,
  offset?: number,
): Promise<ExecutionResponse[]> => {
  try {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = limit.toString();
    if (offset !== undefined) params.offset = offset.toString();

    console.log(`📡 [API] GET /workflows/${workflowId}/executions - Request sent`, params);
    const res = await apiClient.get<ExecutionResponse[]>(`/workflows/${workflowId}/executions`, {
      params,
    });
    console.log(`✅ [API] GET /workflows/${workflowId}/executions - Response received`, { count: res.data.length });
    return res.data;
  } catch (err: any) {
    console.error(`❌ [API] GET /workflows/${workflowId}/executions - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch executions');
  }
};

/**
 * Get execution history for all workflows (current user)
 */
export const getExecutionHistory = async (
  limit?: number,
  offset?: number,
): Promise<ExecutionResponse[]> => {
  try {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = limit.toString();
    if (offset !== undefined) params.offset = offset.toString();

    console.log('📡 [API] GET /workflows/executions/history - Request sent', params);
    const res = await apiClient.get<ExecutionResponse[]>('/workflows/executions/history', {
      params,
    });
    console.log('✅ [API] GET /workflows/executions/history - Response received', { count: res.data.length });
    return res.data;
  } catch (err: any) {
    console.error('❌ [API] GET /workflows/executions/history - Error:', err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch execution history');
  }
};

/**
 * Get a specific execution by ID
 */
export const getExecutionById = async (executionId: number): Promise<ExecutionResponse> => {
  try {
    console.log(`📡 [API] GET /workflows/executions/${executionId} - Request sent`);
    const res = await apiClient.get<ExecutionResponse>(`/workflows/executions/${executionId}`);
    console.log(`✅ [API] GET /workflows/executions/${executionId} - Response received`, { status: res.data.status });
    return res.data;
  } catch (err: any) {
    console.error(`❌ [API] GET /workflows/executions/${executionId} - Error:`, err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch execution');
  }
};

