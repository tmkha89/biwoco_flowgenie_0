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

    // Handle parallel action - set actionIds for all outgoing edges
    if (node.data.type === ActionType.PARALLEL) {
      config.actionIds = targets
        .map((targetId) => nodeIdToOrder.get(targetId))
        .filter((id) => id !== undefined) as number[];
    }


    // For sequential actions, nextActionId will be set below based on edges

    return {
      type: node.data.type,
      name: node.data.name,
      config,
      order,
      positionX: node.position.x,
      positionY: node.position.y,
      retryConfig: node.data.retryConfig,
      // Store nodeId temporarily for relationship building
      _nodeId: node.id,
    } as CreateAction & { _nodeId: string };
  });

  // Find trigger node and include position
  const triggerNode = nodes.find((node) => node.data.type === 'trigger');
  const triggerWithPosition = triggerNode
    ? {
        ...trigger,
        positionX: triggerNode.position.x,
        positionY: triggerNode.position.y,
      }
    : trigger;

  // Build sequential relationships (nextActionOrder)
  // For nodes with single outgoing edge (and not parallel), set nextActionOrder
  actions.forEach((action, index) => {
    const nodeId = (action as any)._nodeId;
    const targets = edgeMap.get(nodeId) || [];

    // Set nextActionOrder for sequential actions
    if (
      action.type !== ActionType.PARALLEL &&
      targets.length === 1
    ) {
      const nextOrder = nodeIdToOrder.get(targets[0]);
      if (nextOrder !== undefined) {
        action.nextActionOrder = nextOrder;
        console.log(`🎨 [WorkflowConverter] Sequential: action at order ${index} -> nextActionOrder ${nextOrder}`);
      }
    }
  });

  // Build parent-child relationships (parentActionOrder)
  // For parallel action children, set parentActionOrder
  // Note: We already handle parallel children via config.actionIds, but we also set parentActionOrder
  // for explicit parent-child relationship tracking
  actions.forEach((action, index) => {
    const nodeId = (action as any)._nodeId;
    
    // Check if this action is a child of a parallel action
    // Find edges that point to this node (this node is a target)
    edges.forEach((edge) => {
      if (edge.target === nodeId) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode && sourceNode.data.type === ActionType.PARALLEL) {
          const parentOrder = nodeIdToOrder.get(sourceNode.id);
          if (parentOrder !== undefined && action.type !== ActionType.PARALLEL) {
            action.parentActionOrder = parentOrder;
            console.log(`🎨 [WorkflowConverter] Parent-child: action at order ${index} -> parentActionOrder ${parentOrder} (parallel)`);
          }
        }
      }
    });

  });

  // Remove temporary _nodeId from all actions
  actions.forEach((action) => {
    delete (action as any)._nodeId;
  });

  // Note: The backend's WorkflowRelationshipHelper will set nextActionId, parentActionId
  // based on action order and relationships. For now, we rely on order to determine
  // sequence for sequential actions.

  return {
    name: workflowMeta.name,
    description: workflowMeta.description,
    enabled: workflowMeta.enabled,
    trigger: triggerWithPosition,
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
  console.log('🎨 [WorkflowConverter] convertFromBackendFormat called with workflow:', workflow);
  console.log('🎨 [WorkflowConverter] Actions:', workflow.actions);
  
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Add trigger node - always required, use saved position or default to top left
  const triggerPosition = workflow.trigger?.positionX !== undefined && workflow.trigger?.positionY !== undefined
    ? { x: workflow.trigger.positionX, y: workflow.trigger.positionY }
    : { x: 50, y: 50 }; // Default position: top left

  if (workflow.trigger) {
    nodes.push({
      id: 'trigger',
      type: 'default',
      position: triggerPosition,
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
      position: triggerPosition,
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
    console.log(`🎨 [WorkflowConverter] Mapping action ${action.id} -> ${nodeId}`, {
      type: action.type,
      config: action.config,
      parentActionId: action.parentActionId,
      nextActionId: action.nextActionId,
      childActions: action.childActions,
    });

    // Use saved position or calculate default position
    const actionPosition = action.positionX !== undefined && action.positionY !== undefined
      ? { x: action.positionX, y: action.positionY }
      : { x: 250 + (index % 4) * 200, y: 250 + Math.floor(index / 4) * 150 };

    nodes.push({
      id: nodeId,
      type: 'default',
      position: actionPosition,
      data: {
        id: nodeId,
        type: action.type as ActionType,
        name: action.name,
        config: action.config,
        retryConfig: action.retryConfig,
      },
    });
  });

  // Find root actions (actions without parentActionId or with order 0)
  const rootActions = workflow.actions.filter(
    (action: any) => !action.parentActionId && action.order === 0
  );
  console.log(`🎨 [WorkflowConverter] Found ${rootActions.length} root actions:`, rootActions.map((a: any) => a.id));

  // Connect trigger to root action(s)
  if (workflow.trigger && rootActions.length > 0) {
    // For now, connect trigger to the first root action
    const firstRootAction = rootActions[0];
    const firstRootNodeId = actionIdToNodeId.get(firstRootAction.id);
    console.log(`🎨 [WorkflowConverter] Connecting trigger to root action ${firstRootAction.id} (nodeId: ${firstRootNodeId})`);
    if (firstRootNodeId) {
      edges.push({
        id: `trigger-${firstRootNodeId}`,
        source: 'trigger',
        target: firstRootNodeId,
        type: 'smoothstep',
        animated: true,
      });
      console.log(`✅ [WorkflowConverter] Created trigger edge: trigger -> ${firstRootNodeId}`);
    }
  }

  // Add edges based on nextActionId and parent-child relationships
  workflow.actions.forEach((action: any, index: number) => {
    const sourceNodeId = `action-${action.id || index}`;

    // Connect to next action if exists (for sequential flow)
    if (action.nextActionId !== undefined && action.nextActionId !== null) {
      const targetNodeId = actionIdToNodeId.get(action.nextActionId);
      if (targetNodeId) {
        // Check if edge already exists (avoid duplicates)
        const existingEdge = edges.find(
          (e) => e.source === sourceNodeId && e.target === targetNodeId,
        );
        if (!existingEdge) {
          edges.push({
            id: `${sourceNodeId}-next-${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            type: 'smoothstep',
            animated: true,
          });
        }
      }
    }

    // Connect parallel actions from config.actionIds
    // This is the primary method - config.actionIds should contain real action IDs after saving
    if (action.type === ActionType.PARALLEL && action.config?.actionIds) {
      const actionIds = Array.isArray(action.config.actionIds) ? action.config.actionIds as number[] : [];
      console.log(`🎨 [WorkflowConverter] Parallel action ${action.id} has actionIds:`, actionIds);
      
      if (actionIds.length === 0) {
        console.warn(`⚠️ [WorkflowConverter] Parallel action ${action.id} has empty actionIds array`);
      }
      
      actionIds.forEach((targetActionId: number) => {
        const targetNodeId = actionIdToNodeId.get(targetActionId);
        console.log(`🎨 [WorkflowConverter] Parallel action ${action.id} -> action ${targetActionId} (nodeId: ${targetNodeId})`);
        if (targetNodeId) {
          // Check if edge already exists (avoid duplicates)
          const existingEdge = edges.find(
            (e) => e.source === sourceNodeId && e.target === targetNodeId,
          );
          if (!existingEdge) {
            edges.push({
              id: `${sourceNodeId}-parallel-${targetNodeId}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'smoothstep',
              animated: true,
            });
            console.log(`✅ [WorkflowConverter] Created edge from config.actionIds: ${sourceNodeId} -> ${targetNodeId}`);
          } else {
            console.log(`⚠️ [WorkflowConverter] Edge already exists: ${sourceNodeId} -> ${targetNodeId}`);
          }
        } else {
          console.warn(`⚠️ [WorkflowConverter] Could not find nodeId for action ${targetActionId} in actionIdToNodeId map`);
          console.warn(`⚠️ [WorkflowConverter] Available action IDs in map:`, Array.from(actionIdToNodeId.keys()));
        }
      });
    }
    
    // Also check for childActions relationship (if available in response)
    // This is a fallback if actionIds is not set correctly
    if (action.type === ActionType.PARALLEL && action.childActions && Array.isArray(action.childActions) && action.childActions.length > 0) {
      console.log(`🎨 [WorkflowConverter] Parallel action ${action.id} has childActions:`, action.childActions);
      action.childActions.forEach((childAction: any) => {
        const childId = typeof childAction === 'object' ? childAction.id : childAction;
        const targetNodeId = actionIdToNodeId.get(childId);
        if (targetNodeId) {
          // Check if edge already exists (avoid duplicates)
          const existingEdge = edges.find(
            (e) => e.source === sourceNodeId && e.target === targetNodeId,
          );
          if (!existingEdge) {
            edges.push({
              id: `${sourceNodeId}-parallel-child-${targetNodeId}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'smoothstep',
              animated: true,
            });
            console.log(`✅ [WorkflowConverter] Created edge from childActions: ${sourceNodeId} -> ${targetNodeId}`);
          } else {
            console.log(`⚠️ [WorkflowConverter] Edge from childActions already exists: ${sourceNodeId} -> ${targetNodeId}`);
          }
        } else {
          console.warn(`⚠️ [WorkflowConverter] Could not find nodeId for childAction ${childId}`);
        }
      });
    }

    // Handle parent-child relationships from parentActionId
    // This creates edges FROM the parent TO this child action
    // This is important for parallel children, especially if config.actionIds is missing or incomplete
    if (action.parentActionId) {
      const parentNodeId = actionIdToNodeId.get(action.parentActionId);
      console.log(`🎨 [WorkflowConverter] Action ${action.id} has parentActionId: ${action.parentActionId} (parentNodeId: ${parentNodeId})`);
      if (parentNodeId) {
        // Check if edge already exists (avoid duplicates)
        const existingEdge = edges.find(
          (e) => e.source === parentNodeId && e.target === sourceNodeId,
        );
        if (!existingEdge) {
          // Find parent action to determine its type
          const parentAction = workflow.actions.find((a: any) => a.id === action.parentActionId);
          console.log(`🎨 [WorkflowConverter] Found parent action:`, parentAction);
          
          if (parentAction) {
            const isParallel = parentAction.type === ActionType.PARALLEL;
            
            // Always create edge from parent to child if parentActionId exists
            // The duplicate check above ensures we don't create duplicate edges
            // For parallel actions, this is a fallback if config.actionIds doesn't work
            edges.push({
              id: `${parentNodeId}-parent-${sourceNodeId}`,
              source: parentNodeId,
              target: sourceNodeId,
              type: 'smoothstep',
              animated: true,
            });
            console.log(`✅ [WorkflowConverter] Created edge from parentActionId: ${parentNodeId} -> ${sourceNodeId} (parent type: ${parentAction.type})`);
          } else {
            console.warn(`⚠️ [WorkflowConverter] Parent action ${action.parentActionId} not found in workflow.actions`);
          }
        } else {
          console.log(`ℹ️ [WorkflowConverter] Edge already exists from parentActionId: ${parentNodeId} -> ${sourceNodeId} (likely created from config.actionIds or other method)`);
        }
      } else {
        console.warn(`⚠️ [WorkflowConverter] Could not find parentNodeId for parentActionId ${action.parentActionId}`);
        console.warn(`⚠️ [WorkflowConverter] Available action IDs in map:`, Array.from(actionIdToNodeId.keys()));
      }
    }

  });

  console.log(`🎨 [WorkflowConverter] Final edge summary:`, {
    totalEdges: edges.length,
    edges: edges.map(e => `${e.source} -> ${e.target}`),
  });
  console.log(`🎨 [WorkflowConverter] Final node summary:`, {
    totalNodes: nodes.length,
    nodeIds: nodes.map(n => n.id),
  });

  return { nodes, edges };
}

