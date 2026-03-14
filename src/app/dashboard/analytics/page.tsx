'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { Service, Client, Account, AuthorizedUser, City, ServicePayment, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { Loader2, XCircle, ShieldAlert, TrendingUp, Wallet, Users, Truck } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const REVENUE_COLOR = '#16a34a'; // Verde
const EXPENSE_COLOR = '#dc2626'; // Vermelho
const BALANCE_COLOR = '#3b82f6';  // Azul

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [receivables, setReceivables] = useState<ServicePayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    const [selectedClient, setSelectedClient] = useState('none');
    const [selectedCityFilter, setSelectedCityFilter] = useState('none');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data() as AuthorizedUser;
                    if (userData.role === 'admin') {
                        setIsAdmin(true);
                        fetchData();
                    } else {
                        setIsAdmin(false);
                        setIsLoading(false);
                    }
                } else {
                    setIsAdmin(false);
                    setIsLoading(false);
                }
            } else {
                router.push('/');
            }
        });
        return () => unsubscribe();
    }, [router]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [servicesSnap, clientsSnap, accountsPayableSnap, citiesSnap, receivablesSnap, suppliersSnap] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "cidades")),
                getDocs(collection(db, "recebimentos")),
                getDocs(collection(db, "fornecedores")),
            ]);

            const servicesData = servicesSnap.docs.map(doc => {
                const d = doc.data();
                return { 
                    ...d, 
                    id: doc.id,
                    data_cadastro: d.data_cadastro instanceof Timestamp ? d.data_cadastro.toDate() : new Date(d.data_cadastro),
                    data_ultimo_pagamento: d.data_ultimo_pagamento instanceof Timestamp ? d.data_ultimo_pagamento.toDate() : (d.data_ultimo_pagamento ? new Date(d.data_ultimo_pagamento) : undefined)
                } as Service;
            });

            const clientsData = clientsSnap.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client));
            const suppliersData = suppliersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
            const citiesData = citiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as City));
            
            const accountsData = accountsPayableSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    vencimento: data.vencimento instanceof Timestamp ? data.vencimento.toDate() : new Date(data.vencimento)
                } as Account;
            });

            const receivablesHistory = receivablesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    data: data.data instanceof Timestamp ? data.data.toDate() : new Date(data.data),
                } as ServicePayment;
            });

            // Lógica de Reconstrução: Incluir valores pagos que não possuem histórico detalhado
            const reconstructedReceivables: ServicePayment[] = [...receivablesHistory];
            
            servicesData.forEach(service => {
                const historyForThisService = receivablesHistory.filter(r => r.servico_id === service.id);
                const documentedTotal = historyForThisService.reduce((sum, r) => sum + (r.valor || 0), 0);
                const missingAmount = (service.valor_pago || 0) - documentedTotal;

                if (missingAmount > 0.01) {
                    reconstructedReceivables.push({
                        id: `legacy-${service.id}`,
                        servico_id: service.id,
                        cliente_id: service.cliente_id,
                        valor: missingAmount,
                        data: service.data_ultimo_pagamento || service.data_cadastro || new Date(),
                    } as ServicePayment);
                }
            });

            setServices(servicesData);
            setClients(clientsData.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)));
            setSuppliers(suppliersData);
            setAccountsPayable(accountsData);
            setCities(citiesData.sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade)));
            setReceivables(reconstructedReceivables);

        } catch (error) {
            console.error("Erro ao buscar dados para analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // 1. Filtro de Recebimentos
    const filteredReceivables = useMemo(() => {
        return receivables.filter(r => {
            const service = services.find(s => s.id === r.servico_id);
            if (!service) return false;

            const matchesCity = selectedCityFilter === 'none' || service.endereco_obra?.city === selectedCityFilter;
            const matchesClient = selectedClient === 'none' || r.cliente_id === selectedClient;
            
            return matchesCity && matchesClient;
        });
    }, [receivables, services, selectedCityFilter, selectedClient]);

    // 2. Filtro de Despesas
    const filteredExpenses = useMemo(() => {
        return accountsPayable.filter(a => {
            if (a.status !== 'pago') return false;

            if (a.servico_id) {
                const service = services.find(s => s.id === a.servico_id);
                if (!service) return false;
                if (selectedCityFilter !== 'none' && service.endereco_obra?.city !== selectedCityFilter) return false;
            } else {
                if (selectedCityFilter !== 'none') return false;
            }

            const matchesClient = selectedClient === 'none' || a.cliente_id === selectedClient;
            return matchesClient;
        });
    }, [accountsPayable, services, selectedClient, selectedCityFilter]);

    // 3. Gráfico Crescimento Histórico Mensal (Cumulativo)
    const cumulativeMonthlyData = useMemo(() => {
        if (receivables.length === 0 && accountsPayable.length === 0) return [];

        const end = endOfMonth(new Date());
        const start = startOfMonth(subMonths(end, 11)); 

        try {
            const months = eachMonthOfInterval({ start, end });

            return months.map(month => {
                const monthEnd = endOfMonth(month);

                // Soma acumulada até o final do mês corrente no loop
                const totalReceivedUntilNow = filteredReceivables
                    .filter(r => !isAfter(r.data, monthEnd))
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const totalPaidUntilNow = filteredExpenses
                    .filter(a => !isAfter(a.vencimento, monthEnd))
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: totalReceivedUntilNow, 
                    despesas: totalPaidUntilNow,
                    saldo: totalReceivedUntilNow - totalPaidUntilNow
                };
            });
        } catch (e) {
            return [];
        }
    }, [filteredReceivables, filteredExpenses, receivables.length, accountsPayable.length]);

    // 4. Fluxo de Caixa Mensal
    const monthlyFlowData = useMemo(() => {
        const end = endOfMonth(new Date());
        const start = startOfMonth(subMonths(end, 11)); 
        const months = eachMonthOfInterval({ start, end });

        return months.map(month => {
            const mStart = startOfMonth(month);
            const mEnd = endOfMonth(month);

            const receivedInMonth = filteredReceivables
                .filter(r => r.data >= mStart && r.data <= mEnd)
                .reduce((acc, r) => acc + (r.valor || 0), 0);
            
            const paidInMonth = filteredExpenses
                .filter(a => a.vencimento >= mStart && a.vencimento <= mEnd)
                .reduce((acc, a) => acc + (a.valor || 0), 0);

            return {
                name: format(month, 'MMM/yy', { locale: ptBR }),
                entradas: receivedInMonth,
                saidas: paidInMonth,
            };
        });
    }, [filteredReceivables, filteredExpenses]);

    // 5. Ranking de Clientes
    const topClientsData = useMemo(() => {
        const clientRevenue: Record<string, number> = {};
        filteredReceivables.forEach(r => {
            const name = clients.find(c => c.codigo_cliente === r.cliente_id)?.nome_completo || 'Desconhecido';
            clientRevenue[name] = (clientRevenue[name] || 0) + r.valor;
        });

        return Object.entries(clientRevenue)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredReceivables, clients]);

    // 6. Gastos por Fornecedor (Exclui Funcionários)
    const topSuppliersData = useMemo(() => {
        const supplierExpenses: Record<string, number> = {};
        filteredExpenses
            .filter(a => a.tipo_referencia === 'fornecedor')
            .forEach(a => {
                const name = suppliers.find(s => s.id === a.referencia_id)?.razao_social || 'Desconhecido';
                supplierExpenses[name] = (supplierExpenses[name] || 0) + a.valor;
            });

        return Object.entries(supplierExpenses)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredExpenses, suppliers]);

    const handleClearFilters = () => {
        setSelectedClient('none');
        setSelectedCityFilter('none');
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAdmin) {
        return (
          <Card className="border-destructive">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                      <ShieldAlert />
                      Acesso Negado
                  </CardTitle>
                  <CardDescription>
                      Você não tem permissão para visualizar esta página.
                  </CardDescription>
              </CardHeader>
          </Card>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
                title="Analytics"
                description="Saúde financeira baseada em recebimentos reais e pagamentos realizados."
            />
            
            {/* Filtros */}
            <Card>
                <CardHeader><CardTitle>Filtros do Dashboard</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todos os Clientes</SelectItem>
                            {clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cidade da Obra" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todas as Cidades</SelectItem>
                            {cities.map(city => <SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                        <XCircle className="mr-2 h-4 w-4"/>
                        Limpar Filtros
                    </Button>
                </CardContent>
            </Card>

            {/* Grid de Gráficos Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Crescimento Cumulativo */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            Crescimento Histórico Acumulado
                        </CardTitle>
                        <CardDescription>Evolução patrimonial: soma total de todas as receitas vs todas as despesas ao longo do tempo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={cumulativeMonthlyData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} axisLine={false} tickLine={false} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="monotone" dataKey="receitas" stroke={REVENUE_COLOR} strokeWidth={3} dot={false} name="Receitas Acum." />
                                <Line type="monotone" dataKey="despesas" stroke={EXPENSE_COLOR} strokeWidth={3} dot={false} name="Despesas Acum." />
                                <Line type="monotone" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} strokeDasharray="5 5" dot={false} name="Patrimônio" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 2. Fluxo de Caixa Mensal */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-blue-500" />
                            Fluxo de Caixa Mensal
                        </CardTitle>
                        <CardDescription>Entradas e saídas reais registradas em cada mês.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={monthlyFlowData}>
                                <CartesianGrid vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="entradas" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} name="Entradas" />
                                <Bar dataKey="saidas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} name="Saídas" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 3. Ranking de Clientes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-orange-500" />
                            Top Clientes por Receita
                        </CardTitle>
                        <CardDescription>Clientes com maior volume de pagamentos realizados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={topClientsData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid horizontal={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} className="text-[10px]" />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} name="Receita Total" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 4. Gastos com Fornecedores */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-red-500" />
                            Gastos por Fornecedor
                        </CardTitle>
                        <CardDescription>Ranking completo de pagamentos efetuados para fornecedores no período.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <BarChart data={topSuppliersData} layout="vertical" margin={{ left: 60 }}>
                                <CartesianGrid horizontal={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} className="text-[10px]" />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                                <Bar dataKey="value" fill={EXPENSE_COLOR} radius={[0, 4, 4, 0]} name="Total Pago" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}