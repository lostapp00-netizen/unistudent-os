"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { useRouter, usePathname } from "next/navigation";

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true });

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
      
      // Protect routes: / is login page.
      if (!session?.user && pathname !== "/") {
        router.push("/");
      }
      if (session?.user && pathname === "/") {
        router.push("/dashboard");
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        if (!session?.user && pathname !== "/") {
          router.push("/");
        }
        if (session?.user && pathname === "/") {
          router.push("/dashboard");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
