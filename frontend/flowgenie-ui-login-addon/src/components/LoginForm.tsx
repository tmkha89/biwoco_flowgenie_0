import React, { useState } from "react";

type Props = {
  onSuccess: (token: string) => void;
};

export default function LoginForm({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // use the api wrapper (provided in src/api/auth.ts)
      const { login } = await import("../api/auth");
      const res = await login({ email, password });
      onSuccess(res.token);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md bg-white/80 p-8 rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-6 text-center">Sign in to FlowGenie</h2>
      <label className="block mb-4">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-1 focus:ring-indigo-500 p-2"
          placeholder="you@example.com"
        />
      </label>
      <label className="block mb-4">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-1 focus:ring-indigo-500 p-2"
          placeholder="••••••••"
        />
      </label>
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        className="w-full py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-70"
        disabled={loading}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
