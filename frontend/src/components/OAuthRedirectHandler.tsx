import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import your hook

const OAuthRedirectHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, logout } = useAuth(); // Assume setTokens is available

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // 1. Save tokens to state/localStorage
      setTokens(accessToken, refreshToken);
      
      // 2. Redirect to the main application page
      navigate('/', { replace: true });

    } else {
      // Handle the error case (e.g., if the backend failed and redirected to this route without tokens)
      const error = searchParams.get('oauthError');
      console.error('OAuth Redirect Error:', error);
      
      // Clear any potential partial state and redirect to login
      logout(); 
      navigate('/login', { replace: true });
    }
  }, [searchParams, setTokens, logout, navigate]);

  // Display a loading message while processing the redirect
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      Authenticating... Please wait.
    </div>
  );
};

export default OAuthRedirectHandler;