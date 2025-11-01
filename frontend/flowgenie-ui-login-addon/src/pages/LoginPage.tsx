import React from "react";
import LoginForm from "../components/LoginForm";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-6">
      <LoginForm onSuccess={login} />
    </div>
  );
}
