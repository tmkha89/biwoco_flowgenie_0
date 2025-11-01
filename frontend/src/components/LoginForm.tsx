import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const LoginForm = () => {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md w-80 mx-auto mt-20">
      <h1 className="text-2xl font-semibold mb-4 text-center">FlowGenie Login</h1>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <input
        className="border p-2 w-full rounded mb-3"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        className="border p-2 w-full rounded mb-3"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2 w-full rounded">
        Login
      </button>
    </form>
  )
}

export default LoginForm
