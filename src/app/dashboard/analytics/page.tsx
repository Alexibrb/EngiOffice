'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { Service, Client, Account, AuthorizedUser, City, ServicePayment, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { Loader2, XCircle, ShieldAlert, TrendingUp, Users, Truck, Activity, Calendar as CalendarIcon, History } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const REVENUE_COLOR = '#22c55e'; // Verde
const EXPENSE_COLOR = '#ef4444'; // Vermelho
const BALANCE_COLOR = '#3b82f6';  // Azul
const PAYROLL_COLOR = '#a855f7'; // Roxo

const flowChartConfig = {
    receita: { label: "Receitas", color: REVENUE_COLOR },
    despesa: { label: "Fornecedores", color: EXPENSE_COLOR },
    folha: { label: "Folha Pagto", color: PAYROLL_COLOR },
} satisfies ChartConfig;

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [receivables, setReceivables] = useState<ServicePayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [oldestDate, setOldestDate] = useState<Date | null>(null);
    const router = useRouter();

    const [selectedCityFilter, setSelectedCityFilter] = useState('none');
    
    // Padrão: Mês vigente
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfDay(new Date())
    });

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

            // Reconstrução de receitas de serviços antigos (sem histórico de parcelas)
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

            // Identificar o início absoluto do período para a função "Todo o Período"
            const allDates = [
                ...reconstructedReceivables.map(r => r.data.getTime()),
                ...accountsData.map(a => a.vencimento.getTime())
            ];
            
            if (allDates.length > 0) {
                setOldestDate(new Date(Math.min(...allDates)));
            }

            setServices(servicesData);
            setClients(clientsSnap.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client)));
            setSuppliers(suppliersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier)));
            setAccountsPayable(accountsData);
            setCities(citiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as City)).sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade)));
            setReceivables(reconstructedReceivables);

        } catch (error) {
            console.error("Erro ao buscar dados para analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const isGlobalView = !selectedCityFilter || selectedCityFilter === 'none';

    // Filtro de Receitas (Sensível a cidade se aplicada)
    const activeReceivables = useMemo(() => {
        return receivables.filter(r => {
            const service = services.find(s => s.id === r.servico_id);
            if (!service) return false;
            return isGlobalView || service.endereco_obra?.city === selectedCityFilter;
        });
    }, [receivables, services, selectedCityFilter, isGlobalView]);

    // Filtro de Despesas (Ocultadas se filtro de cidade estiver ativo para focar no faturamento regional)
    const activeExpenses = useMemo(() => {
        if (!isGlobalView) return [];
        return accountsPayable.filter(a => a.status === 'pago');
    }, [accountsPayable, isGlobalView]);

    // Intervalo de Datas da Amostra (Eixo X)
    const sampleRange = useMemo(() => {
        const start = dateRange?.from || startOfMonth(new Date());
        const end = dateRange?.to || new Date();
        return { start, end };
    }, [dateRange]);

    // 1. Fluxo Diário Pontual (Barras Agrupadas)
    const dailyFlowTransactions = useMemo(() => {
        try {
            const days = eachDayOfInterval({ start: sampleRange.start, end: sampleRange.end });

            return days.map(day => {
                const dStart = startOfDay(day);
                const dEnd = endOfDay(day);

                const receitaDia = activeReceivables
                    .filter(r => r.data >= dStart && r.data <= dEnd)
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const despesaDia = activeExpenses
                    .filter(a => a.tipo_referencia === 'fornecedor' && a.vencimento >= dStart && a.vencimento <= dEnd)
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                const folhaDia = activeExpenses
                    .filter(a => a.tipo_referencia === 'funcionario' && a.vencimento >= dStart && a.vencimento <= dEnd)
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return {
                    date: format(day, 'dd/MM'),
                    receita: receitaDia,
                    despesa: despesaDia,
                    folha: folhaDia
                };
            });
        } catch (e) { return []; }
    }, [activeReceivables, activeExpenses, sampleRange]);

    // 2. Evolução do Patrimônio (Acumulado Diário)
    const dailyStepData = useMemo(() => {
        try {
            const days = eachDayOfInterval({ start: sampleRange.start, end: sampleRange.end });

            return days.map(day => {
                const dEnd = endOfDay(day);
                
                // Nota: O acumulado sempre considera TUDO antes do ponto atual, independente do início do filtro de data
                const totalReceivedUntilNow = activeReceivables
                    .filter(r => !isAfter(r.data, dEnd))
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const totalPaidUntilNow = activeExpenses
                    .filter(a => !isAfter(a.vencimento, dEnd))
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return {
                    date: format(day, 'dd/MM/yy'),
                    saldo: totalReceivedUntilNow - totalPaidUntilNow,
                    receita: totalReceivedUntilNow,
                    despesa: totalPaidUntilNow
                };
            });
        } catch (e) { return []; }
    }, [activeReceivables, activeExpenses, sampleRange]);

    // 3. Crescimento Mensal (Cumulativo)
    const cumulativeMonthlyData = useMemo(() => {
        try {
            const months = eachMonthOfInterval({ start: sampleRange.start, end: sampleRange.end });
            return months.map(month => {
                const monthEnd = endOfMonth(month);
                
                const totalReceivedUntilNow = activeReceivables
                    .filter(r => !isAfter(r.data, monthEnd))
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const totalPaidUntilNow = activeExpenses
                    .filter(a => !isAfter(a.vencimento, monthEnd))
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: totalReceivedUntilNow, 
                    despesas: totalPaidUntilNow,
                    saldo: totalReceivedUntilNow - totalPaidUntilNow
                };
            });
        } catch (e) { return []; }
    }, [activeReceivables, activeExpenses, sampleRange]);

    // Filtros para os rankings (Barras)
    const receivablesForRankings = useMemo(() => {
        const start = startOfDay(sampleRange.start);
        const end = endOfDay(sampleRange.end);
        return activeReceivables.filter(r => r.data >= start && r.data <= end);
    }, [activeReceivables, sampleRange]);

    const expensesForRankings = useMemo(() => {
        const start = startOfDay(sampleRange.start);
        const end = endOfDay(sampleRange.end);
        return activeExpenses.filter(a => a.vencimento >= start && a.vencimento <= end);
    }, [activeExpenses, sampleRange]);

    const handleClearFilters = () => {
        setSelectedCityFilter('none');
        setDateRange({ from: startOfMonth(new Date()), to: endOfDay(new Date()) });
    };

    const handleSelectAllHistory = () => {
        if (oldestDate) {
            setDateRange({ from: startOfDay(oldestDate), to: endOfDay(new Date()) });
        }
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
                description="Análise financeira profunda do seu escritório."
            />
            
            <Card>
                <CardHeader><CardTitle>Filtros de Amostra</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-center gap-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Período:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                                            ) : (
                                                format(dateRange.from, "dd/MM/yy")
                                            )
                                        ) : (
                                            <span>Escolha o período</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="secondary" onClick={handleSelectAllHistory} className="text-xs" disabled={!oldestDate}>
                            <History className="mr-2 h-3 w-3" />
                            Todo o Período
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Cidade:</span>
                        <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as Cidades" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Todas as Cidades</SelectItem>
                                {cities.map(city => <SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground ml-auto">
                        <XCircle className="mr-2 h-4 w-4"/>
                        Limpar
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-8">
                
                {/* 1. Fluxo de Caixa Diário (Barras Agrupadas) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">Fluxo de Caixa (Diário)</CardTitle>
                        <CardDescription>Comparativo de entradas e saídas por dia no período selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={flowChartConfig} className="h-[400px] w-full">
                            <BarChart data={dailyFlowTransactions} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                <XAxis 
                                    dataKey="date" 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickMargin={15} 
                                    minTickGap={30}
                                    className="text-[10px] text-muted-foreground"
                                />
                                <YAxis 
                                    tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} 
                                    axisLine={false} 
                                    tickLine={false}
                                    tickMargin={10}
                                    className="text-[10px] text-muted-foreground"
                                />
                                <ChartTooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} 
                                />
                                <ChartLegend verticalAlign="bottom" align="center" iconType="circle" />
                                <Bar 
                                    dataKey="receita" 
                                    fill={REVENUE_COLOR} 
                                    radius={[4, 4, 0, 0]} 
                                    name="Receitas" 
                                />
                                <Bar 
                                    dataKey="despesa" 
                                    fill={EXPENSE_COLOR} 
                                    radius={[4, 4, 0, 0]} 
                                    name="Fornecedores" 
                                />
                                <Bar 
                                    dataKey="folha" 
                                    fill={PAYROLL_COLOR} 
                                    radius={[4, 4, 0, 0]} 
                                    name="Folha Pagto" 
                                />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 2. Evolução do Patrimônio (Acumulado em Degraus) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-500">
                            <Activity className="h-5 w-5" />
                            Patrimônio Acumulado (Diário)
                        </CardTitle>
                        <CardDescription>Saldo líquido acumulado dia a dia, mostrando o impacto direto das transações.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={dailyStepData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={60} />
                                <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} axisLine={false} tickLine={false} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="stepAfter" dataKey="receita" stroke={REVENUE_COLOR} strokeWidth={1.5} dot={false} name="Receita Acum." />
                                <Line type="stepAfter" dataKey="despesa" stroke={EXPENSE_COLOR} strokeWidth={1.5} dot={false} name="Despesa Acum." />
                                <Line type="stepAfter" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} dot={false} name="Patrimônio Líquido" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 3. Crescimento Mensal Cumulativo */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500">
                            <TrendingUp className="h-5 w-5" />
                            Crescimento Histórico (Mensal)
                        </CardTitle>
                        <CardDescription>Visão agrupada por mês da evolução patrimonial total.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={cumulativeMonthlyData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} axisLine={false} tickLine={false} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="monotone" dataKey="receitas" stroke={REVENUE_COLOR} strokeWidth={2} dot={true} name="Receitas Acum." />
                                <Line type="monotone" dataKey="despesas" stroke={EXPENSE_COLOR} strokeWidth={2} dot={true} name="Despesas Acum." />
                                <Line type="monotone" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} strokeDasharray="5 5" dot={true} name="Saldo Acumulado" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 4. Top Clientes (Filtrado por Data e Cidade) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Maiores Faturamentos por Cliente
                            </CardTitle>
                            <CardDescription>No período selecionado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={{}} className="h-[300px] w-full">
                                <BarChart 
                                    data={Object.entries(receivablesForRankings.reduce((acc, curr) => {
                                        const name = clients.find(c => c.codigo_cliente === curr.cliente_id)?.nome_completo || 'Desconhecido';
                                        acc[name] = (acc[name] || 0) + curr.valor;
                                        return acc;
                                    }, {} as Record<string, number>))
                                    .map(([name, value]) => ({ name, value }))
                                    .sort((a, b) => b.value - a.value)
                                    .slice(0, 10)} 
                                    layout="vertical" 
                                    margin={{ left: 40 }}
                                >
                                    <CartesianGrid horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} className="text-[10px]" />
                                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                                    <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} name="Receita Total" />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    {/* 5. Top Fornecedores (Filtrado por Data) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5" />
                                Maiores Gastos com Fornecedores
                            </CardTitle>
                            <CardDescription>No período selecionado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={{}} className="h-[300px] w-full">
                                <BarChart 
                                    data={Object.entries(expensesForRankings
                                        .filter(a => a.tipo_referencia === 'fornecedor')
                                        .reduce((acc, curr) => {
                                            const name = suppliers.find(s => s.id === curr.referencia_id)?.razao_social || 'Desconhecido';
                                            acc[name] = (acc[name] || 0) + curr.valor;
                                            return acc;
                                        }, {} as Record<string, number>))
                                    .map(([name, value]) => ({ name, value }))
                                    .sort((a, b) => b.value - a.value)
                                    .slice(0, 10)} 
                                    layout="vertical" 
                                    margin={{ left: 40 }}
                                >
                                    <CartesianGrid horizontal={false} opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} className="text-[10px]" />
                                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                                    <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} name="Gasto Total" />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
