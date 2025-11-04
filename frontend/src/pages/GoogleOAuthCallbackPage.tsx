import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

/**
 * OAuth Callback Page for Google Integration
 * Handles redirect after Google OAuth connection
 * Routes:
 * - /integrations/google/success - Success callback
 * - /integrations/google/error - Error callback
 */
const GoogleOAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      if (error) {
        console.error('❌ [GoogleOAuthCallback] OAuth error:', error);
        setStatus('error');
        setMessage(error === 'access_denied' 
          ? 'You cancelled the Google account connection.'
          : `Connection failed: ${error}`
        );
        return;
      }

      if (code && state) {
        // Success case - code and state are present
        // The backend should have already processed this in the callback endpoint
        // We just need to refresh the user data
        try {
          console.log('✅ [GoogleOAuthCallback] OAuth success, refreshing user data...');
          
          if (refreshUser) {
            await refreshUser();
          }

          setStatus('success');
          setMessage('Google account connected successfully!');
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
        } catch (err: any) {
          console.error('❌ [GoogleOAuthCallback] Failed to refresh user:', err);
          setStatus('error');
          setMessage('Connection succeeded, but failed to update user data. Please refresh the page.');
        }
      } else {
        // No code/state - might be a direct visit or invalid callback
        console.warn('⚠️ [GoogleOAuthCallback] Invalid callback - no code or state');
        setStatus('error');
        setMessage('Invalid callback. Please try connecting again from the workflow builder.');
        
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, refreshUser, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          {status === 'loading' && (
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Connecting Google account...</h2>
              <p className="text-sm text-gray-600">Please wait while we verify your connection.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">✅ Gmail Connected Successfully!</h2>
              <p className="text-sm text-gray-600 mb-4">{message}</p>
              <p className="text-xs text-gray-500">Redirecting to dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Failed</h2>
              <p className="text-sm text-gray-600 mb-4">{message}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleOAuthCallbackPage;

