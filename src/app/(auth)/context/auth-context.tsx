"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, ApolloError } from "@apollo/client";
import { SIGN_IN_USER, REFRESH_TOKEN } from "../mutations";

// AuthContext and Provider
interface AuthContextType {
  user: any;
  distributorId: string | null;
  loading: boolean;
  error: any;
  signIn: (credentials: { email: string; password: string }) => void;
  signOut: () => void;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApolloError | null>(null);
  const router = useRouter();

  const [signInUser] = useMutation(SIGN_IN_USER, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, _id, name } = data.signInUser;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("distributorId", _id);
      localStorage.setItem("user", JSON.stringify({ name }));
      setUser({ name });
      setDistributorId(_id);
      router.push("/keypad/keypad");
    },
    onError: (error) => {
      setError(error);
    },
  });

  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN, {
    onCompleted: (data) => {
      const { accessToken, refreshToken } = data.refreshClientAccessToken;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
    },
    onError: (error) => {
      handleLogout();
    },
  });

  const isTokenExpired = (token: string): boolean => {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() > exp;
  };

  const refreshAccessToken = async (): Promise<void> => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }
    await refreshTokenMutation({ variables: { refreshToken } });
  };

  const signIn = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      await signInUser({ variables: { signInCredentials: credentials } });
    } catch (err) {
      setError(err as ApolloError);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    handleLogout();
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("distributorId");
    localStorage.removeItem("user");
    setUser(null);
    setDistributorId(null);
    router.push("/signin");
  };

  // Check online status and handle requests accordingly
  useEffect(() => {
    const handleOnline = () => {
      // Retry any failed requests here
    };

    const handleOffline = () => {
      console.log("You are offline.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial load of user data
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
    if (storedAccessToken && storedRefreshToken && isTokenExpired(storedAccessToken)) {
      // Refresh the token only if it has expired
      refreshAccessToken().catch(() => {
        handleLogout();
      });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, distributorId, loading, error, signIn, signOut, refreshAccessToken }}>
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