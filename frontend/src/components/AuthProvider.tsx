"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  uid: string | null;
  loading: boolean;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  uid: null,
  loading: true,
  getIdToken: async () => "",
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign in failed:", error);
          setLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const getIdToken = async () => {
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken(true);
  };

  return (
    <AuthContext.Provider value={{ user, uid: user?.uid || null, loading, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
