/**
 * React Flow canvas for workflow visualization
 */
import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Connection,
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';
import { WorkflowNode } from '../../types/workflow-builder';
import CustomNode from './CustomNode';

// Add custom styles for drag-over state and edge visibility
const dragOverStyle = `
  .react-flow__pane.drag-over {
    background-color: rgba(59, 130, 246, 0.05);
  }
  .react-flow__controls {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .react-flow__controls button {
    background: white;
    border: none;
    border-bottom: 1px solid #e5e7eb;
    color: #374151;
    width: 30px;
    height: 30px;
  }
  .react-flow__controls button:hover {
    background: #f3f4f6;
  }
  .react-flow__controls button:last-child {
    border-bottom: none;
  }
  .react-flow__minimap {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  /* Edge styling for better visibility */
  .react-flow__edge {
    stroke-width: 3px;
  }
  .react-flow__edge-path {
    stroke: #6366f1;
    stroke-width: 3px;
  }
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #4f46e5;
    stroke-width: 4px;
  }
  .react-flow__connection-line {
    stroke: #6366f1;
    stroke-width: 3px;
    stroke-dasharray: 5,5;
  }
  /* Handle styling */
  .react-flow__handle {
    width: 16px;
    height: 16px;
    border: 2px solid white;
    background: #3b82f6;
  }
  .react-flow__handle-top {
    top: -8px;
  }
  .react-flow__handle-bottom {
    bottom: -8px;
  }
  .react-flow__handle-connecting {
    background: #10b981;
  }
  .react-flow__handle-valid {
    background: #10b981;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = dragOverStyle;
  if (!document.head.querySelector('style[data-react-flow-custom]')) {
    styleSheet.setAttribute('data-react-flow-custom', 'true');
    document.head.appendChild(styleSheet);
  }
}

const nodeTypes: NodeTypes = {
  default: CustomNode,
};

const WorkflowCanvasInner = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
  } = useWorkflowBuilderStore();
  const { screenToFlowPosition } = useReactFlow();

  const onNodeClick = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    console.log('🎨 [WorkflowCanvas] Node clicked:', node.id);
    selectNode(node as WorkflowNode);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    console.log('🎨 [WorkflowCanvas] Pane clicked, deselecting node');
    selectNode(null);
  }, [selectNode]);

  // Get onConnect from store
  const handleConnect = useCallback(
    (connection: Connection) => {
      console.log('🎨 [WorkflowCanvas] Connection attempt:', connection);
      onConnect(connection);
    },
    [onConnect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const actionType = event.dataTransfer.getData('application/reactflow');
      if (!actionType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      console.log('🎨 [WorkflowCanvas] Action dropped on canvas:', { actionType, position });
      addNode(actionType as any, position);
    },
    [screenToFlowPosition, addNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Add visual feedback when dragging over canvas
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('application/reactflow')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Only set to false if we're leaving the canvas entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDropWithFeedback = useCallback(
    (event: React.DragEvent) => {
      setIsDragOver(false);
      onDrop(event);
    },
    [onDrop],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      deleteKeyCode={['Backspace', 'Delete']}
      onNodesDelete={(deleted) => {
        // Prevent deleting trigger node
        const triggerNodes = deleted.filter((node) => node.data?.type === 'trigger');
        if (triggerNodes.length > 0) {
          console.log('🎨 [WorkflowCanvas] Cannot delete trigger node');
          return;
        }
        // Allow deletion of other nodes
        onNodesChange(deleted.map((node) => ({ type: 'remove' as const, id: node.id })));
      }}
      onDrop={handleDropWithFeedback}
      onDragOver={onDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={1}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      attributionPosition="bottom-left"
      style={{ width: '100%', height: '100%' }}
      zoomOnScroll={true}
      zoomOnPinch={true}
      panOnScroll={false}
      panOnDrag={true}
      className={isDragOver ? 'drag-over' : ''}
      connectionLineStyle={{ strokeWidth: 3, stroke: '#6366f1' }}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 3, stroke: '#6366f1' },
      }}
    >
      <Background color="#e5e7eb" gap={16} />
      <Controls 
        showZoom={true}
        showFitView={true}
        showInteractive={true}
        style={{
          bottom: '10px',
          left: '10px',
        }}
      />
      <MiniMap
        nodeColor={(node) => {
          const data = node.data as WorkflowNode['data'];
          if (data.status === 'completed') return '#10b981';
          if (data.status === 'failed') return '#ef4444';
          if (data.status === 'running') return '#3b82f6';
          return '#6b7280';
        }}
        maskColor="rgba(0, 0, 0, 0.1)"
        style={{
          bottom: '10px',
          right: '10px',
        }}
      />
    </ReactFlow>
  );
};

const WorkflowCanvas = () => {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <WorkflowCanvasInner />
      </ReactFlowProvider>
    </div>
  );
};

export default WorkflowCanvas;

