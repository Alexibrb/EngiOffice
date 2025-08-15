
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
import type { Service, Account, Client } from '@/lib/types';
import { format } from 'date-fns';
import {
  Activity,
  CircleDollarSign,
  ClipboardList,
  Users,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesSnapshot, payableSnapshot, clientsSnapshot] = await Promise.all([
          getDocs(collection(db, "servicos")),
          getDocs(collection(db, "contas_a_pagar")),
          getDocs(collection(db, "clientes")),
        ]);

        const servicesData = servicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, prazo: data.prazo.toDate() } as Service;
        });
        setServices(servicesData);

        const payableData = payableSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
        });
        setAccountsPayable(payableData);
        
        const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
        setClients(clientsData);

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

  const totalReceivable = services.reduce((acc, curr) => curr.status !== 'cancelado' ? acc + curr.valor : acc, 0);
  const totalPayable = accountsPayable.reduce((acc, curr) => acc + curr.valor, 0);
  const balance = totalReceivable - totalPayable;
  
  const totalServices = services.filter(s => s.status !== 'cancelado').length;
  const completedServices = services.filter(s => s.status === 'concluído').length;
  const completionRate = totalServices > 0 ? (completedServices / totalServices) * 100 : 0;


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
        <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
        <p className="text-muted-foreground">
          Uma visão geral do seu escritório.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo Previsto
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              Balanço total (serviços - despesas)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">
              Total de clientes cadastrados
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
            <CardTitle className="text-sm font-medium">
              Taxa de Conclusão
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              De todos os serviços não cancelados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ongoingServices.length > 0 ? ongoingServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.descricao}</TableCell>
                    <TableCell>{format(service.prazo, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayable.length > 0 ? upcomingPayable.slice(0, 5).map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.descricao}</TableCell>
                    <TableCell>
                        {format(account.vencimento, 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">R$ {account.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
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

