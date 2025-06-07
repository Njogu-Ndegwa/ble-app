"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, ApolloError } from "@apollo/client";
import { SIGN_IN_USER, REFRESH_TOKEN } from "../mutations";

// Debug function to inspect token
const inspectToken = () => {
  console.log("[DEBUG] Entering inspectToken");
  const accessToken = localStorage.getItem("access_token");
  if (!accessToken) {
    console.error("[ERROR] No access token found in localStorage");
    return;
  }
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const expiry = payload.exp * 1000;
    const timeLeft = Math.round((expiry - Date.now()) / 1000);
    console.log("[INFO] Token inspection:", {
      payload,
      expiry: new Date(expiry).toISOString(),
      timeLeft: `${timeLeft}s`,
    });
  } catch (error) {
    console.error("[ERROR] Failed to inspect token:", error);
  }
};

// Debug function to manually trigger token check
const debugTokenCheck = async (refreshAccessToken: () => Promise<void>, isAccessTokenValid: (threshold?: number) => boolean, signOut: () => void) => {
  console.log("[DEBUG] Manual token check triggered");
  const ONE_HOUR = 1 * 60 * 60 * 1000;
  try {
    const isValid = isAccessTokenValid(ONE_HOUR);
    console.log(`[INFO] Token valid (within 1 hour): ${isValid}`);
    if (!isValid) {
      console.log("[INFO] Token is expired or near expiry, attempting refresh...");
      await refreshAccessToken();
      console.log("[INFO] Token refreshed successfully");
    } else {
      console.log("[INFO] Token is still valid, no refresh needed");
    }
  } catch (error) {
    console.error("[ERROR] Manual token check failed:", error);
    signOut();
  }
};

interface AuthContextType {
  user: any;
  distributorId: string | null;
  loading: boolean;
  error: any;
  signIn: (credentials: { email: string; password: string }) => void;
  signOut: () => void;
  isAccessTokenValid: (remainingTimeThreshold?: number) => boolean;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApolloError | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const [signInUser] = useMutation(SIGN_IN_USER, {
    onCompleted: (data) => {
      console.log("[DEBUG] signInUser onCompleted triggered");
      const { accessToken, refreshToken, _id, name } = data.signInUser;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("distributorId", _id);
      localStorage.setItem("user", JSON.stringify({ name }));
      setUser({ name });
      setDistributorId(_id);

      console.log("[INFO] Sign-in completed, setting up token refresh");
      setupTokenRefresh();
      router.push("/keypad/keypad");
    },
    onError: (error) => {
      console.error("[ERROR] Sign-in error:", error.message, error.graphQLErrors, error.networkError);
      setError(error);
    },
  });

  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN, {
    onCompleted: (data) => {
      console.log("[DEBUG] refreshTokenMutation onCompleted triggered", data);
      if (!data?.refreshClientAccessToken) {
        console.error("[ERROR] refreshClientAccessToken response is undefined or null");
        signOut();
        return;
      }
      const { accessToken, refreshToken } = data.refreshClientAccessToken;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      console.log("[INFO] Token refresh completed, new access token stored");
    },
    onError: (error) => {
      console.error("[ERROR] Token refresh failed:", error.message, error.graphQLErrors, error.networkError);
      signOut();
    },
  });

  const isAccessTokenValid = (remainingTimeThreshold: number = 0): boolean => {
    console.log("[DEBUG] Entering isAccessTokenValid");
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      console.log("[INFO] No access token found");
      return false;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const expiry = payload.exp * 1000;
      const timeLeft = expiry - Date.now();
      const isValid = timeLeft > remainingTimeThreshold;
      console.log(`[INFO] Token check: expiry=${new Date(expiry).toISOString()}, timeLeft=${Math.round(timeLeft / 1000)}s, valid=${isValid}`);
      return isValid;
    } catch (e) {
      console.error("[ERROR] Failed to decode token:", e);
      return false;
    }
  };

  const getTokenExpiryTime = (): number | null => {
    console.log("[DEBUG] Entering getTokenExpiryTime");
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      console.log("[INFO] No access token for expiry check");
      return null;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      console.log("[DEBUG] getTokenExpiryTime payload:", payload);
      return payload.exp * 1000;
    } catch (e) {
      console.error("[ERROR] Failed to decode token:", e);
      return null;
    }
  };

  const setupTokenRefresh = () => {
    console.log("[DEBUG] Entering setupTokenRefresh");
    if (refreshInterval) {
      clearInterval(refreshInterval);
      console.log("[INFO] Cleared existing refresh interval");
    }

    const checkAndRefreshToken = async () => {
      console.log("[INFO] Checking token status...");
      const ONE_HOUR = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

      const isValid = isAccessTokenValid(ONE_HOUR);
      if (!isValid) {
        console.log("[INFO] Token is expired or within 1 hour of expiry, attempting refresh...");
        try {
          await refreshAccessToken();
          console.log("[INFO] Token refreshed proactively");
        } catch (error) {
          console.error("[ERROR] Proactive token refresh failed:", error);
          signOut();
        }
      } else {
        console.log("[INFO] Token is still valid, no refresh needed");
      }
    };

    // Check every 10 seconds for testing visibility
    const interval = setInterval(() => {
      console.log("[INFO] Scheduled token check triggered");
      checkAndRefreshToken();
    }, 10 * 1000); // 10 seconds
    setRefreshInterval(interval);
    console.log("[INFO] Token refresh interval set up (every 10 seconds)");

    // Initial check
    checkAndRefreshToken();

    // Expose debug functions to window
    (window as any).inspectToken = inspectToken;
    (window as any).debugTokenCheck = () => debugTokenCheck(refreshAccessToken, isAccessTokenValid, signOut);
  };

  const refreshAccessToken = async (): Promise<void> => {
    console.log("[DEBUG] Entering refreshAccessToken");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      console.error("[ERROR] No refresh token available");
      throw new Error("No refresh token available");
    }
    console.log("[INFO] Initiating token refresh...");
    try {
      await refreshTokenMutation({ variables: { refreshToken } });
      console.log("[INFO] Refresh token mutation completed");
    } catch (err) {
      console.error("[ERROR] Refresh token error:", err);
      throw err;
    }
  };

  const signIn = async (credentials: { email: string; password: string }) => {
    console.log("[DEBUG] Entering signIn");
    setLoading(true);
    console.log("[INFO] Starting sign-in process...");
    try {
      await signInUser({ variables: { signInCredentials: credentials } });
      console.log("[INFO] Sign-in successful");
    } catch (err) {
      console.error("[ERROR] Sign-in failed:", err);
      setError(err as ApolloError);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    console.log("[DEBUG] Entering signOut");
    if (refreshInterval) {
      clearInterval(refreshInterval);
      console.log("[INFO] Refresh interval cleared during sign-out");
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("distributorId");
    localStorage.removeItem("user");
    setUser(null);
    setDistributorId(null);
    console.log("[INFO] Signed out, redirecting to /signin");
    router.push("/signin");
  };

  useEffect(() => {
    console.log("[DEBUG] AuthProvider useEffect triggered");
    const storedDistributorId = localStorage.getItem("distributorId");
    const storedUser = localStorage.getItem("user");
    const storedAccessToken = localStorage.getItem("access_token");
    const storedRefreshToken = localStorage.getItem("refresh_token");

    if (storedDistributorId) {
      setDistributorId(storedDistributorId);
      console.log(`[INFO] Loaded distributorId: ${storedDistributorId}`);
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      console.log("[INFO] Loaded user from localStorage");
    }
    if (storedAccessToken && storedRefreshToken) {
      console.log("[INFO] Found stored access and refresh tokens, validating...");
      if (!isAccessTokenValid()) {
        console.log("[INFO] Stored token is expired, attempting refresh...");
        refreshAccessToken().catch((err) => {
          console.error("[ERROR] Stored token refresh failed:", err);
          signOut();
        });
      } else {
        console.log("[INFO] Stored token is valid, setting up token refresh...");
        setupTokenRefresh();
      }
    } else {
      console.log("[INFO] No stored tokens found");
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        console.log("[INFO] Cleaned up refresh interval on unmount");
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, distributorId, loading, error, signIn, signOut, isAccessTokenValid, refreshAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};