import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define User type
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

// API Base URL - change this to your backend URL
const API_URL = 'http://10.7.20.255:5000/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Load user from storage on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          setAuthToken(token);
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // Helper function to make authenticated requests
  const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await AsyncStorage.getItem('authToken');
    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Create an error with additional properties
        const error = new Error(data.error || 'Login failed');
        (error as any).requiresVerification = data.requiresVerification || false;
        (error as any).statusCode = response.status;
        throw error;
      }

      // Save token and user data
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      setAuthToken(data.token);
      setUser(data.user);
    } catch (error) {
      throw error;
    }
  };

  // Register function
  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Don't auto-login after registration, user needs to verify email
      // But we can store the user data temporarily if needed
      if (data.user) {
        // Store user data but not logged in state
        await AsyncStorage.setItem('pendingVerificationEmail', email);
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Verify email with token
  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/verify-email?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email verification failed');
      }

      // Update user if already logged in
      if (user) {
        const updatedUser = { ...user, emailVerified: true };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      // Clear pending verification email
      await AsyncStorage.removeItem('pendingVerificationEmail');

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Resend verification email
  const resendVerification = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email');
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Clear stored data
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('pendingVerificationEmail');
      
      setAuthToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  // Complete onboarding
  const completeOnboarding = async () => {
    if (user) {
      const updatedUser = { ...user, onboardingCompleted: true };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Update user data
  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Check if user is authenticated
  const isAuthenticated = async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('authToken');
    return !!token && !!user;
  };

  // Get current user's token
  const getToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem('authToken');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        verifyEmail,
        resendVerification,
        completeOnboarding,
        updateUser,
      }}
    >
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