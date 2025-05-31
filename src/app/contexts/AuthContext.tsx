import { createContext, useContext, ReactNode } from 'react';

interface User {
  uid: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
}

const AuthContext = createContext<AuthContextType>({ user: null });

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Implement your authentication logic here
  const value = {
    user: null // Replace with actual user state
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 