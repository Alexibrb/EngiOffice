
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
    <div className="flex items-center justify-between gap-4 py-3 px-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="shrink-0">
            {companyData?.logoUrl ? (
                <Image
                    src={companyData.logoUrl}
                    alt="Logo da Empresa"
                    width={120}
                    height={80}
                    className="rounded-md object-cover h-20 w-auto md:h-24"
                    data-ai-hint="company logo"
                />
            ) : (
               <div className="w-24 h-16 md:w-32 md:h-20 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-[10px] text-center" data-ai-hint="company logo placeholder">
                    Logo
               </div>
            )}
        </div>
        <div className="flex flex-col min-w-0 overflow-hidden">
            <h1 className="text-base md:text-xl font-bold text-foreground truncate">{companyData?.companyName || 'Empresa/Profissional'}</h1>
            <p className="text-xs md:text-sm text-muted-foreground italic truncate">{companyData?.slogan || 'Slogan/Profissão'}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">{companyData?.address || 'Endereço da empresa'}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] md:text-xs text-muted-foreground mt-0.5">
                {companyData?.phone && <span className="whitespace-nowrap">{companyData.phone}</span>}
                {(companyData?.phone && (companyData?.cnpj || companyData?.crea)) && <span className="hidden md:inline">|</span>}
                {companyData?.cnpj && <span className="whitespace-nowrap">CNPJ: {companyData.cnpj}</span>}
                {(companyData?.cnpj && companyData?.crea) && <span className="hidden md:inline">|</span>}
                {companyData?.crea && <span className="whitespace-nowrap font-medium">CREA: {companyData.crea}</span>}
            </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ThemeSwitcher />
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
    <SidebarProvider>
      <CompanyDataContext.Provider value={companyData}>
          <div className="flex min-h-screen w-full flex-col md:flex-row">
            <aside className="hidden md:block w-72 border-r bg-background shrink-0">
              <DashboardNav />
            </aside>
            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="flex h-auto flex-col border-b bg-background">
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
