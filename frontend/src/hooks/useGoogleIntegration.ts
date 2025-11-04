import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectGoogle, disconnectGoogle } from '../api/auth';

/**
 * Hook for managing Google OAuth2 integration state
 * Provides connection status and connect/disconnect functions
 */
export const useGoogleIntegration = () => {
  const { user, accessToken, refreshUser } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Google account is connected
  const isConnected = user?.googleLinked === true;

  /**
   * Connect Google account
   * Redirects to backend OAuth2 flow
   */
  const connect = useCallback(async () => {
    if (!accessToken) {
      setError('You must be logged in to connect Google account');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🔗 [useGoogleIntegration] Connecting Google account...');
      await connectGoogle(accessToken);
      // The redirect will happen in connectGoogle, so we don't need to handle return here
    } catch (err: any) {
      console.error('❌ [useGoogleIntegration] Failed to connect Google:', err);
      setError(err.message || 'Failed to connect Google account');
      setIsConnecting(false);
    }
  }, [accessToken]);

  /**
   * Disconnect Google account
   */
  const disconnect = useCallback(async () => {
    if (!accessToken) {
      setError('You must be logged in to disconnect Google account');
      return;
    }

    setIsDisconnecting(true);
    setError(null);

    try {
      console.log('🔗 [useGoogleIntegration] Disconnecting Google account...');
      await disconnectGoogle(accessToken);
      
      // Refresh user data to update connection status
      if (refreshUser) {
        await refreshUser();
      }
      
      console.log('✅ [useGoogleIntegration] Google account disconnected');
    } catch (err: any) {
      console.error('❌ [useGoogleIntegration] Failed to disconnect Google:', err);
      setError(err.message || 'Failed to disconnect Google account');
    } finally {
      setIsDisconnecting(false);
    }
  }, [accessToken, refreshUser]);

  /**
   * Check connection status and refresh if needed
   */
  const checkStatus = useCallback(async () => {
    if (!accessToken || !refreshUser) return;
    
    try {
      await refreshUser();
    } catch (err) {
      console.error('❌ [useGoogleIntegration] Failed to check connection status:', err);
    }
  }, [accessToken, refreshUser]);

  return {
    isConnected,
    isConnecting,
    isDisconnecting,
    error,
    connect,
    disconnect,
    checkStatus,
  };
};

