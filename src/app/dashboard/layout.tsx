
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { DashboardNav } from '@/components/dashboard-nav';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { CompanyData } from '@/lib/types';
import Image from 'next/image';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { SidebarProvider } from '@/components/ui/sidebar';


const CompanyDataContext = createContext<CompanyData | null>(null);

export const useCompanyData = () => {
    return useContext(CompanyDataContext);
}

function CompanyHeader({ companyData }: { companyData: CompanyData | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 px-4">
      <div className="flex items-center gap-4">
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
            <h1 className="text-lg font-bold text-foreground">{companyData?.companyName || 'Empresa/Profissional'}</h1>
            <p className="text-sm text-muted-foreground italic">{companyData?.slogan || 'Slogan/Profissão'}</p>
            <p className="text-xs text-muted-foreground">{companyData?.address || 'Endereço da empresa'}</p>
            <p className="text-xs text-muted-foreground">
                {companyData?.phone && <span>{companyData.phone}</span>}
                {(companyData?.phone && (companyData?.cnpj || companyData?.crea)) && <span className="mx-2">|</span>}
                {companyData?.cnpj && <span>CNPJ: {companyData.cnpj}</span>}
                {(companyData?.cnpj && companyData?.crea) && <span className="mx-2">|</span>}
                {companyData?.crea && <span>CREA: {companyData.crea}</span>}
            </p>
        </div>
      </div>
      <ThemeSwitcher />
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
    <SidebarProvider>
      <CompanyDataContext.Provider value={companyData}>
          <div className="flex min-h-screen w-full">
            <aside className="hidden md:block w-72 border-r bg-background">
              <DashboardNav />
            </aside>
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-auto flex-col border-b bg-background">
                  <CompanyHeader companyData={companyData} />
              </header>
              <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <Header />
                {children}
              </main>
            </div>
          </div>
      </CompanyDataContext.Provider>
    </SidebarProvider>
  );
}
