import React, { useState, useContext } from 'react';
import { signup } from '../api/auth';
import { AuthContext } from '../context/AuthContext';

export default function Signup() {
  const { setTokens } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await signup(name, username, email || undefined, password);
      setTokens(data.access_token, data.refresh_token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="p-6 bg-white shadow-lg rounded-lg w-80">
        <h2 className="text-2xl font-bold mb-4 text-center">Sign Up</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <input
          type="text"
          className="w-full border p-2 mb-3 rounded"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          className="w-full border p-2 mb-3 rounded"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          className="w-full border p-2 mb-3 rounded"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full border p-2 mb-3 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">Sign Up</button>
      </form>
    </div>
  );
}
