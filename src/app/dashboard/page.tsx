
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, Account, Client, Commission } from '@/lib/types';
import { format, isPast } from 'date-fns';
import {
  Activity,
  CircleDollarSign,
  ClipboardList,
  Users,
  Loader2,
  ExternalLink,
  HandCoins,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesSnapshot, payableSnapshot, clientsSnapshot, commissionsSnapshot] = await Promise.all([
          getDocs(collection(db, "servicos")),
          getDocs(collection(db, "contas_a_pagar")),
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "comissoes")),
        ]);

        const servicesData = servicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, data_cadastro: data.data_cadastro.toDate() } as Service;
        });
        setServices(servicesData);

        const payableData = payableSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
        });
        setAccountsPayable(payableData);
        
        const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
        setClients(clientsData);
        
        const commissionsData = commissionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, data: data.data.toDate() } as Commission;
        });
        setCommissions(commissionsData);


      } catch (error) {
        console.error("Erro ao buscar dados do dashboard: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const ongoingServices = services.filter(
    (s) => s.status === 'em andamento'
  );
  
  const upcomingPayable = accountsPayable
    .filter((a) => a.status === 'pendente')
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());

  const totalReceivablePaid = services.reduce((acc, curr) => curr.status === 'concluído' ? acc + curr.valor : acc, 0);
  const totalPayablePaid = accountsPayable.reduce((acc, curr) => curr.status === 'pago' ? acc + curr.valor : acc, 0);
  const totalCommissionsPaid = commissions.reduce((acc, curr) => curr.status === 'pago' ? acc + curr.valor : acc, 0);
  const balance = totalReceivablePaid - totalPayablePaid - totalCommissionsPaid;
  
  const totalServices = services.filter(s => s.status !== 'cancelado').length;
  const completedServices = services.filter(s => s.status === 'concluído').length;
  const completionRate = totalServices > 0 ? (completedServices / totalServices) * 100 : 0;
  
  const totalCommissionsPending = commissions
    .filter((c) => c.status === 'pendente')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalReceivablePending = services
    .filter((s) => s.status === 'em andamento')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalPayablePending = accountsPayable
    .filter((a) => a.status === 'pendente')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalExpenses = accountsPayable.reduce((acc, curr) => acc + curr.valor, 0);


  const handlePayAccount = (accountId: string) => {
    router.push(`/dashboard/contas-a-pagar?editPayable=${accountId}`);
  };

  const handleEditService = (serviceId: string) => {
    router.push(`/dashboard/servicos?edit=${serviceId}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Dashboard</h1>
        <p className="text-muted-foreground">
          Uma visão geral do seu escritório.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo em Caixa
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className={cn("text-2xl font-bold", balance < 0 ? "text-red-500" : "text-green-500")}>R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              Recebidos - Contas Pagas - Comissões Pagas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receita de Serviços Concluídos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             <p className="text-xs text-muted-foreground">
                Soma do valor de todos os serviços concluídos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Serviços em Andamento
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ongoingServices.length}</div>
            <p className="text-xs text-muted-foreground">
              Total de projetos em execução
            </p>
          </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Serviços Concluídos</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{completedServices}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de serviços finalizados
                </p>
            </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Receber (Pendente)</CardTitle>
                  <ArrowUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground">
                      Soma de todos os serviços "em andamento"
                  </p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Pagar (Pendente)</CardTitle>
                  <ArrowDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">
                      Soma de todas as contas pendentes
                  </p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Comissões Pendentes
                </CardTitle>
                <HandCoins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">R$ {totalCommissionsPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">
                  Total de comissões a pagar
                </p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">
                      Soma de despesas pagas e pendentes
                  </p>
              </CardContent>
          </Card>
       </div>

      <div className="grid grid-cols-1 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Serviços em Andamento</CardTitle>
            <CardDescription>
              Projetos que estão atualmente em execução.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                   <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ongoingServices.length > 0 ? ongoingServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.descricao}</TableCell>
                    <TableCell>{format(service.data_cadastro, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right text-green-500">R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditService(service.id)}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Ver/Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum serviço em andamento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contas a Pagar Próximas</CardTitle>
            <CardDescription>
              Faturas e contas com vencimento próximo.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayable.length > 0 ? upcomingPayable.slice(0, 5).map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.descricao}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{format(account.vencimento, 'dd/MM/yyyy')}</span>
                        {isPast(account.vencimento) && account.status === 'pendente' && (
                          <Badge variant="destructive">Vencida</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-red-500">R$ {account.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePayAccount(account.id)}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhuma conta pendente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
