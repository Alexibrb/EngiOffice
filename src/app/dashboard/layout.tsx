
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DashboardNav } from '@/components/dashboard-nav';
import { Header } from '@/components/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import type { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseAuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUser({ uid: fbUser.uid, ...userDoc.data() } as User);
          } else {
             // Handle case where user exists in Auth but not Firestore
             setUser(null);
             router.push('/');
          }
        } catch (error) {
            console.error("Error fetching user role:", error);
            setUser(null);
            router.push('/');
        }

      } else {
        setUser(null);
        setFirebaseUser(null);
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);
  
  const authContextValue = { user, firebaseUser, loading };


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; 
  }

  return (
     <AuthContext.Provider value={authContextValue}>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <div className="hidden md:block">
              <DashboardNav />
            </div>
            <div className="flex flex-1 flex-col">
              <Header />
              <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </AuthContext.Provider>
  );
}
