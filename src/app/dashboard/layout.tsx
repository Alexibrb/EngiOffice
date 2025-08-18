
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { DashboardNav } from '@/components/dashboard-nav';
import { Header } from '@/components/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { CompanyData } from '@/lib/types';
import Image from 'next/image';


const CompanyDataContext = createContext<CompanyData | null>(null);

export const useCompanyData = () => {
    return useContext(CompanyDataContext);
}

function CompanyHeader({ companyData }: { companyData: CompanyData | null }) {
  return (
    <div className="flex items-center gap-4 p-4">
        {companyData?.logoUrl ? (
            <Image
                src={companyData.logoUrl}
                alt="Logo da Empresa"
                width={160}
                height={160}
                className="rounded-md object-contain self-start"
                data-ai-hint="company logo"
            />
        ) : (
           <div className="w-40 h-40 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs text-center" data-ai-hint="company logo placeholder">
                Logo Aqui
           </div>
        )}
      <div className="flex flex-col">
        <h1 className="text-lg font-bold text-foreground">{companyData?.companyName || 'Nome da Empresa'}</h1>
        <p className="text-sm text-muted-foreground italic">{companyData?.slogan || 'Slogan da empresa'}</p>
        <p className="text-xs text-muted-foreground">{companyData?.address || 'Endereço da empresa'}</p>
        <p className="text-xs text-muted-foreground">
            {companyData?.phone && <span>{companyData.phone}</span>}
            {companyData?.phone && companyData?.cnpj && <span className="mx-2">|</span>}
            {companyData?.cnpj && <span>{companyData.cnpj}</span>}
        </p>
      </div>
    </div>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const companyDocRef = doc(db, 'empresa', 'dados');
          const docSnap = await getDoc(companyDocRef);
          if (docSnap.exists()) {
            setCompanyData(docSnap.data() as CompanyData);
          }
        } catch (e) {
            console.error("Failed to fetch company data:", e)
        }
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
    <CompanyDataContext.Provider value={companyData}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <div className="hidden md:block">
            <DashboardNav />
          </div>
          <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-auto flex-col border-b bg-background">
                <Header />
                <CompanyHeader companyData={companyData} />
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CompanyDataContext.Provider>
  );
}
