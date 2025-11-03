/**
 * TDD Tests for Workflow API Client
 * Tests written before implementation to guide development
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import {
  getWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getWorkflowExecutions,
  getExecutionHistory,
  getExecutionById,
} from '../../api/workflows';
import type {
  CreateWorkflow,
  WorkflowResponse,
  ExecutionResponse,
  UpdateWorkflowRequest,
} from '../../types/workflows';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create a mock axios instance for testing
const mockAxiosInstance = axios.create();
const mock = new axiosMockAdapter(mockAxiosInstance);

// Mock the apiClient module
vi.mock('../../api/axios', () => {
  return {
    apiClient: mockAxiosInstance,
    createApiInstance: () => mockAxiosInstance,
  };
});

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

describe('Workflow API Client', () => {
  beforeEach(() => {
    mock.reset();
    localStorageMock.clear();
    // Set up auth token
    localStorageMock.setItem('access_token', 'test-token');
  });

  describe('getWorkflows', () => {
    it('should fetch all workflows successfully', async () => {
      const mockWorkflows: WorkflowResponse[] = [
        {
          id: 1,
          userId: 1,
          name: 'Test Workflow',
          description: 'Test Description',
          enabled: true,
          actions: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mock.onGet(`${API_URL}/workflows`).reply(200, mockWorkflows);

      const result = await getWorkflows();

      expect(result).toEqual(mockWorkflows);
    });

    it('should filter by enabled status', async () => {
      const mockWorkflows: WorkflowResponse[] = [];

      mock.onGet(`${API_URL}/workflows`, { params: { enabled: 'true' } }).reply(200, mockWorkflows);

      const result = await getWorkflows(true);

      expect(result).toEqual(mockWorkflows);
    });

    it('should handle API errors', async () => {
      mock.onGet(`${API_URL}/workflows`).reply(500, { message: 'Server error' });

      await expect(getWorkflows()).rejects.toThrow('Server error');
    });

    it('should handle network errors', async () => {
      mock.onGet(`${API_URL}/workflows`).networkError();

      await expect(getWorkflows()).rejects.toThrow();
    });
  });

  describe('getWorkflowById', () => {
    it('should fetch a workflow by ID successfully', async () => {
      const mockWorkflow: WorkflowResponse = {
        id: 1,
        userId: 1,
        name: 'Test Workflow',
        enabled: true,
        actions: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mock.onGet(`${API_URL}/workflows/1`).reply(200, mockWorkflow);

      const result = await getWorkflowById(1);

      expect(result).toEqual(mockWorkflow);
    });

    it('should handle 404 errors', async () => {
      mock.onGet(`${API_URL}/workflows/999`).reply(404, { message: 'Workflow not found' });

      await expect(getWorkflowById(999)).rejects.toThrow('Workflow not found');
    });
  });

  describe('createWorkflow', () => {
    it('should create a workflow successfully', async () => {
      const createData: CreateWorkflow = {
        name: 'New Workflow',
        description: 'Description',
        enabled: true,
        trigger: {
          type: 'manual',
          config: {},
        },
        actions: [
          {
            type: 'example_action',
            name: 'Test Action',
            config: {},
            order: 0,
          },
        ],
      };

      const mockResponse: WorkflowResponse = {
        id: 1,
        userId: 1,
        ...createData,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mock.onPost(`${API_URL}/workflows`, createData).reply(201, mockResponse);

      const result = await createWorkflow(createData);

      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors', async () => {
      const invalidData: CreateWorkflow = {
        name: '',
        trigger: {
          type: 'manual',
          config: {},
        },
        actions: [],
      };

      mock.onPost(`${API_URL}/workflows`).reply(400, { message: 'Invalid workflow data' });

      await expect(createWorkflow(invalidData)).rejects.toThrow('Invalid workflow data');
    });
  });

  describe('updateWorkflow', () => {
    it('should update a workflow successfully', async () => {
      const updateData: UpdateWorkflowRequest = {
        name: 'Updated Name',
        enabled: false,
      };

      const mockResponse: WorkflowResponse = {
        id: 1,
        userId: 1,
        name: 'Updated Name',
        enabled: false,
        actions: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mock.onPut(`${API_URL}/workflows/1`, updateData).reply(200, mockResponse);

      const result = await updateWorkflow(1, updateData);

      expect(result).toEqual(mockResponse);
    });

    it('should handle update errors', async () => {
      mock.onPut(`${API_URL}/workflows/1`).reply(404, { message: 'Workflow not found' });

      await expect(updateWorkflow(1, { name: 'Test' })).rejects.toThrow('Workflow not found');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete a workflow successfully', async () => {
      mock.onDelete(`${API_URL}/workflows/1`).reply(200);

      await expect(deleteWorkflow(1)).resolves.not.toThrow();
    });

    it('should handle delete errors', async () => {
      mock.onDelete(`${API_URL}/workflows/999`).reply(404, { message: 'Workflow not found' });

      await expect(deleteWorkflow(999)).rejects.toThrow('Workflow not found');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow successfully', async () => {
      const mockExecution: ExecutionResponse = {
        id: 1,
        workflowId: 1,
        userId: 1,
        status: 'pending',
        executionSteps: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mock
        .onPost(`${API_URL}/workflows/1/trigger`, { triggerData: { test: 'data' } })
        .reply(201, mockExecution);

      const result = await executeWorkflow(1, { test: 'data' });

      expect(result).toEqual(mockExecution);
    });

    it('should execute workflow without trigger data', async () => {
      const mockExecution: ExecutionResponse = {
        id: 1,
        workflowId: 1,
        userId: 1,
        status: 'pending',
        executionSteps: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mock.onPost(`${API_URL}/workflows/1/trigger`).reply(201, mockExecution);

      const result = await executeWorkflow(1);

      expect(result).toEqual(mockExecution);
    });

    it('should handle execution errors', async () => {
      mock
        .onPost(`${API_URL}/workflows/1/trigger`)
        .reply(400, { message: 'Workflow is disabled' });

      await expect(executeWorkflow(1)).rejects.toThrow('Workflow is disabled');
    });
  });

  describe('getWorkflowExecutions', () => {
    it('should fetch workflow executions successfully', async () => {
      const mockExecutions: ExecutionResponse[] = [
        {
          id: 1,
          workflowId: 1,
          userId: 1,
          status: 'completed',
          executionSteps: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mock
        .onGet(`${API_URL}/workflows/1/executions`, { params: { limit: '10', offset: '0' } })
        .reply(200, mockExecutions);

      const result = await getWorkflowExecutions(1, 10, 0);

      expect(result).toEqual(mockExecutions);
    });

    it('should handle pagination', async () => {
      mock.onGet(`${API_URL}/workflows/1/executions`).reply(200, []);

      const result = await getWorkflowExecutions(1);

      expect(result).toEqual([]);
    });
  });

  describe('getExecutionHistory', () => {
    it('should fetch execution history successfully', async () => {
      const mockExecutions: ExecutionResponse[] = [];

      mock.onGet(`${API_URL}/workflows/executions/history`).reply(200, mockExecutions);

      const result = await getExecutionHistory();

      expect(result).toEqual(mockExecutions);
    });
  });

  describe('getExecutionById', () => {
    it('should fetch execution by ID successfully', async () => {
      const mockExecution: ExecutionResponse = {
        id: 1,
        workflowId: 1,
        userId: 1,
        status: 'completed',
        executionSteps: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mock.onGet(`${API_URL}/workflows/executions/1`).reply(200, mockExecution);

      const result = await getExecutionById(1);

      expect(result).toEqual(mockExecution);
    });

    it('should handle 404 errors', async () => {
      mock.onGet(`${API_URL}/workflows/executions/999`).reply(404, { message: 'Execution not found' });

      await expect(getExecutionById(999)).rejects.toThrow('Execution not found');
    });
  });
});
