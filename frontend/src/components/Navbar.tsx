import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const { logout } = useAuth()

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between">
      <h1 className="font-semibold">FlowGenie</h1>
      <button onClick={logout} className="bg-red-500 px-3 py-1 rounded">
        Logout
      </button>
    </nav>
  )
}

export default Navbar
