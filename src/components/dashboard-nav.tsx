
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

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Wrench },
  {
    href: '/dashboard/financeiro?tab=payable',
    label: 'Contas a Pagar',
    icon: ArrowDown,
  },
  {
    href: '/dashboard/financeiro?tab=receivable',
    label: 'Contas a Receber',
    icon: ArrowUp,
  },
  {
    href: '/dashboard/comissoes',
    label: 'Comissões',
    icon: HandCoins,
  },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileText },
];

const secondaryLinks = [
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
          <span className="text-lg font-semibold font-headline">EngiFlow</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {mainLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href} passHref>
                <SidebarMenuButton
                  isActive={pathname === link.href.split('?')[0]}
                  asChild
                  tooltip={link.label}
                >
                  <a>
                    <link.icon />
                    <span>{link.label}</span>
                  </a>
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
                        >
                        <a>
                            <link.icon />
                            <span>{link.label}</span>
                        </a>
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
                >
                  <a>
                    <link.icon />
                    <span>{link.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>


      </SidebarContent>
    </Sidebar>
  );
}
