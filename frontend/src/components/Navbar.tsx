import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const { logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    console.log('🚪 [Navbar] Logout button clicked');
    logout();
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-semibold text-xl hover:text-gray-300">
          FlowGenie
        </Link>
        {isAuthenticated && (
          <div className="flex gap-4">
            <Link to="/dashboard" className="hover:text-gray-300">
              Dashboard
            </Link>
            <Link to="/workflows" className="hover:text-gray-300">
              Workflows
            </Link>
          </div>
        )}
      </div>
      {isAuthenticated && (
        <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
          Logout
        </button>
      )}
    </nav>
  )
}

export default Navbar
