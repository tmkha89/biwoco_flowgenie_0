import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SignupPage from './pages/SignupPage'
import WorkflowListPage from './pages/WorkflowListPage'
import WorkflowEditorPage from './pages/WorkflowEditorPage'
import WorkflowBuilderPage from './pages/WorkflowBuilderPage'
import WorkflowRunPage from './pages/WorkflowRunPage'
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
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute><WorkflowListPage /></ProtectedRoute>} />
            <Route path="/workflows/new" element={<ProtectedRoute><WorkflowBuilderPage /></ProtectedRoute>} />
            <Route path="/workflows/:id/edit" element={<ProtectedRoute><WorkflowBuilderPage /></ProtectedRoute>} />
            <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowBuilderPage /></ProtectedRoute>} />
            <Route path="/workflows/:id/execute" element={<ProtectedRoute><WorkflowRunPage /></ProtectedRoute>} />
            <Route path="/oauth-redirect" element={<OAuthRedirectHandler />} />
          </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
