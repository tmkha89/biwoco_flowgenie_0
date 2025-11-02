/**
 * Properties panel for editing selected node configuration
 */
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';
import { ActionType } from '../../types/workflow-builder';
import { TriggerType } from '../../types/workflows';

const PropertiesPanel = () => {
  const { selectedNode, updateNode, setTrigger, trigger, workflowMeta, setWorkflowMeta } = useWorkflowBuilderStore();

  if (!selectedNode) {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 h-full p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Properties</h3>
        <p className="text-gray-500 text-sm">Select a node to edit its properties</p>
      </div>
    );
  }

  const handleConfigChange = (key: string, value: any) => {
    updateNode(selectedNode.id, {
      config: {
        ...selectedNode.data.config,
        [key]: value,
      },
    });
  };

  const handleNameChange = (name: string) => {
    updateNode(selectedNode.id, { name });
  };

  // Trigger node properties
  if (selectedNode.data.type === 'trigger') {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 h-full overflow-y-auto p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Trigger Properties</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={trigger.type}
            onChange={(e) => setTrigger({ type: e.target.value as TriggerType, config: trigger.config })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value={TriggerType.MANUAL}>Manual</option>
            <option value={TriggerType.WEBHOOK}>Webhook</option>
            <option value={TriggerType.GOOGLE}>Google</option>
            <option value={TriggerType.SCHEDULE}>Schedule</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Config (JSON)</label>
          <textarea
            value={JSON.stringify(trigger.config, null, 2)}
            onChange={(e) => {
              try {
                const config = JSON.parse(e.target.value);
                setTrigger({ type: trigger.type, config });
              } catch {
                // Invalid JSON, ignore
              }
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs"
            rows={8}
          />
        </div>
      </div>
    );
  }

  // Action node properties
  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 h-full overflow-y-auto p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Action Properties</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={selectedNode.data.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Action name"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <input
          type="text"
          value={selectedNode.data.type}
          disabled
          className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
        />
      </div>

      {/* HTTP Request Config */}
      {selectedNode.data.type === ActionType.HTTP_REQUEST && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              value={selectedNode.data.config.method || 'GET'}
              onChange={(e) => handleConfigChange('method', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              type="text"
              value={selectedNode.data.config.url || ''}
              onChange={(e) => handleConfigChange('url', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="https://api.example.com/endpoint"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Headers (JSON)</label>
            <textarea
              value={JSON.stringify(selectedNode.data.config.headers || {}, null, 2)}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value);
                  handleConfigChange('headers', headers);
                } catch {
                  // Invalid JSON
                }
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (JSON)</label>
            <textarea
              value={JSON.stringify(selectedNode.data.config.body || {}, null, 2)}
              onChange={(e) => {
                try {
                  const body = JSON.parse(e.target.value);
                  handleConfigChange('body', body);
                } catch {
                  // Invalid JSON
                }
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs"
              rows={4}
            />
          </div>
        </div>
      )}

      {/* Email Config */}
      {selectedNode.data.type === ActionType.EMAIL && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="email"
              value={selectedNode.data.config.to || ''}
              onChange={(e) => handleConfigChange('to', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="recipient@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="email"
              value={selectedNode.data.config.from || ''}
              onChange={(e) => handleConfigChange('from', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="sender@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={selectedNode.data.config.subject || ''}
              onChange={(e) => handleConfigChange('subject', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Email subject"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={selectedNode.data.config.body || ''}
              onChange={(e) => handleConfigChange('body', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={6}
              placeholder="Email body"
            />
          </div>
        </div>
      )}

      {/* Wait Config */}
      {selectedNode.data.type === ActionType.WAIT && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <input
            type="text"
            value={selectedNode.data.config.duration || ''}
            onChange={(e) => handleConfigChange('duration', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="5s, 10m, 2h"
          />
          <p className="text-xs text-gray-500 mt-1">Format: 5s, 10m, 2h, or milliseconds</p>
        </div>
      )}

      {/* Conditional Config */}
      {selectedNode.data.type === ActionType.CONDITIONAL && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
          <textarea
            value={selectedNode.data.config.condition || ''}
            onChange={(e) => handleConfigChange('condition', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs"
            rows={4}
            placeholder="{{step.1.output.data.status}} == 'active'"
          />
          <p className="text-xs text-gray-500 mt-1">
            Connect edges to set true/false branches. First edge = true, second edge = false
          </p>
        </div>
      )}

      {/* Loop Config */}
      {selectedNode.data.type === ActionType.LOOP && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Items Path</label>
            <input
              type="text"
              value={selectedNode.data.config.itemsPath || ''}
              onChange={(e) => handleConfigChange('itemsPath', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="step.1.output.data.items"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Variable</label>
            <input
              type="text"
              value={selectedNode.data.config.itemVariable || 'item'}
              onChange={(e) => handleConfigChange('itemVariable', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <p className="text-xs text-gray-500">Connect edge to set loop body action</p>
        </div>
      )}

      {/* Parallel Config */}
      {selectedNode.data.type === ActionType.PARALLEL && (
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedNode.data.config.waitForAll !== false}
              onChange={(e) => handleConfigChange('waitForAll', e.target.checked)}
              className="mr-2"
            />
            <label className="text-sm text-gray-700">Wait for all actions to complete</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedNode.data.config.stopOnFirstFailure === true}
              onChange={(e) => handleConfigChange('stopOnFirstFailure', e.target.checked)}
              className="mr-2"
            />
            <label className="text-sm text-gray-700">Stop on first failure</label>
          </div>
          <p className="text-xs text-gray-500">Connect multiple edges to execute actions in parallel</p>
        </div>
      )}

      {/* Retry Config */}
      <div className="mt-6 pt-4 border-t border-gray-300">
        <label className="block text-sm font-medium text-gray-700 mb-2">Retry Configuration</label>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <select
              value={selectedNode.data.retryConfig?.type || 'fixed'}
              onChange={(e) =>
                updateNode(selectedNode.id, {
                  retryConfig: {
                    type: e.target.value as 'fixed' | 'exponential',
                    delay: selectedNode.data.retryConfig?.delay || 1000,
                  },
                })
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="fixed">Fixed</option>
              <option value="exponential">Exponential</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Delay (ms)</label>
            <input
              type="number"
              value={selectedNode.data.retryConfig?.delay || 1000}
              onChange={(e) =>
                updateNode(selectedNode.id, {
                  retryConfig: {
                    type: selectedNode.data.retryConfig?.type || 'fixed',
                    delay: parseInt(e.target.value, 10) || 1000,
                  },
                })
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              min="100"
              step="100"
            />
          </div>
        </div>
      </div>

      {/* Advanced Config */}
      <div className="mt-6 pt-4 border-t border-gray-300">
        <label className="block text-sm font-medium text-gray-700 mb-2">Advanced Config (JSON)</label>
        <textarea
          value={JSON.stringify(selectedNode.data.config, null, 2)}
          onChange={(e) => {
            try {
              const config = JSON.parse(e.target.value);
              updateNode(selectedNode.id, { config });
            } catch {
              // Invalid JSON
            }
          }}
          className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs"
          rows={8}
        />
      </div>
    </div>
  );
};

export default PropertiesPanel;

