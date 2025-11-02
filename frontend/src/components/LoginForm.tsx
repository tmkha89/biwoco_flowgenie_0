import { useState } from 'react'
import { useAuth } from '../context/AuthContext' 
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'

const LoginForm = () => {
  const { login, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password) 
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async (credentialResponse: any) => {
    try {
      const token = credentialResponse.credential
      if (!token) throw new Error('No credential returned')

      const decoded: any = jwtDecode(token)
      console.log('Google user decoded:', decoded)

      await loginWithGoogle(token) 
      window.location.href = '/dashboard'
    } catch (error) {
      console.error(error)
      setError('Google Login Failed')
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md w-80 mx-auto mt-20">
      <h1 className="text-2xl font-semibold mb-4 text-center">FlowGenie Login</h1>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          className="border p-2 w-full rounded mb-3"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="border p-2 w-full rounded mb-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 w-full rounded disabled:opacity-60"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="text-center mt-3">
        <a href="/signup" className="text-sm text-blue-600 hover:underline">
          Create an account
        </a>
      </div>

      <div className="mt-4 text-center">
        <GoogleLogin
          onSuccess={handleGoogleLogin}
          onError={() => setError('Google Login Failed')}
        />
      </div>
    </div>
  )
}

export default LoginForm