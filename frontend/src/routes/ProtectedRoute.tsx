import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isInitializing } = useAuth()
  
  console.log('🛡️ [ProtectedRoute] Checking access', { isInitializing, isAuthenticated })
  
  // Wait for initialization to complete before checking auth status
  if (isInitializing) {
    console.log('🛡️ [ProtectedRoute] Still initializing, showing loading...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }
  
  // Only check authentication after initialization is complete
  if (!isAuthenticated) {
    console.log('🛡️ [ProtectedRoute] Not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }
  
  console.log('🛡️ [ProtectedRoute] Authenticated, allowing access')
  return children
}

export default ProtectedRoute
