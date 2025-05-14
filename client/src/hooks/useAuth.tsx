import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  isOnline: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  
  // Check for stored user on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem("forum-user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Connect to WebSocket for online status
        connectWebSocket(parsedUser.id);
      } catch (error) {
        console.error("Failed to parse stored user", error);
        localStorage.removeItem("forum-user");
      }
    }
  }, []);
  
  // Setup WebSocket connection for tracking online status - temporarily disabled
  const connectWebSocket = (userId: number) => {
    console.log("WebSocket functionality temporarily disabled");
    
    // Set user as online via REST API as a fallback
    fetch("/api/users/online", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId })
    }).catch(err => console.error("Failed to set user online:", err));
  };
  
  const login = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    const userData = await response.json();
    
    setUser(userData);
    localStorage.setItem("forum-user", JSON.stringify(userData));
    
    // Connect to WebSocket for online status
    connectWebSocket(userData.id);
  };
  
  const register = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/register", { username, password });
    const userData = await response.json();
    
    setUser(userData);
    localStorage.setItem("forum-user", JSON.stringify(userData));
    
    // Connect to WebSocket for online status
    connectWebSocket(userData.id);
  };
  
  const logout = async () => {
    if (user) {
      try {
        await apiRequest("POST", "/api/auth/logout", { userId: user.id });
      } catch (error) {
        console.error("Error during logout:", error);
      }
    }
    
    setUser(null);
    localStorage.removeItem("forum-user");
  };
  
  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
