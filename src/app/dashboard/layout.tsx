
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { DashboardNav } from '@/components/dashboard-nav';
import { Header } from '@/components/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
      } else {
        setFirebaseUser(null);
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!firebaseUser) {
    return null; 
  }

  return (
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
  );
}
