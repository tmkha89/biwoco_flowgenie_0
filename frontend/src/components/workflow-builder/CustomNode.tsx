/**
 * Custom node component for React Flow
 */
import { Handle, Position } from 'reactflow';
import { WorkflowNodeData } from '../../types/workflow-builder';
import { ActionType, ACTION_TYPES } from '../../types/workflow-builder';

interface CustomNodeProps {
  data: WorkflowNodeData;
  selected: boolean;
}

const CustomNode = ({ data, selected }: CustomNodeProps) => {
  const actionConfig = data.type !== 'trigger' ? ACTION_TYPES.find((a) => a.type === data.type) : null;
  const icon = actionConfig?.icon || '⚙️';
  const name = data.name || 'Unnamed';
  const status = data.status;

  // Status colors
  const statusColors = {
    completed: 'border-green-500',
    failed: 'border-red-500',
    running: 'border-blue-500',
    pending: 'border-gray-300',
  };

  const statusBg = {
    completed: 'bg-green-100',
    failed: 'bg-red-100',
    running: 'bg-blue-100',
    pending: '',
  };

  return (
    <div
      className={`relative px-4 py-3 rounded-lg shadow-md min-w-[150px] ${
        selected ? 'ring-2 ring-blue-500' : ''
      } ${status ? statusBg[status] : ''} ${status ? statusColors[status] : 'border-2 border-gray-300'}`}
      style={{
        background: data.type === 'trigger' ? '#4F46E5' : actionConfig?.color || '#6b7280',
        color: 'white',
      }}
    >
      {/* Input handle - only for non-trigger nodes */}
      {data.type !== 'trigger' && (
        <Handle 
          type="target" 
          position={Position.Top} 
          className="!bg-blue-500 !w-4 !h-4 !border-2 !border-white"
          style={{ zIndex: 10 }}
        />
      )}
      
      <div className="text-center">
        <div className="text-2xl mb-1">{icon}</div>
        <div className="font-semibold text-sm">{name}</div>
        {data.type !== 'trigger' && (
          <div className="text-xs opacity-80 mt-1">{actionConfig?.name || data.type}</div>
        )}
        
        {status && (
          <div className="mt-2 text-xs font-medium">
            {status === 'completed' && '✅ Completed'}
            {status === 'failed' && '❌ Failed'}
            {status === 'running' && '⏳ Running'}
            {status === 'pending' && '⏸ Pending'}
          </div>
        )}

        {data.error && (
          <div className="mt-2 text-xs text-red-200 bg-red-900/30 rounded px-2 py-1">
            {data.error}
          </div>
        )}
      </div>

      {/* Output handles */}
      {data.type === 'trigger' ? (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="!bg-green-500 !w-4 !h-4 !border-2 !border-white"
          style={{ zIndex: 10 }}
        />
      ) : data.type === 'conditional' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-green-500 !w-4 !h-4 !border-2 !border-white"
            style={{ left: '30%', zIndex: 10 }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-red-500 !w-4 !h-4 !border-2 !border-white"
            style={{ left: '70%', zIndex: 10 }}
          />
        </>
      ) : data.type === 'parallel' || data.type === 'loop' ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-yellow-500 !w-4 !h-4 !border-2 !border-white"
          style={{ zIndex: 10 }}
        />
      ) : (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="!bg-green-500 !w-4 !h-4 !border-2 !border-white"
          style={{ zIndex: 10 }}
        />
      )}
    </div>
  );
};

export default CustomNode;

