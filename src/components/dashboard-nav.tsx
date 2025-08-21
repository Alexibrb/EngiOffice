
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
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { UserNav } from './user-nav';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from 'react';
import { cn } from '@/lib/utils';


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
  const [isOpen, setIsOpen] = useState(false);
  const isActive = links.some(link => pathname.startsWith(link.href));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn(
            "flex w-full items-center justify-between rounded-md p-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
             isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="py-2 pl-6">
            {links.map((link) => (
                <SidebarMenuItem key={link.href}>
                <Link href={link.href} passHref>
                    <SidebarMenuButton
                    isActive={pathname === link.href}
                    asChild
                    tooltip={link.label}
                    size="default"
                    variant="default"
                    >
                    <span>
                        <link.icon />
                        <span>{link.label}</span>
                    </span>
                    </SidebarMenuButton>
                </Link>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}


export function DashboardNav() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold font-headline">EngiOffice</span>
        </Link>
      </SidebarHeader>
      <SidebarFooter>
        <UserNav />
      </SidebarFooter>
      <SidebarContent>
        <SidebarMenu>
            <SidebarMenuItem>
                <Link href={dashboardLink.href} passHref>
                    <SidebarMenuButton
                    isActive={pathname === dashboardLink.href.split('?')[0]}
                    asChild
                    tooltip={dashboardLink.label}
                    size="default"
                    variant="default"
                    >
                    <span>
                        <dashboardLink.icon />
                        <span>{dashboardLink.label}</span>
                    </span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        <div className="flex flex-col gap-2 p-2">
            <NavGroup label="Cadastros" icon={Building2} links={cadastroLinks} pathname={pathname} />
            <NavGroup label="Financeiro" icon={Banknote} links={financeiroLinks} pathname={pathname} />
            <NavGroup label="Relatórios" icon={Presentation} links={relatoriosLinks} pathname={pathname} />
            <NavGroup label="Cálculos" icon={SquareFunction} links={calculosLinks} pathname={pathname} />
        </div>
       
        <SidebarSeparator />

         <SidebarMenu>
          {aiLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href} passHref>
                <SidebarMenuButton
                  isActive={pathname === link.href}
                  asChild
                  tooltip={link.label}
                  size="default"
                  variant="default"
                >
                  <span>
                    <link.icon />
                    <span>{link.label}</span>
                  </span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
