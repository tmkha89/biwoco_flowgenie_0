/**
 * Properties panel for editing selected node configuration
 */
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';
import { ActionType } from '../../types/workflow-builder';
import { TriggerType } from '../../types/workflows';
import { useAuth } from '../../context/AuthContext';
import { connectGoogle } from '../../api/auth';

const PropertiesPanel = () => {
  const { selectedNode, updateNode, deleteNode, setTrigger, trigger, workflowMeta, setWorkflowMeta } = useWorkflowBuilderStore();
  const { user } = useAuth();

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

  const handleDelete = () => {
    if (!selectedNode) return;
    
    // Don't allow deleting trigger node
    if (selectedNode.data.type === 'trigger') {
      alert('Cannot delete trigger node - it is required');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${selectedNode.data.name}"?`)) {
      deleteNode(selectedNode.id);
      // Deselect node after deletion
      useWorkflowBuilderStore.getState().selectNode(null);
    }
  };

  // Trigger node properties
  if (selectedNode.data.type === 'trigger') {
    const updateConfig = (updates: Record<string, any>) => {
      setTrigger({
        type: trigger.type,
        config: { ...trigger.config, ...updates },
      });
    };

    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 h-full overflow-y-auto p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Trigger Properties</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={trigger.type}
            onChange={(e) => {
              const newType = e.target.value as TriggerType;
              // Reset config when type changes
              let defaultConfig: Record<string, any> = {};
              if (newType === TriggerType.WEBHOOK) {
                defaultConfig = { path: '', secret: '' };
              } else if (newType === TriggerType.GOOGLE_MAIL) {
                defaultConfig = { userId: undefined, labelIds: ['INBOX'] };
              } else if (newType === TriggerType.SCHEDULE) {
                defaultConfig = { cron: '', interval: undefined, timezone: 'UTC' };
              }
              setTrigger({ type: newType, config: defaultConfig });
            }}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value={TriggerType.MANUAL}>Manual</option>
            <option value={TriggerType.WEBHOOK}>Webhook</option>
            <option value={TriggerType.GOOGLE_MAIL}>Google-Mail</option>
            <option value={TriggerType.SCHEDULE}>Schedule</option>
          </select>
        </div>

        {/* Webhook Configuration */}
        {trigger.type === TriggerType.WEBHOOK && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook Path (optional)
              </label>
              <input
                type="text"
                value={trigger.config?.path || ''}
                onChange={(e) => updateConfig({ path: e.target.value })}
                placeholder="auto-generated"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate a unique webhook ID
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret (optional)
              </label>
              <input
                type="password"
                value={trigger.config?.secret || ''}
                onChange={(e) => updateConfig({ secret: e.target.value })}
                placeholder="Webhook secret for validation"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional secret to validate webhook requests
              </p>
            </div>
            {trigger.config?.webhookUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <label className="block text-sm font-medium text-blue-800 mb-1">
                  Webhook URL
                </label>
                <code className="text-xs text-blue-700 break-all">
                  {window.location.origin}{trigger.config.webhookUrl}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Google-Mail Configuration */}
        {trigger.type === TriggerType.GOOGLE_MAIL && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={trigger.config?.userId || user?.id || ''}
                  onChange={(e) => updateConfig({ userId: parseInt(e.target.value) || undefined })}
                  placeholder="User ID with Google OAuth"
                  className="flex-1 border border-gray-300 rounded px-3 py-2"
                />
                {user?.id && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ userId: user.id })}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm whitespace-nowrap"
                    title="Use your current user ID"
                  >
                    Use Mine
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {user?.id ? (
                  <>
                    Your User ID: <strong>{user.id}</strong>. Make sure this user has authenticated with Google OAuth.
                    {trigger.config?.userId && trigger.config.userId !== user.id && (
                      <span className="block mt-1 text-amber-600">
                        ⚠️ Using different User ID. Ensure that user has Google OAuth enabled.
                      </span>
                    )}
                  </>
                ) : (
                  'User ID who has authenticated with Google OAuth. Click "Use Mine" to use your current user ID.'
                )}
              </p>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>How to get User ID:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Use your current logged-in user ID (shown above)</li>
                  <li>Or enter another user's ID who has Google OAuth connected</li>
                  <li>Make sure the user has authenticated via Google OAuth first</li>
                  <li>Check the Users page or API to find user IDs</li>
                </ul>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gmail Labels (comma-separated)
              </label>
              <input
                type="text"
                value={Array.isArray(trigger.config?.labelIds) ? trigger.config.labelIds.join(', ') : 'INBOX'}
                onChange={(e) => {
                  const labels = e.target.value.split(',').map(l => l.trim()).filter(l => l);
                  updateConfig({ labelIds: labels.length > 0 ? labels : ['INBOX'] });
                }}
                placeholder="INBOX"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Gmail labels to watch (default: INBOX)
              </p>
              <details className="mt-2 text-xs">
                <summary className="text-blue-600 cursor-pointer hover:text-blue-800">
                  Common Gmail Labels
                </summary>
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <strong>System Labels:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-gray-700">
                    <li><code>INBOX</code> - New incoming messages (most common)</li>
                    <li><code>SENT</code> - Sent messages</li>
                    <li><code>TRASH</code> - Deleted messages</li>
                    <li><code>SPAM</code> - Spam messages</li>
                    <li><code>IMPORTANT</code> - Important messages</li>
                    <li><code>STARRED</code> - Starred messages</li>
                    <li><code>UNREAD</code> - Unread messages</li>
                  </ul>
                  <p className="mt-2 text-gray-600">
                    <strong>Custom Labels:</strong> You can also use custom labels you created in Gmail (case-sensitive).
                    Separate multiple labels with commas, e.g., <code>INBOX, IMPORTANT, MyCustomLabel</code>
                  </p>
                </div>
              </details>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pub/Sub Topic Name (optional)
              </label>
              <input
                type="text"
                value={trigger.config?.topicName || ''}
                onChange={(e) => updateConfig({ topicName: e.target.value })}
                placeholder="auto-generated"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate a unique topic name
              </p>
              <details className="mt-2 text-xs">
                <summary className="text-blue-600 cursor-pointer hover:text-blue-800">
                  How to set up Google Cloud Pub/Sub
                </summary>
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-gray-700">
                  <p className="mb-2"><strong>To use Google Mail trigger, you need:</strong></p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a Google Cloud Project (if you haven't)</li>
                    <li>Enable Gmail API and Pub/Sub API</li>
                    <li>Create a Pub/Sub topic in Google Cloud Console</li>
                    <li>Configure the topic name here (or leave blank for auto-generation)</li>
                    <li>Set up a subscription that points to: <code className="bg-gray-200 px-1 rounded">https://your-domain.com/api/triggers/gmail/pubsub</code></li>
                  </ol>
                  <p className="mt-2 text-xs text-gray-600">
                    <strong>Note:</strong> The Pub/Sub endpoint must be publicly accessible for Google to send notifications.
                  </p>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Schedule Configuration */}
        {trigger.type === TriggerType.SCHEDULE && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CRON Expression
              </label>
              <input
                type="text"
                value={trigger.config?.cron || ''}
                onChange={(e) => {
                  const cronValue = e.target.value;
                  updateConfig({ cron: cronValue, interval: cronValue ? undefined : trigger.config?.interval });
                }}
                placeholder="0 * * * * (every hour)"
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                CRON expression (e.g., "0 * * * *" for hourly, "0 0 * * *" for daily)
              </p>
            </div>
            <div className="text-center text-sm text-gray-500">OR</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interval (seconds)
              </label>
              <input
                type="number"
                value={trigger.config?.interval || ''}
                onChange={(e) => {
                  const intervalValue = parseInt(e.target.value);
                  updateConfig({
                    interval: intervalValue > 0 ? intervalValue : undefined,
                    cron: intervalValue > 0 ? undefined : trigger.config?.cron,
                  });
                }}
                placeholder="3600 (1 hour)"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Fixed interval in seconds (e.g., 3600 for hourly)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <input
                type="text"
                value={trigger.config?.timezone || 'UTC'}
                onChange={(e) => updateConfig({ timezone: e.target.value })}
                placeholder="UTC"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Timezone for CRON schedule (e.g., "America/New_York", "UTC")
              </p>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={trigger.config?.runImmediately !== false}
                  onChange={(e) => updateConfig({ runImmediately: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Run immediately on schedule creation</span>
              </label>
            </div>
          </div>
        )}

        {/* Manual Configuration */}
        {trigger.type === TriggerType.MANUAL && (
          <div className="text-sm text-gray-600">
            Manual triggers are executed via API calls. No configuration needed.
          </div>
        )}

        {/* Advanced Config (JSON) - Collapsible */}
        <div className="mt-4 border-t border-gray-300 pt-4">
          <details className="cursor-pointer">
            <summary className="text-sm font-medium text-gray-700 mb-2">
              Advanced Config (JSON)
            </summary>
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
              className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs mt-2"
              rows={8}
            />
          </details>
        </div>
      </div>
    );
  }

  // Action node properties
  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">Action Properties</h3>
        <button
          onClick={handleDelete}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          title="Delete action"
        >
          Delete
        </button>
      </div>

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
          {!user?.googleLinked && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-2">
                Google Account Required
              </h4>
              <p className="text-sm text-amber-700 mb-3">
                You need to connect your Google account to send emails via Gmail.
              </p>
              <button
                onClick={() => {
                  const accessToken = localStorage.getItem('access_token');
                  if (accessToken) {
                    connectGoogle(accessToken);
                  }
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Connect Google Account
              </button>
            </div>
          )}
          {user?.googleLinked && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-blue-600">✓</span>
                <span className="text-sm text-blue-800 font-medium">
                  Google account connected: {user.email}
                </span>
              </div>
            </div>
          )}
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

