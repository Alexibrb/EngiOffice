
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  LayoutDashboard,
  Rocket,
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
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserNav } from './user-nav';
import { Separator } from './ui/separator';

const dashboardLink = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const cadastroLinks = [
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Wrench },
  { href: '/dashboard/fornecedores', label: 'Fornecedores', icon: Truck },
  { href: '/dashboard/funcionarios', label: 'Funcionários', icon: Briefcase },
];

const financeiroLinks = [
  { href: '/dashboard/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowDown },
  { href: '/dashboard/contas-a-receber', label: 'Contas a Receber', icon: ArrowUp },
  { href: '/dashboard/comissoes', label: 'Comissões', icon: HandCoins },
];

const relatoriosLinks = [
    { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
    { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
];

const calculosLinks = [
    { href: '/dashboard/quantitativo', label: 'Quantitativo', icon: ClipboardList },
    { href: '/dashboard/calculadora', label: 'Calculadora', icon: Calculator },
];

const aiLinks = [
    {
    href: '/dashboard/timeline-sugestoes',
    label: 'Sugestões IA',
    icon: Sparkles,
  },
]

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


export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
       <header className="flex h-16 items-center border-b px-4 shrink-0">
         <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
           <Rocket className="h-6 w-6 text-primary" />
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
        <Separator />
        <NavGroup label="Cadastros" icon={Building2} links={cadastroLinks} pathname={pathname} />
        <NavGroup label="Financeiro" icon={Banknote} links={financeiroLinks} pathname={pathname} />
        <NavGroup label="Relatórios" icon={Presentation} links={relatoriosLinks} pathname={pathname} />
        <NavGroup label="Cálculos" icon={SquareFunction} links={calculosLinks} pathname={pathname} />
        <Separator />
        <Link
            href={aiLinks[0].href}
            className={cn(
                "flex items-center gap-3 rounded-md p-2 text-base font-medium hover:bg-accent",
                pathname === aiLinks[0].href && "bg-accent text-accent-foreground"
            )}
            >
            <aiLinks[0].icon className="h-5 w-5" />
            {aiLinks[0].label}
         </Link>
       </nav>
        <div className="mt-auto border-t p-4">
          <UserNav />
        </div>
    </div>
  );
}
