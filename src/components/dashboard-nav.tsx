
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
  DollarSign,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
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
  { href: '/dashboard/servicos', label: 'Serviços', icon: Wrench },
  {
    href: '/dashboard/comissoes',
    label: 'Comissões',
    icon: HandCoins,
  },
  {
    href: '/dashboard/financeiro',
    label: 'Financeiro',
    icon: CircleDollarSign,
  },
   {
    href: '/dashboard/financeiro?add=true',
    label: 'Despesas',
    icon: DollarSign,
  },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
  {
    href: '/dashboard/timeline-sugestoes',
    label: 'Sugestões IA',
    icon: Sparkles,
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold font-headline">EngiFlow</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href} passHref>
                <SidebarMenuButton
                  isActive={pathname === link.href}
                  asChild
                  tooltip={link.label}
                >
                  <>
                    <link.icon />
                    <span>{link.label}</span>
                  </>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
