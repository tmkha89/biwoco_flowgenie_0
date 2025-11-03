import { apiClient } from './axios';

export interface SlackConnectionStatus {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  userId?: string;
}

/**
 * Start Slack OAuth flow
 * Redirects user to Slack authorization page
 */
export const startSlackOAuth = async (): Promise<void> => {
  try {
    console.log('📡 [API] GET /slack/oauth/start - Request sent');
    const baseURL = apiClient.defaults.baseURL || '';
    // Get auth token from localStorage
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    // Redirect to backend OAuth start endpoint
    window.location.href = `${baseURL}/slack/oauth/start`;
  } catch (err: any) {
    console.error('❌ [API] GET /slack/oauth/start - Error:', err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to start Slack OAuth');
  }
};

/**
 * Check Slack connection status for current user
 */
export const getSlackConnectionStatus = async (): Promise<SlackConnectionStatus> => {
  try {
    console.log('📡 [API] GET /slack/status - Request sent');
    const res = await apiClient.get<SlackConnectionStatus>('/slack/status');
    console.log('✅ [API] GET /slack/status - Response received', res.data);
    return res.data;
  } catch (err: any) {
    console.error('❌ [API] Error checking Slack connection:', err);
    return { connected: false };
  }
};

/**
 * Test Slack connection by sending a test message
 */
export const testSlackConnection = async (channelId: string, message: string): Promise<any> => {
  try {
    console.log('📡 [API] POST /slack/test - Request sent');
    const res = await apiClient.post('/slack/test', { channelId, message });
    console.log('✅ [API] POST /slack/test - Response received');
    return res.data;
  } catch (err: any) {
    console.error('❌ [API] POST /slack/test - Error:', err);
    throw new Error(err.response?.data?.message || err.message || 'Failed to test Slack connection');
  }
};

