import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { WorkflowNode, WorkflowNodeData, WorkflowEdge, WorkflowBuilderState } from '../types/workflow-builder';
import { TriggerType, WorkflowResponse } from '../types/workflows';
import { ActionType, ACTION_TYPES } from '../types/workflow-builder';

interface WorkflowBuilderStore extends WorkflowBuilderState {
  // Node management
  setNodes: (nodes: WorkflowNode[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  addNode: (type: ActionType, position: { x: number; y: number }) => void;
  addNodeAtCenter: (type: ActionType) => WorkflowNode;
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  deleteNode: (id: string) => void;
  selectNode: (node: WorkflowNode | null) => void;

  // Edge management
  setEdges: (edges: WorkflowEdge[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  deleteEdge: (id: string) => void;

  // Workflow management
  setTrigger: (trigger: { type: TriggerType; config: Record<string, any> }) => void;
  setWorkflowMeta: (meta: { name: string; description: string; enabled: boolean }) => void;
  loadWorkflow: (workflow: WorkflowResponse) => void;
  reset: () => void;

  // Export/Import
  exportToJson: () => string;
  importFromJson: (json: string) => void;
}

const initialNodes: WorkflowNode[] = [];
const initialEdges: WorkflowEdge[] = [];

const getActionConfig = (type: ActionType) => {
  return ACTION_TYPES.find((a) => a.type === type) || ACTION_TYPES[0];
};

const generateNodeId = (type: ActionType | 'trigger'): string => {
  const prefix = type === 'trigger' ? 'trigger' : type;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useWorkflowBuilderStore = create<WorkflowBuilderStore>((set, get) => ({
  // Initial state
  nodes: initialNodes,
  edges: initialEdges,
  selectedNode: null,
  trigger: {
    type: TriggerType.MANUAL,
    config: {},
  },
  workflowMeta: {
    name: '',
    description: '',
    enabled: true,
  },

  // Node management
  setNodes: (nodes) => set({ nodes }),

  onNodesChange: (changes) => {
    // Filter out any changes that would remove the trigger node
    const filteredChanges = changes.map((change) => {
      if (change.type === 'remove') {
        const node = get().nodes.find((n) => n.id === change.id);
        if (node && node.data.type === 'trigger') {
          console.log('🎨 [WorkflowBuilder] Prevented trigger node deletion');
          return null; // Mark for filtering
        }
      }
      // Allow position changes for trigger but ensure it stays near top
      if (change.type === 'position' && change.position) {
        const node = get().nodes.find((n) => n.id === change.id);
        
      }
      return change;
    }).filter((change) => change !== null) as NodeChange[];

    set({
      nodes: applyNodeChanges(filteredChanges, get().nodes),
    });
  },

  addNode: (type, position) => {
    const actionConfig = getActionConfig(type);
    const newNodeId = generateNodeId(type);
    
    const newNode: WorkflowNode = {
      id: newNodeId,
      type: 'default',
      position,
      data: {
        id: newNodeId,
        type,
        name: `${actionConfig.name} ${get().nodes.filter((n) => n.data.type === type).length + 1}`,
        config: { ...actionConfig.defaultConfig },
        label: actionConfig.name,
      },
      style: {
        background: actionConfig.color,
        color: 'white',
        border: '2px solid #222',
        borderRadius: '8px',
        padding: '10px',
        minWidth: 150,
        textAlign: 'center',
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
  },

  addNodeAtCenter: (type: ActionType) => {
    const state = get();
    const actionConfig = getActionConfig(type);
    const newNodeId = generateNodeId(type);
    
    // Calculate position: center of viewport or after last action node
    let position: { x: number; y: number };
    
    const actionNodes = state.nodes.filter((n) => n.data.type !== 'trigger');
    if (actionNodes.length === 0) {
      // If no actions, place below trigger or at default position
      const triggerNode = state.nodes.find((n) => n.data.type === 'trigger');
      if (triggerNode) {
        position = {
          x: triggerNode.position.x,
          y: triggerNode.position.y + 20,
        };
      } else {
        position = { x: 400, y: 300 };
      }
    } else {
      // Place after the last action node, offset to the right
      const lastNode = actionNodes[actionNodes.length - 1];
      position = {
        x: lastNode.position.x + 250,
        y: lastNode.position.y,
      };
    }
    
    const newNode: WorkflowNode = {
      id: newNodeId,
      type: 'default',
      position,
      data: {
        id: newNodeId,
        type,
        name: `${actionConfig.name} ${actionNodes.filter((n) => n.data.type === type).length + 1}`,
        config: { ...actionConfig.defaultConfig },
        label: actionConfig.name,
      },
      style: {
        background: actionConfig.color,
        color: 'white',
        border: '2px solid #222',
        borderRadius: '8px',
        padding: '10px',
        minWidth: 150,
        textAlign: 'center',
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));
    
    return newNode;
  },

  updateNode: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            }
          : node,
      ),
      selectedNode:
        state.selectedNode?.id === id
          ? {
              ...state.selectedNode,
              data: {
                ...state.selectedNode.data,
                ...data,
              },
            }
          : state.selectedNode,
    }));
  },

  deleteNode: (id) => {
    // Prevent deleting trigger node
    const node = get().nodes.find((n) => n.id === id);
    if (node && node.data.type === 'trigger') {
      console.log('🎨 [WorkflowBuilder] Cannot delete trigger node - it is required');
      return;
    }

    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNode: state.selectedNode?.id === id ? null : state.selectedNode,
    }));
  },

  selectNode: (node) => {
    console.log('🎨 [WorkflowBuilder] Node selected:', node?.id);
    set({ selectedNode: node });
  },

  // Edge management
  setEdges: (edges) => {
    console.log('🎨 [WorkflowBuilder] setEdges called with:', {
      count: edges.length,
      edges: edges.map(e => `${e.source} -> ${e.target} (id: ${e.id})`),
    });
    set({ edges });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    // Prevent connecting to itself
    if (connection.source === connection.target) {
      console.log('🎨 [WorkflowBuilder] Cannot connect node to itself');
      return;
    }

    // Prevent duplicate connections
    const existingEdges = get().edges;
    const duplicate = existingEdges.find(
      (edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        edge.sourceHandle === connection.sourceHandle,
    );

    if (duplicate) {
      console.log('🎨 [WorkflowBuilder] Connection already exists');
      return;
    }

    console.log('🎨 [WorkflowBuilder] Edge connected:', connection);
    
    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.sourceHandle || 'default'}-${connection.target}-${Date.now()}`,
      type: 'smoothstep' as const,
      animated: true,
      style: { strokeWidth: 3, stroke: '#6366f1' },
    };

    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  deleteEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    }));
  },

  // Workflow management
  setTrigger: (trigger) => {
    console.log('🎨 [WorkflowBuilder] Trigger updated:', trigger);
    set({ trigger });
  },

  setWorkflowMeta: (meta) => {
    console.log('🎨 [WorkflowBuilder] Workflow meta updated:', meta);
    set({ workflowMeta: meta });
  },

  loadWorkflow: (workflow) => {
    console.log('🎨 [WorkflowBuilder] Loading workflow:', workflow.id);
    // Convert backend workflow to React Flow format
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Add trigger node - always required, positioned at top left (or use saved position)
    if (workflow.trigger) {
      nodes.push({
        id: 'trigger',
        type: 'default',
        position: { 
          x: workflow.trigger.positionX ?? 10, 
          y: workflow.trigger.positionY ?? 10 
        },
        data: {
          id: 'trigger',
          type: 'trigger' as any,
          name: 'Trigger',
          config: workflow.trigger.config,
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
        deletable: false,
        draggable: true,
      });
    } else {
      // Always add a trigger node even if workflow doesn't have one
      nodes.push({
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
        deletable: false,
        draggable: true,
      });
    }

    // Add action nodes
    workflow.actions.forEach((action, index) => {
      const actionConfig = getActionConfig(action.type as ActionType);
      nodes.push({
        id: `action-${action.id}`,
        type: 'default',
        position: { x: 250 + (index % 3) * 200, y: 250 + Math.floor(index / 3) * 150 },
        data: {
          id: `action-${action.id}`,
          type: action.type as ActionType,
          name: action.name,
          config: action.config,
          retryConfig: action.retryConfig
            ? {
                type: (action.retryConfig as any).type || 'fixed',
                delay: (action.retryConfig as any).delay || 1000,
              }
            : undefined,
        },
        style: {
          background: actionConfig.color,
          color: 'white',
          border: '2px solid #222',
          borderRadius: '8px',
          padding: '10px',
          minWidth: 150,
          textAlign: 'center',
        },
      });

      // Add edge from trigger to first action
      if (index === 0 && workflow.trigger) {
        edges.push({
          id: `trigger-action-${action.id}`,
          source: 'trigger',
          target: `action-${action.id}`,
          type: 'smoothstep',
          animated: true,
        });
      }

      // Add edges based on nextActionId (simplified - will need more logic for complex workflows)
      // This is a simplified conversion - full implementation would need to handle all relationships
    });

    set({
      nodes,
      edges,
      trigger: workflow.trigger
        ? { type: workflow.trigger.type as TriggerType, config: workflow.trigger.config }
        : { type: TriggerType.MANUAL, config: {} },
      workflowMeta: {
        name: workflow.name,
        description: workflow.description || '',
        enabled: workflow.enabled,
      },
    });
  },

  reset: () => {
    console.log('🎨 [WorkflowBuilder] Resetting workflow builder');
    // Always include trigger node on reset, positioned at top left
    const triggerNode: WorkflowNode = {
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
      deletable: false,
      draggable: true,
    };
    
    set({
      nodes: [triggerNode],
      edges: [],
      selectedNode: null,
      trigger: {
        type: TriggerType.MANUAL,
        config: {},
      },
      workflowMeta: {
        name: '',
        description: '',
        enabled: true,
      },
    });
  },

  exportToJson: () => {
    const state = get();
    const exportData = {
      workflowMeta: state.workflowMeta,
      trigger: state.trigger,
      nodes: state.nodes,
      edges: state.edges,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importFromJson: (json) => {
    try {
      const data = JSON.parse(json);
      set({
        nodes: data.nodes || [],
        edges: data.edges || [],
        trigger: data.trigger || { type: TriggerType.MANUAL, config: {} },
        workflowMeta: data.workflowMeta || {
          name: '',
          description: '',
          enabled: true,
        },
      });
    } catch (error) {
      console.error('Failed to import JSON:', error);
      throw new Error('Invalid JSON format');
    }
  },
}));

