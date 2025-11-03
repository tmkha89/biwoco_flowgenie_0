import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext' 
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'

const LoginForm = () => {
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔐 [LoginForm] Form submitted', { username: username.replace(/\S(?=\S{3})/g, '*') }) // Mask username
    setError(null)
    setLoading(true)

    try {
      console.log('🔐 [LoginForm] Calling login function...')
      await login(username, password) 
      console.log('✅ [LoginForm] Login successful, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      console.error('❌ [LoginForm] Login failed:', err)
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async (credentialResponse: any) => {
    console.log('🔐 [LoginForm] Google login initiated')
    try {
      const token = credentialResponse.credential
      if (!token) throw new Error('No credential returned')

      const decoded: any = jwtDecode(token)
      console.log('🔐 [LoginForm] Google user decoded:', { email: decoded.email, name: decoded.name })

      console.log('🔐 [LoginForm] Calling loginWithGoogle function...')
      await loginWithGoogle(token) 
      console.log('✅ [LoginForm] Google login successful, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      console.error('❌ [LoginForm] Google login failed:', error)
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