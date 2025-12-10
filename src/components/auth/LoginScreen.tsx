"use client";

import { useAuth } from "@/hooks/useAuth";

interface LoginScreenProps {
  error?: string | null;
}

export function LoginScreen({ error }: LoginScreenProps) {
  const { login, isLoading } = useAuth();

  return (
    <div className="login-screen">
      <div className="login-container">
        <h1 className="login-title">aili5</h1>
        <p className="login-subtitle">
          A toy for learning about LLMs
        </p>

        {error && (
          <div className="login-error">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="login-actions">
          <button
            className="login-button login-button-primary"
            onClick={() => login("US")}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Log in with PostHog (US)"}
          </button>
          <button
            className="login-button login-button-secondary"
            onClick={() => login("EU")}
            disabled={isLoading}
          >
            Log in with PostHog (EU)
          </button>
        </div>

        <p className="login-note">
          Sign in with your PostHog account to use the LLM gateway.
        </p>
      </div>
    </div>
  );
}
