
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, AreaChart, Area } from 'recharts';
import { Loader2, XCircle, ShieldAlert, TrendingUp, Wallet, Users, Truck, Activity, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter, eachDayOfInterval, startOfDay, endOfDay, subMonths, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const REVENUE_COLOR = '#16a34a'; // Verde
const EXPENSE_COLOR = '#dc2626'; // Vermelho
const BALANCE_COLOR = '#3b82f6';  // Azul
const PAYROLL_COLOR = '#9333ea'; // Roxo

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
    const router = useRouter();

    const [selectedCityFilter, setSelectedCityFilter] = useState('none');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

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

            // Reconstrução de receitas de serviços antigos
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

            // Definir o range de data padrão (do início de tudo até hoje)
            const allDates = [
                ...reconstructedReceivables.map(r => r.data.getTime()),
                ...accountsData.map(a => a.vencimento.getTime())
            ];
            if (allDates.length > 0) {
                const firstDate = new Date(Math.min(...allDates));
                setDateRange({ from: startOfMonth(firstDate), to: new Date() });
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

    // Filtro de Receitas (Sempre filtradas por serviço existente e cidade)
    const activeReceivables = useMemo(() => {
        return receivables.filter(r => {
            const service = services.find(s => s.id === r.servico_id);
            if (!service) return false;
            return selectedCityFilter === 'none' || service.endereco_obra?.city === selectedCityFilter;
        });
    }, [receivables, services, selectedCityFilter]);

    // Filtro de Despesas (Se cidade selecionada, não mostramos saídas)
    const activeExpenses = useMemo(() => {
        if (selectedCityFilter !== 'none') return [];
        return accountsPayable.filter(a => a.status === 'pago');
    }, [accountsPayable, selectedCityFilter]);

    // Identifica o início absoluto para cálculos acumulados
    const absoluteStartDate = useMemo(() => {
        const allDates = [
            ...receivables.map(r => r.data.getTime()),
            ...accountsPayable.map(a => a.vencimento.getTime())
        ];
        if (allDates.length === 0) return startOfMonth(new Date());
        return startOfMonth(new Date(Math.min(...allDates)));
    }, [receivables, accountsPayable]);

    // Datas da Amostra (Eixo X)
    const sampleRange = useMemo(() => {
        const start = dateRange?.from || absoluteStartDate;
        const end = dateRange?.to || new Date();
        return { start, end };
    }, [dateRange, absoluteStartDate]);

    // 1. Evolução Diária (Patrimônio Acumulado)
    const dailyStepData = useMemo(() => {
        const days = eachDayOfInterval({ start: sampleRange.start, end: sampleRange.end });

        return days.map(day => {
            const dEnd = endOfDay(day);
            
            // O acumulado sempre conta desde o início absoluto até o dia da amostra
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
    }, [activeReceivables, activeExpenses, sampleRange]);

    // 2. Fluxo Diário Pontual
    const dailyFlowTransactions = useMemo(() => {
        const days = eachDayOfInterval({ start: sampleRange.start, end: sampleRange.end });

        return days.map(day => {
            const dStart = startOfDay(day);
            const dEnd = endOfDay(day);

            const receitaDia = activeReceivables
                .filter(r => r.data >= dStart && r.data <= dEnd)
                .reduce((acc, r) => acc + (r.valor || 0), 0);
            
            const despesaDia = activeExpenses
                .filter(a => a.tipo_referencia !== 'funcionario' && a.vencimento >= dStart && a.vencimento <= dEnd)
                .reduce((acc, a) => acc + (a.valor || 0), 0);

            const folhaDia = activeExpenses
                .filter(a => a.tipo_referencia === 'funcionario' && a.vencimento >= dStart && a.vencimento <= dEnd)
                .reduce((acc, a) => acc + (a.valor || 0), 0);

            return {
                date: format(day, 'dd/MM/yy'),
                receita: receitaDia,
                despesa: despesaDia,
                folha: folhaDia
            };
        });
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
        } catch (e) {
            return [];
        }
    }, [activeReceivables, activeExpenses, sampleRange]);

    // 4. Fluxo de Caixa Mensal
    const monthlyFlowData = useMemo(() => {
        try {
            const months = eachMonthOfInterval({ start: sampleRange.start, end: sampleRange.end });
            return months.map(month => {
                const mStart = startOfMonth(month);
                const mEnd = endOfMonth(month);
                
                const receivedInMonth = activeReceivables
                    .filter(r => r.data >= mStart && r.data <= mEnd)
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const paidInMonth = activeExpenses
                    .filter(a => a.vencimento >= mStart && a.vencimento <= mEnd)
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return {
                    name: format(month, 'MMM/yy', { locale: ptBR }),
                    entradas: receivedInMonth,
                    saidas: paidInMonth,
                };
            });
        } catch (e) {
            return [];
        }
    }, [activeReceivables, activeExpenses, sampleRange]);

    // 5. Ranking de Clientes (No período filtrado)
    const topClientsData = useMemo(() => {
        const clientRevenue: Record<string, number> = {};
        activeReceivables
            .filter(r => r.data >= sampleRange.start && r.data <= sampleRange.end)
            .forEach(r => {
                const name = clients.find(c => c.codigo_cliente === r.cliente_id)?.nome_completo || 'Desconhecido';
                clientRevenue[name] = (clientRevenue[name] || 0) + r.valor;
            });
        return Object.entries(clientRevenue)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [activeReceivables, clients, sampleRange]);

    // 6. Gastos por Fornecedor (No período filtrado)
    const topSuppliersData = useMemo(() => {
        const supplierExpenses: Record<string, number> = {};
        activeExpenses
            .filter(a => a.tipo_referencia === 'fornecedor' && a.vencimento >= sampleRange.start && a.vencimento <= sampleRange.end)
            .forEach(a => {
                const name = suppliers.find(s => s.id === a.referencia_id)?.razao_social || 'Desconhecido';
                supplierExpenses[name] = (supplierExpenses[name] || 0) + a.valor;
            });
        return Object.entries(supplierExpenses)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [activeExpenses, suppliers, sampleRange]);

    const handleClearFilters = () => {
        setSelectedCityFilter('none');
        setDateRange({ from: absoluteStartDate, to: new Date() });
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
                description="Visão detalhada da saúde financeira baseada no histórico selecionado."
            />
            
            <Card>
                <CardHeader><CardTitle>Filtros de Amostragem</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Período:</Label>
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

                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Cidade da Obra:</Label>
                        <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as Cidades" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Todas as Cidades</SelectItem>
                                {cities.map(city => <SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                        <XCircle className="mr-2 h-4 w-4"/>
                        Limpar Filtros
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Evolução Diária do Saldo (Patrimônio Acumulado) */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-500" />
                            Evolução do Patrimônio (Acumulado)
                        </CardTitle>
                        <CardDescription>Saldo, receitas e despesas somadas desde o primeiro lançamento até a data do gráfico.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={dailyStepData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={60} />
                                <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} axisLine={false} tickLine={false} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="stepAfter" dataKey="receita" stroke={REVENUE_COLOR} strokeWidth={2} dot={false} name="Receita Acum." />
                                {selectedCityFilter === 'none' && <Line type="stepAfter" dataKey="despesa" stroke={EXPENSE_COLOR} strokeWidth={2} dot={false} name="Despesa Acum." />}
                                <Line type="stepAfter" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} dot={false} name="Patrimônio Líquido" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Fluxo de Caixa (Diário) - Reconstruído como na imagem */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-purple-500" />
                            Fluxo de Caixa (Diário)
                        </CardTitle>
                        <CardDescription>Entradas e saídas diárias detalhadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={flowChartConfig} className="h-[400px] w-full">
                            <AreaChart data={dailyFlowTransactions}>
                                <defs>
                                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={REVENUE_COLOR} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={REVENUE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorFolha" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={PAYROLL_COLOR} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={PAYROLL_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={60} />
                                <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}`} axisLine={false} tickLine={false} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${n}: R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="receita" 
                                    stroke={REVENUE_COLOR} 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorReceita)" 
                                    name="Receitas" 
                                />
                                {selectedCityFilter === 'none' && (
                                    <>
                                        <Area 
                                            type="monotone" 
                                            dataKey="despesa" 
                                            stroke={EXPENSE_COLOR} 
                                            strokeWidth={2}
                                            fillOpacity={1} 
                                            fill="url(#colorDespesa)" 
                                            name="Fornecedores" 
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="folha" 
                                            stroke={PAYROLL_COLOR} 
                                            strokeWidth={2}
                                            fillOpacity={1} 
                                            fill="url(#colorFolha)" 
                                            name="Folha Pagto" 
                                        />
                                    </>
                                )}
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Crescimento Mensal Acumulado */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            Crescimento Histórico Acumulado (Mensal)
                        </CardTitle>
                        <CardDescription>Evolução patrimonial total agrupada por mês.</CardDescription>
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
                                {selectedCityFilter === 'none' && <Line type="monotone" dataKey="despesas" stroke={EXPENSE_COLOR} strokeWidth={3} dot={false} name="Despesas Acum." />}
                                <Line type="monotone" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} strokeDasharray="5 5" dot={false} name="Patrimônio" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Fluxo de Caixa Mensal */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-blue-500" />
                            Fluxo de Caixa Mensal (Entradas vs Saídas)
                        </CardTitle>
                        <CardDescription>Movimentação financeira real dentro de cada mês.</CardDescription>
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
                                {selectedCityFilter === 'none' && <Bar dataKey="saidas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} name="Saídas" />}
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Top Clientes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-orange-500" />
                            Top Clientes por Faturamento
                        </CardTitle>
                        <CardDescription>Clientes com maior volume de pagamentos realizados no período.</CardDescription>
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

                {/* Gastos com Fornecedores */}
                {selectedCityFilter === 'none' && (
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5 text-red-500" />
                                Gastos por Fornecedor
                            </CardTitle>
                            <CardDescription>Ranking de pagamentos efetuados para fornecedores no período.</CardDescription>
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
                )}
            </div>
        </div>
    );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={cn("text-sm font-medium leading-none", className)}>{children}</span>;
}
