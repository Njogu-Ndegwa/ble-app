"use client";
import React, { createContext, useState, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { SIGN_IN_USER } from "../mutations";
import { ApolloError } from "@apollo/client";

interface AuthContextType {
  user: any;
  distributorId: string | null;
  loading: boolean;
  error: any;
  signIn: (credentials: { email: string; password: string }) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [error, setError] = useState<ApolloError | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const storedDistributorId = localStorage.getItem("distributorId");
    const storedUser = localStorage.getItem("user");

    if (storedDistributorId) {
      setDistributorId(storedDistributorId);
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser)); // Assuming user is stored as a JSON string
    }
  }, []);

  const [signInUser] = useMutation(SIGN_IN_USER, {
    onCompleted: (data) => {
      const { accessToken, _id } = data.signInUser;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("distributorId", _id);
      //61811cc2bf5a3f81fbeb5d41
      console.log("Access Token:", accessToken);
      console.log("User Data:", _id);
      setUser(data.signInUser.name);
      setDistributorId(_id);
      router.push("/keypad/keypad");
    },
    onError: (error) => {
      setError(error);
    },
  });

  const signIn = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      await signInUser({ variables: { signInCredentials: credentials } });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("distributorId");
    setUser(null);
    setDistributorId(null);
    router.push("/signin");
  };

  return (
    <AuthContext.Provider
      value={{ user, distributorId, loading, error, signIn, signOut }}
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
