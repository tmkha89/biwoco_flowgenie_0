import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { startSlackOAuth, getSlackConnectionStatus } from '../api/slack';
import type { SlackConnectionStatus } from '../api/slack';

const IntegrationsPage = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔌 [IntegrationsPage] Component mounted', { isInitializing, isAuthenticated });
    if (!isInitializing && !isAuthenticated) {
      console.log('🔌 [IntegrationsPage] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // Check for OAuth callback messages
    const error = searchParams.get('error');
    if (error) {
      setMessage(`Failed to connect Slack: ${error}`);
      setTimeout(() => setMessage(null), 5000);
    } else if (window.location.pathname.includes('/slack/oauth/success')) {
      setMessage('Successfully connected to Slack!');
      setTimeout(() => setMessage(null), 5000);
      // Reload connection status
      loadConnectionStatus();
    }

    if (isAuthenticated) {
      loadConnectionStatus();
    }
  }, [isAuthenticated, isInitializing, navigate, searchParams]);

  const loadConnectionStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getSlackConnectionStatus();
      setSlackStatus(status);
    } catch (error) {
      console.error('Failed to load Slack connection status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectSlack = async () => {
    try {
      await startSlackOAuth();
      // The OAuth flow will redirect the user
    } catch (error: any) {
      alert(`Failed to connect Slack: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-2">
            Connect your favorite services to automate your workflows
          </p>
          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.includes('Successfully')
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Slack Integration Card */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">💬</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Slack</h3>
                  <p className="text-sm text-gray-500">Team communication</p>
                </div>
              </div>
              {slackStatus.connected && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Connected
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Connect Slack to trigger workflows from messages, mentions, and reactions. Send
              automated messages to channels or users.
            </p>

            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-500">Features:</div>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Trigger on new messages</li>
                <li>Trigger on app mentions</li>
                <li>Trigger on reactions</li>
                <li>Send messages to channels</li>
                <li>Send direct messages</li>
              </ul>
            </div>

            {isLoading ? (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed"
              >
                Loading...
              </button>
            ) : slackStatus.connected ? (
              <div className="space-y-2">
                {slackStatus.teamName && (
                  <div className="text-sm text-gray-600">
                    Connected to: <span className="font-medium">{slackStatus.teamName}</span>
                  </div>
                )}
                <button
                  onClick={handleConnectSlack}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reconnect to Slack
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectSlack}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Connect to Slack
              </button>
            )}
          </div>

          {/* Placeholder for future integrations */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 opacity-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">📧</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Gmail</h3>
                <p className="text-sm text-gray-500">Coming soon</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Email integration for triggering workflows from incoming emails.
            </p>
            <button disabled className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;

