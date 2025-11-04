/**
 * Types for Workflow Builder using React Flow
 */
import { Node, Edge } from 'reactflow';
import { TriggerType, CreateWorkflow } from './workflows';

export enum ActionType {
  HTTP_REQUEST = 'http_request',
  EMAIL = 'email',
  WAIT = 'wait',
  PARALLEL = 'parallel',
  EXAMPLE = 'example_action',
}

export interface ActionTypeConfig {
  type: ActionType;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig: Record<string, any>;
}

export const ACTION_TYPES: ActionTypeConfig[] = [
  {
    type: ActionType.HTTP_REQUEST,
    name: 'HTTP Request',
    description: 'Make an HTTP call to an external API',
    icon: '🌐',
    color: 'bg-blue-500',
    defaultConfig: {
      method: 'GET',
      url: '',
      headers: {},
      body: {},
    },
  },
  {
    type: ActionType.EMAIL,
    name: 'Send Google Email',
    description: 'Send an email via Google (requires OAuth2 authentication)',
    icon: '📧',
    color: 'bg-green-500',
    defaultConfig: {
      to: '',
      subject: '',
      body: '',
    },
  },
  {
    type: ActionType.WAIT,
    name: 'Wait/Delay',
    description: 'Wait for a duration or until a condition is met',
    icon: '⏳',
    color: 'bg-yellow-500',
    defaultConfig: {
      duration: '5s',
    },
  },
  {
    type: ActionType.PARALLEL,
    name: 'Parallel',
    description: 'Execute multiple actions simultaneously',
    icon: '⚡',
    color: 'bg-red-500',
    defaultConfig: {
      actionIds: [],
      waitForAll: true,
      stopOnFirstFailure: false,
    },
  },
];

export interface WorkflowNodeData {
  id: string;
  type: ActionType | 'trigger';
  name: string;
  config: Record<string, any>;
  retryConfig?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  // For React Flow visualization
  label?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowBuilderState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  trigger: {
    type: TriggerType;
    config: Record<string, any>;
  };
  workflowMeta: {
    name: string;
    description: string;
    enabled: boolean;
  };
}

