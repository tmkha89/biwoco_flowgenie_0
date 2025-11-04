/**
 * Sidebar component with draggable and clickable action types
 */
import React from 'react';
import { ACTION_TYPES } from '../../types/workflow-builder';
import { ActionType } from '../../types/workflow-builder';
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';

interface DraggableActionItemProps {
  actionType: typeof ACTION_TYPES[0];
}

const DraggableActionItem = ({ actionType }: DraggableActionItemProps) => {
  const { addNodeAtCenter } = useWorkflowBuilderStore();
  const dragStartRef = React.useRef(false);
  const nodeRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    dragStartRef.current = false;
  };

  const handleDragStart = (e: React.DragEvent) => {
    dragStartRef.current = true;
    e.dataTransfer.setData('application/reactflow', actionType.type);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add a custom drag image for better UX
    if (nodeRef.current) {
      const dragImage = nodeRef.current.cloneNode(true) as HTMLElement;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.opacity = '0.8';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
    
    console.log('🎨 [ActionSidebar] Drag started:', actionType.type);
  };

  const handleDragEnd = () => {
    dragStartRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click if it was part of a drag operation
    if (dragStartRef.current) {
      dragStartRef.current = false;
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎨 [ActionSidebar] Action clicked:', actionType.type);
    const newNode = addNodeAtCenter(actionType.type);
    
    // Select the newly added node so properties panel opens
    useWorkflowBuilderStore.getState().selectNode(newNode);
  };

  return (
    <div
      ref={nodeRef}
      draggable
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className="p-3 mb-2 rounded-lg cursor-move hover:shadow-md transition-all bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      title={`Click to add ${actionType.name} or drag to canvas`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{actionType.icon}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">{actionType.name}</div>
          <div className="text-xs text-gray-500">{actionType.description}</div>
        </div>
        <div className="text-xs text-gray-400">+</div>
      </div>
    </div>
  );
};

const ActionSidebar = () => {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Action Palette</h2>
        <p className="text-xs text-gray-600 mt-1">Click or drag actions to canvas</p>
      </div>
      <div className="p-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Actions</h3>
          {ACTION_TYPES.map((actionType) => (
            <DraggableActionItem key={actionType.type} actionType={actionType} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActionSidebar;

