
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  LayoutDashboard,
  Sparkles,
  Truck,
  Users,
  Wrench,
  HandCoins,
  Building2,
  ArrowDown,
  ArrowUp,
  Calculator,
  LineChart,
  ClipboardList,
  FileText,
  Banknote,
  Presentation,
  SquareFunction,
  ChevronDown,
  StickyNote,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { UserNav } from './user-nav';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { AuthorizedUser } from '@/lib/types';
import Image from 'next/image';


const dashboardLink = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const allNavLinks = [
  {
    group: 'Cadastros',
    icon: Building2,
    links: [
      { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
      { href: '/dashboard/servicos', label: 'Serviços', icon: Wrench },
      { href: '/dashboard/fornecedores', label: 'Fornecedores', icon: Truck },
      { href: '/dashboard/funcionarios', label: 'Funcionários', icon: Briefcase, admin: true },
    ],
  },
  {
    group: 'Financeiro',
    icon: Banknote,
    links: [
      { href: '/dashboard/contas-a-pagar', label: 'Despesas', icon: ArrowDown },
      { href: '/dashboard/pagamentos', label: 'Folha de Pagamento', icon: HandCoins, admin: true },
      { href: '/dashboard/contas-a-receber', label: 'Contas a Receber', icon: ArrowUp },
      { href: '/dashboard/comissoes', label: 'Comissões', icon: HandCoins, admin: true },
    ],
  },
  {
    group: 'Relatórios',
    icon: Presentation,
    links: [
        { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
        { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart, admin: true },
    ],
  },
  {
    group: 'Cálculos',
    icon: SquareFunction,
    links: [
        { href: '/dashboard/quantitativo', label: 'Quantitativo', icon: ClipboardList },
        { href: '/dashboard/calculadora', label: 'Calculadora', icon: Calculator },
    ],
  },
   {
    group: 'Organização',
    icon: StickyNote,
    links: [
      { href: '/dashboard/anotacoes', label: 'Anotações', icon: StickyNote },
    ],
  },
    {
    group: 'IA',
    icon: Sparkles,
    links: [
        { href: '/dashboard/timeline-sugestoes', label: 'Sugestões IA', icon: Sparkles },
    ]
  }
];

function NavGroup({
  label,
  icon: Icon,
  links,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  links: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  const isActive = links.some(link => pathname.startsWith(link.href));
  const [isOpen, setIsOpen] = useState(isActive);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button className={cn(
            "flex w-full items-center justify-between rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
             isActive && "bg-accent text-accent-foreground"
        )}>
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-2 pl-8 flex flex-col gap-1">
            {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-2 text-sm hover:bg-accent/50",
                    pathname === link.href && "bg-accent text-accent-foreground"
                  )}
                >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                </Link>
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


export function DashboardNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as AuthorizedUser;
            setIsAdmin(userData.role === 'admin');
        } else {
            setIsAdmin(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const navLinks = useMemo(() => {
    if (isAdmin) {
      return allNavLinks;
    }
    return allNavLinks.map(group => ({
      ...group,
      links: group.links.filter(link => !link.admin)
    })).filter(group => group.links.length > 0);
  }, [isAdmin]);

  return (
    <div className="flex h-full flex-col">
       <header className="flex h-16 items-center border-b px-4 shrink-0">
         <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
           <Image
              src="/logonovo.png"
              alt="EngiOffice Logo"
              width={24}
              height={24}
              className="text-primary"
              data-ai-hint="application logo"
            />
           <span className="font-headline text-lg">EngiOffice</span>
         </Link>
       </header>
       <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
         <Link
            href={dashboardLink.href}
            className={cn(
                "flex items-center gap-3 rounded-md p-2 text-base font-medium hover:bg-accent",
                pathname === dashboardLink.href && "bg-accent text-accent-foreground"
            )}
            >
            <dashboardLink.icon className="h-5 w-5" />
            {dashboardLink.label}
         </Link>
         {navLinks.map((group) => (
            <NavGroup key={group.group} label={group.group} icon={group.icon} links={group.links} pathname={pathname} />
         ))}
       </nav>
        <div className="mt-auto border-t p-4">
          <UserNav />
        </div>
    </div>
  );
}

