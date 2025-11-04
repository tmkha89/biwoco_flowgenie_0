/**
 * Properties panel for editing selected node configuration
 */
import { useWorkflowBuilderStore } from '../../store/workflow-builder.store';
import { ActionType } from '../../types/workflow-builder';
import { TriggerType } from '../../types/workflows';
import { useAuth } from '../../context/AuthContext';
import { useGoogleIntegration } from '../../hooks/useGoogleIntegration';
import { useEffect, useRef } from 'react';

const PropertiesPanel = () => {
  const { selectedNode, updateNode, deleteNode, setTrigger, trigger, workflowMeta, setWorkflowMeta } = useWorkflowBuilderStore();
  const { user } = useAuth();
  const { isConnected, isConnecting, connect, checkStatus } = useGoogleIntegration();
  
  // Track if we've already checked status for the current trigger type
  const hasCheckedStatusRef = useRef<string | null>(null);

  // Auto-set userId when Gmail trigger is selected and user is logged in
  useEffect(() => {
    if (selectedNode?.data.type === 'trigger' && trigger.type === TriggerType.GOOGLE_MAIL && user?.id) {
      const currentUserId = trigger.config?.userId;
      if (!currentUserId || currentUserId !== user.id) {
        // Auto-use current user ID
        const updateConfig = (updates: Record<string, any>) => {
          setTrigger({
            type: trigger.type,
            config: { ...trigger.config, ...updates },
          });
        };
        updateConfig({ userId: user.id });
      }
    }
  }, [selectedNode, trigger.type, user?.id, trigger.config?.userId, setTrigger]);

  // Check Google connection status when Gmail trigger is selected (only once per trigger type change)
  useEffect(() => {
    if (selectedNode?.data.type === 'trigger' && trigger.type === TriggerType.GOOGLE_MAIL) {
      // Only call checkStatus once when trigger type changes to GOOGLE_MAIL
      const triggerKey = `${trigger.type}-${selectedNode?.id}`;
      if (hasCheckedStatusRef.current !== triggerKey) {
        hasCheckedStatusRef.current = triggerKey;
        checkStatus();
      }
    } else {
      // Reset the ref when trigger type is not GOOGLE_MAIL
      hasCheckedStatusRef.current = null;
    }
  }, [selectedNode?.id, trigger.type, checkStatus]);

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
                defaultConfig = { userId: user?.id, labelIds: ['INBOX'] };
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
            {/* Google Connection Status */}
            {!isConnected ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                      Connect your Google account
                    </h4>
                    <p className="text-xs text-yellow-700 mb-3">
                      To activate the Gmail Trigger, you need to connect your Google account first. This allows FlowGenie to listen for new emails automatically.
                    </p>
                    <button
                      type="button"
                      onClick={connect}
                      disabled={isConnecting}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      {isConnecting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Connect with Google
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">
                    ✅ Gmail connected successfully
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Your Google account is connected. The Gmail Trigger will automatically activate when you save this workflow.
                </p>
              </div>
            )}

            {/* Gmail Configuration (only shown when connected) */}
            {isConnected && (
              <>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                    Gmail Trigger Settings
                  </h4>
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
              </>
            )}
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
                onClick={connect}
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

