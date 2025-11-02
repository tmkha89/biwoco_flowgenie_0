import React, { createContext, useState, useEffect, useContext } from 'react';
// 👈 IMPORT ALL NECESSARY API FUNCTIONS
import { 
    getCurrentUser, 
    refreshToken as apiRefreshToken, 
    login as apiLogin, // Renamed to avoid context function name conflict
    googleLogin as apiGoogleLogin // Renamed
} from '../api/auth';
import { useNavigate, useLocation } from 'react-router-dom';

// ----------------------------------------------------------------------------------------------------------------
// NOTE: I'm assuming your API returns an object with access_token and refresh_token upon successful login.
// ----------------------------------------------------------------------------------------------------------------

interface AuthContextType {
  user: any;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  isInitializing: boolean;
}

export const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const setTokens = (access: string, refresh: string) => {
    setAccessToken(access);
    setRefreshTokenValue(refresh);
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  };

  const navigate = useNavigate();

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshTokenValue(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };


  const fetchUser = async (access: string) => {
    try {
        const userData = await getCurrentUser(access);
        setUser(userData);
    } catch (error) {
        console.error("Failed to fetch user after login", error);
        // If fetching user fails, log out to clear bad tokens
        logout();
        throw error;
    }
  };

  const login = async (email: string, password: string) => {
    // 1. Call API
    const data = await apiLogin(email, password);
    const { access_token, refresh_token } = data;
    
    // 2. Update state and localStorage
    setTokens(access_token, refresh_token);
    
    // 3. Fetch and set user (assuming access_token is valid now)
    await fetchUser(access_token);
  };

  const loginWithGoogle = async (token: string) => {
    // 1. Call API
    const data = await apiGoogleLogin(token);
    const { access_token, refresh_token } = data;
    
    // 2. Update state and localStorage
    setTokens(access_token, refresh_token);
    
    // 3. Fetch and set user (assuming access_token is valid now)
    await fetchUser(access_token);
  };

  // ----------------------------------------------------------------------------------------------------------------
  // Existing useEffect (Updated refresh token import)
  // ----------------------------------------------------------------------------------------------------------------

  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedAccess = localStorage.getItem('access_token');
      const storedRefresh = localStorage.getItem('refresh_token');

      if (storedAccess && storedRefresh) {
        setAccessToken(storedAccess);
        setRefreshTokenValue(storedRefresh);
        
        try {
          // 1. Try to fetch user with stored access token
          await getCurrentUser(storedAccess).then(setUser);
        } catch (error) {
          // 2. If access token is bad, try to refresh it
          try {
            const { access_token } = await apiRefreshToken(storedRefresh);
            setAccessToken(access_token);
            localStorage.setItem('access_token', access_token);
            // 3. Fetch user with the new access token
            await getCurrentUser(access_token).then(setUser);
          } catch (refreshError) {
            // 4. If refresh fails, log out
            logout();
          }
        }
      }
      
      // 5. CRITICAL: Set initializing to false ONLY after all checks are done
      setIsInitializing(false); 
    };

    checkAuthStatus();
    // No dependency on 'logout' or 'setUser' needed if they are stable functions or derived from dispatch
    // but include necessary dependencies if using the aliased API functions:
  }, []); // Run only once on mount

  return (
    <AuthContext.Provider value={{ 
      user, 
      accessToken, 
      refreshToken: refreshTokenValue, 
      setTokens, 
      logout, 
      isAuthenticated: !!accessToken,
      login,
      loginWithGoogle,
      isInitializing
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}