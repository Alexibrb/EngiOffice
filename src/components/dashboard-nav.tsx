
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  CircleDollarSign,
  FileText,
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
  CreditCard,
  Calculator,
  LineChart,
  ClipboardList,
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

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Wrench },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  {
    href: '/dashboard/contas-a-pagar',
    label: 'Contas a Pagar',
    icon: ArrowDown,
  },
  {
    href: '/dashboard/contas-a-receber',
    label: 'Contas a Receber',
    icon: ArrowUp,
  },
  {
    href: '/dashboard/comissoes',
    label: 'Comissões',
    icon: HandCoins,
  },
  { href: '/dashboard/quantitativo', label: 'Quantitativo', icon: ClipboardList },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
  { href: '/dashboard/calculadora', label: 'Calculadora', icon: Calculator },
];

const secondaryLinks = [
    {
      href: '/dashboard/fornecedores',
      label: 'Fornecedores',
      icon: Truck,
    },
    {
      href: '/dashboard/funcionarios',
      label: 'Funcionários',
      icon: Briefcase,
    },
    {
      href: '/dashboard/analytics',
      label: 'Analytics',
      icon: LineChart,
    }
]

const aiLinks = [
    {
    href: '/dashboard/timeline-sugestoes',
    label: 'Sugestões IA',
    icon: Sparkles,
  },
]

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
          {mainLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href} passHref>
                <SidebarMenuButton
                  isActive={pathname === link.href.split('?')[0]}
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

        <SidebarSeparator />
        
         <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
                <Building2 className="mr-2"/>
                Cadastros
            </SidebarGroupLabel>
            <SidebarMenu>
                 {secondaryLinks.map((link) => (
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
