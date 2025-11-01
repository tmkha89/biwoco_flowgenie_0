export const login = async (username: string, password: string) => {
  if (username === 'admin' && password === '123456') {
    localStorage.setItem('flowgenie_token', 'mock-token')
    return { success: true }
  }
  throw new Error('Invalid credentials')
}

export const logout = () => {
  localStorage.removeItem('flowgenie_token')
}
