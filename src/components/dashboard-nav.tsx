
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
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { UserNav } from './user-nav';

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

export function DashboardNav() {
  const pathname = usePathname();

  const renderLinks = (links: typeof cadastroLinks) => {
    return links.map((link) => (
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
      ));
  }

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
        
         <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
                <Building2 className="mr-2"/>
                Cadastros
            </SidebarGroupLabel>
            <SidebarMenu>
                {renderLinks(cadastroLinks)}
            </SidebarMenu>
        </SidebarGroup>
        
        <SidebarSeparator />

        <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
                <Banknote className="mr-2"/>
                Financeiro
            </SidebarGroupLabel>
            <SidebarMenu>
                {renderLinks(financeiroLinks)}
            </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
                <Presentation className="mr-2"/>
                Relatórios
            </SidebarGroupLabel>
            <SidebarMenu>
                {renderLinks(relatoriosLinks)}
            </SidebarMenu>
        </SidebarGroup>
        
        <SidebarSeparator />
        
        <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
                <SquareFunction className="mr-2"/>
                Cálculos
            </SidebarGroupLabel>
            <SidebarMenu>
                {renderLinks(calculosLinks)}
            </SidebarMenu>
        </SidebarGroup>

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
