"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuthStatus } from "@/app/api/auth/status/route";

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/status");
      const status: AuthStatus = await response.json();
      setAuthStatus(status);
    } catch (error) {
      console.error("Failed to check auth status:", error);
      setAuthStatus({ isAuthenticated: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((region: "US" | "EU" = "US") => {
    window.location.href = `/api/auth/login?region=${region}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthStatus({ isAuthenticated: false });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }, []);

  return {
    isAuthenticated: authStatus?.isAuthenticated ?? false,
    isLoading,
    projectId: authStatus?.projectId,
    region: authStatus?.region,
    login,
    logout,
    refresh: checkAuth,
  };
}
