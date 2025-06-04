"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, ApolloError } from "@apollo/client";
import { SIGN_IN_USER, REFRESH_TOKEN } from "../mutations";

interface AuthContextType {
  user: any;
  distributorId: string | null;
  loading: boolean;
  error: any;
  signIn: (credentials: { email: string; password: string }) => void;
  signOut: () => void;
  isAccessTokenValid: () => boolean;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApolloError | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedDistributorId = localStorage.getItem("distributorId");
    const storedUser = localStorage.getItem("user");
    const storedAccessToken = localStorage.getItem("access_token");
    const storedRefreshToken = localStorage.getItem("refresh_token");

    if (storedDistributorId) {
      setDistributorId(storedDistributorId);
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    if (storedAccessToken && storedRefreshToken && !isAccessTokenValid()) {
      refreshAccessToken().catch(() => {
        signOut();
      });
    }
  }, []);

  const [signInUser] = useMutation(SIGN_IN_USER, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, _id, name } = data.signInUser;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("distributorId", _id);
      localStorage.setItem("user", JSON.stringify({ name }));
      setUser(name);
      setDistributorId(_id);
      router.push("/keypad/keypad");
    },
    onError: (error) => {
      setError(error);
    },
  });

  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN, {
    onCompleted: (data) => {
      const { accessToken, refreshToken } = data.refreshToken;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
    },
    onError: (error) => {
      console.error("Token refresh failed:", error);
      signOut();
    },
  });

  const isAccessTokenValid = (): boolean => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return false;

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const expiry = payload.exp * 1000; // Convert seconds to milliseconds
      return Date.now() < expiry;
    } catch (e) {
      console.error("Failed to decode token:", e);
      return false;
    }
  };

  const refreshAccessToken = async (): Promise<void> => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }
    try {
      await refreshTokenMutation({ variables: { refreshToken } });
    } catch (err) {
      console.error("Refresh token error:", err);
      throw err;
    }
  };

  const signIn = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      await signInUser({ variables: { signInCredentials: credentials } });
    } catch (err) {
      console.error(err);
      setError(err as ApolloError);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("distributorId");
    localStorage.removeItem("user");
    setUser(null);
    setDistributorId(null);
    router.push("/signin");
  };

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