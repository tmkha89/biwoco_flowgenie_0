import Navbar from '../components/Navbar';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'

const DashboardPage = () => {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Wait until initialization is complete
    if (!isInitializing) {
      // 2. Only check authentication status AFTER initialization is done
      if (!isAuthenticated) {
        // Redirect to the login page and replace history entry
        navigate('/login', { replace: true }); 
      }
    }
  }, [isAuthenticated, isInitializing, navigate]);

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">
          {user?.name ? `Welcome, ${user.name}!` : ''}
        </h2>
        <p className="text-gray-600">
          {user ? 'You are logged in 🎉' : ''}
        </p>
      </div>
    </div>
  )
}

export default DashboardPage
