type LoginRequest = { email: string; password: string; };

export async function login(payload: LoginRequest): Promise<{ token: string }> {
  // Minimal mock: accept any non-empty credentials and return a mock token.
  // Replace this with real Axios call to your backend:
  // return axios.post("/api/auth/login", payload).then(r => r.data)
  const { email, password } = payload;
  await new Promise((r) => setTimeout(r, 600)); // fake latency
  if (!email || !password) throw new Error("Missing credentials");
  return { token: "mock-token-" + btoa(email) };
}
