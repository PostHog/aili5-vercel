"use client";

import { useAuth } from "@/hooks/useAuth";

export function AuthButton() {
  const { isAuthenticated, isLoading, projectId, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-button auth-loading">
        <span className="loading-spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="auth-status">
        <span className="auth-info">
          Project #{projectId}
        </span>
        <button
          className="auth-button auth-logout"
          onClick={logout}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-buttons">
      <button
        className="auth-button auth-login"
        onClick={() => login("US")}
      >
        Log in with PostHog
      </button>
    </div>
  );
}
