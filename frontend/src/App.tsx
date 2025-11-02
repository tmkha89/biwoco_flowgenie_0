import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SignupPage from './pages/SignupPage'
import ProtectedRoute from './routes/ProtectedRoute'
import OAuthRedirectHandler from './components/OAuthRedirectHandler'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
          <Routes>
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/oauth-redirect" element={<OAuthRedirectHandler />} />
          </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
