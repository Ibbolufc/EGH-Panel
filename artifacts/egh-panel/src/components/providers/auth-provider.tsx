import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, useGetMe } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem("egh_token"));

  const { data: user, isLoading: isUserLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false
    }
  });

  useEffect(() => {
    if (error) {
      localStorage.removeItem("egh_token");
      setToken(null);
      queryClient.clear();
    }
  }, [error, queryClient]);

  const login = (newToken: string) => {
    localStorage.setItem("egh_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("egh_token");
    setToken(null);
    // Clear the entire query cache so stale user data does not survive the
    // logout.  Without this, useGetMe returns its cached result even after
    // `enabled` flips to false, ProtectedRoute sees a non-null user and
    // never redirects to /login.
    queryClient.clear();
  };

  const isLoading = isUserLoading && !!token;

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
