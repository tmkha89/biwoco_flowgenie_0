import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  login: (user: string, pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  console.log('AuthProvider mounted ✅')
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('flowgenie_token')
  )

  const handleLogin = async (user: string, pass: string) => {
    if (user === 'admin' && pass === '123456') {
      localStorage.setItem('flowgenie_token', 'mock-token')
      setIsAuthenticated(true)
    } else {
      throw new Error('Invalid credentials')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('flowgenie_token')
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login: handleLogin, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
