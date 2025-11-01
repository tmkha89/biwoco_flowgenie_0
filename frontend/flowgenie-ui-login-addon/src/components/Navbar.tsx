import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="w-full bg-white/90 shadow p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-bold text-xl">FlowGenie</Link>
      </div>
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">Hello</span>
            <button
              onClick={logout}
              className="px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-100">Login</Link>
        )}
      </div>
    </nav>
  );
}
