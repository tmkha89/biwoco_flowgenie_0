/**
 * Utilities to convert between React Flow format and Backend workflow format
 */
import { WorkflowNode, WorkflowEdge } from '../types/workflow-builder';
import { CreateWorkflow, CreateAction } from '../types/workflows';
import { useWorkflowBuilderStore } from '../store/workflow-builder.store';
import { ActionType } from '../types/workflow-builder';

/**
 * Convert React Flow nodes and edges to backend workflow format
 */
export function convertToBackendFormat(): CreateWorkflow {
  const store = useWorkflowBuilderStore.getState();
  const { nodes, edges, trigger, workflowMeta } = store;

  // Filter out trigger node and sort action nodes
  const actionNodes = nodes.filter((node) => node.data.type !== 'trigger');

  // Build action relationships map
  const actionIdMap = new Map<string, number>(); // tempId -> order
  actionNodes.forEach((node, index) => {
    actionIdMap.set(node.id, index);
  });

  // Build edges map: source -> targets
  const edgeMap = new Map<string, string[]>(); // sourceId -> targetIds[]
  edges.forEach((edge) => {
    if (!edgeMap.has(edge.source)) {
      edgeMap.set(edge.source, []);
    }
    edgeMap.get(edge.source)!.push(edge.target);
  });

  // Build a map of node ID to action order for relationship building
  const nodeIdToOrder = new Map<string, number>();
  actionNodes.forEach((node, order) => {
    nodeIdToOrder.set(node.id, order);
  });

  // Convert nodes to backend actions
  const actions: CreateAction[] = actionNodes.map((node, order) => {
    const config: Record<string, any> = { ...node.data.config };
    const targets = edgeMap.get(node.id) || [];

    // Handle conditional action - set trueActionId and falseActionId based on edge labels
    if (node.data.type === ActionType.CONDITIONAL) {
      // Find edges with labels 'true' or 'false'
      const trueEdge = edges.find((e) => e.source === node.id && (e.label === 'true' || e.sourceHandle === 'true'));
      const falseEdge = edges.find((e) => e.source === node.id && (e.label === 'false' || e.sourceHandle === 'false'));
      
      if (trueEdge && nodeIdToOrder.has(trueEdge.target)) {
        config.trueActionId = nodeIdToOrder.get(trueEdge.target);
      }
      if (falseEdge && nodeIdToOrder.has(falseEdge.target)) {
        config.falseActionId = nodeIdToOrder.get(falseEdge.target);
      }
      // Fallback: if no labels, use first two targets
      else if (targets.length >= 2) {
        config.trueActionId = nodeIdToOrder.get(targets[0]);
        config.falseActionId = nodeIdToOrder.get(targets[1]);
      } else if (targets.length === 1) {
        config.trueActionId = nodeIdToOrder.get(targets[0]);
      }
    }

    // Handle parallel action - set actionIds for all outgoing edges
    else if (node.data.type === ActionType.PARALLEL) {
      config.actionIds = targets
        .map((targetId) => nodeIdToOrder.get(targetId))
        .filter((id) => id !== undefined) as number[];
    }

    // Handle loop action - set loopActionId from first outgoing edge
    else if (node.data.type === ActionType.LOOP) {
      if (targets.length > 0 && nodeIdToOrder.has(targets[0])) {
        config.loopActionId = nodeIdToOrder.get(targets[0]);
      }
    }

    // For sequential actions, nextActionId will be set below based on edges

    return {
      type: node.data.type,
      name: node.data.name,
      config,
      order,
      retryConfig: node.data.retryConfig,
      // Store nodeId temporarily for relationship building
      _nodeId: node.id,
    } as CreateAction & { _nodeId: string };
  });

  // Build sequential relationships (nextActionId)
  // For nodes with single outgoing edge (and not conditional/parallel/loop), set nextActionId
  actions.forEach((action) => {
    const nodeId = (action as any)._nodeId;
    const targets = edgeMap.get(nodeId) || [];

    // Note: nextActionId will be set by the backend after actions are created
    // based on the order and edges. For sequential actions, the backend
    // will determine nextActionId from the order field.
    // Remove temporary _nodeId
    delete (action as any)._nodeId;
  });

  // Note: The backend's WorkflowRelationshipHelper will set nextActionId, parentActionId
  // based on action order and relationships. For now, we rely on order to determine
  // sequence for sequential actions.

  return {
    name: workflowMeta.name,
    description: workflowMeta.description,
    enabled: workflowMeta.enabled,
    trigger,
    actions,
  };
}

/**
 * Convert backend workflow format to React Flow format
 */
export function convertFromBackendFormat(workflow: any): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Add trigger node - always required, positioned at top center (30px from top)
  if (workflow.trigger) {
    nodes.push({
      id: 'trigger',
      type: 'default',
      position: { x: 325, y: 30 },
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
      position: { x: 325, y: 30 },
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
  const actionIdToNodeId = new Map<number, string>();
  workflow.actions.forEach((action: any, index: number) => {
    const nodeId = `action-${action.id || index}`;
    actionIdToNodeId.set(action.id || index, nodeId);

    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: 250 + (index % 4) * 200, y: 250 + Math.floor(index / 4) * 150 },
      data: {
        id: nodeId,
        type: action.type as ActionType,
        name: action.name,
        config: action.config,
        retryConfig: action.retryConfig,
      },
    });
  });

  // Add edges based on nextActionId
  workflow.actions.forEach((action: any, index: number) => {
    const sourceNodeId = `action-${action.id || index}`;

    // Connect trigger to first action
    if (index === 0 && workflow.trigger) {
      edges.push({
        id: `trigger-${sourceNodeId}`,
        source: 'trigger',
        target: sourceNodeId,
        type: 'smoothstep',
        animated: true,
      });
    }

    // Connect to next action if exists
    if (action.nextActionId !== undefined && action.nextActionId !== null) {
      const targetNodeId = actionIdToNodeId.get(action.nextActionId);
      if (targetNodeId) {
        edges.push({
          id: `${sourceNodeId}-${targetNodeId}`,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'smoothstep',
          animated: true,
        });
      }
    }

    // Connect conditional branches
    if (action.type === ActionType.CONDITIONAL && action.config) {
      if (action.config.trueActionId !== undefined) {
        const trueTargetId = actionIdToNodeId.get(action.config.trueActionId);
        if (trueTargetId) {
          edges.push({
            id: `${sourceNodeId}-true-${trueTargetId}`,
            source: sourceNodeId,
            target: trueTargetId,
            type: 'smoothstep',
            animated: true,
            label: 'true',
            labelStyle: { fill: 'green', fontWeight: 700 },
          });
        }
      }
      if (action.config.falseActionId !== undefined) {
        const falseTargetId = actionIdToNodeId.get(action.config.falseActionId);
        if (falseTargetId) {
          edges.push({
            id: `${sourceNodeId}-false-${falseTargetId}`,
            source: sourceNodeId,
            target: falseTargetId,
            type: 'smoothstep',
            animated: true,
            label: 'false',
            labelStyle: { fill: 'red', fontWeight: 700 },
          });
        }
      }
    }

    // Connect parallel actions
    if (action.type === ActionType.PARALLEL && action.config?.actionIds) {
      action.config.actionIds.forEach((targetId: number) => {
        const targetNodeId = actionIdToNodeId.get(targetId);
        if (targetNodeId) {
          edges.push({
            id: `${sourceNodeId}-parallel-${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            type: 'smoothstep',
            animated: true,
          });
        }
      });
    }

    // Connect loop action
    if (action.type === ActionType.LOOP && action.config?.loopActionId !== undefined) {
      const loopTargetId = actionIdToNodeId.get(action.config.loopActionId);
      if (loopTargetId) {
        edges.push({
          id: `${sourceNodeId}-loop-${loopTargetId}`,
          source: sourceNodeId,
          target: loopTargetId,
          type: 'smoothstep',
          animated: true,
          label: 'loop',
        });
      }
    }
  });

  return { nodes, edges };
}

