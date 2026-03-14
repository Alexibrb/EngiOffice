'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { Service, Client, Account, Employee, AuthorizedUser, City } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';
import { Loader2, XCircle, Calendar as CalendarIcon, ShieldAlert, TrendingUp, Truck, Banknote } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay, subDays, isBefore, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const POSITIVE_COLOR = '#16a34a';
const NEGATIVE_COLOR = '#dc2626';
const PAYROLL_COLOR = '#9333ea';
const BALANCE_COLOR = '#3b82f6';

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();


    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedCityFilter, setSelectedCityFilter] = useState('');

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
            const [servicesSnap, clientsSnap, accountsPayableSnap, employeesSnap, citiesSnap] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "funcionarios")),
                getDocs(collection(db, "cidades")),
            ]);

            const servicesData = servicesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
                    data_ultimo_pagamento: data.data_ultimo_pagamento instanceof Timestamp ? data.data_ultimo_pagamento.toDate() : (data.data_ultimo_pagamento ? new Date(data.data_ultimo_pagamento) : null),
                } as Service;
            });

            const clientsData = clientsSnap.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client));
            
            const accountsData = accountsPayableSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    vencimento: data.vencimento instanceof Timestamp ? data.vencimento.toDate() : new Date(data.vencimento)
                } as Account;
            });

            const employeesData = employeesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Employee));
            const citiesData = citiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as City));

            setServices(servicesData);
            setClients(clientsData);
            setAccountsPayable(accountsData);
            setEmployees(employeesData);
            setCities(citiesData.sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade)));

        } catch (error) {
            console.error("Erro ao buscar dados para analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const cumulativeMonthlyData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfMonth(dateRange.from);
            end = dateRange.to ? endOfMonth(dateRange.to) : endOfMonth(start);
        } else {
            end = endOfMonth(new Date());
            start = startOfMonth(subMonths(end, 11));
        }

        try {
            const intervalMonths = eachMonthOfInterval({ start, end });

            return intervalMonths.map(month => {
                const monthEnd = endOfMonth(month);

                const cumulativeReceived = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isBeforeOrInMonth = s.valor_pago > 0 && isBefore(dateToUse, endOfDay(monthEnd));
                        if (!isBeforeOrInMonth) return false;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, s) => acc + (s.valor_pago || 0), 0);
                
                const cumulativePaid = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isBeforeOrInMonth = a.status === 'pago' && isBefore(dueDate, endOfDay(monthEnd));
                        if (!isBeforeOrInMonth) return false;
                        if (selectedEmployee && a.referencia_id !== selectedEmployee) return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: cumulativeReceived, 
                    despesas: cumulativePaid,
                    saldo: cumulativeReceived - cumulativePaid
                };
            });
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient, selectedEmployee]);

    const cumulativeMonthlySuppliersData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfMonth(dateRange.from);
            end = dateRange.to ? endOfMonth(dateRange.to) : endOfMonth(start);
        } else {
            end = endOfMonth(new Date());
            start = startOfMonth(subMonths(end, 11));
        }

        try {
            const intervalMonths = eachMonthOfInterval({ start, end });

            return intervalMonths.map(month => {
                const monthEnd = endOfMonth(month);

                const cumulativeReceived = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isBeforeOrInMonth = s.valor_pago > 0 && isBefore(dateToUse, endOfDay(monthEnd));
                        if (!isBeforeOrInMonth) return false;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, s) => acc + (s.valor_pago || 0), 0);
                
                const cumulativePaidSuppliers = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isBeforeOrInMonth = a.status === 'pago' && isBefore(dueDate, endOfDay(monthEnd));
                        if (!isBeforeOrInMonth) return false;
                        if (a.tipo_referencia !== 'fornecedor') return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: cumulativeReceived, 
                    despesas: cumulativePaidSuppliers,
                    saldo: cumulativeReceived - cumulativePaidSuppliers
                };
            });
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient]);

    const cumulativeDailyData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfDay(dateRange.from);
            end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(start);
        } else {
            end = endOfDay(new Date());
            start = startOfDay(subDays(end, 90));
        }

        try {
            const intervalDays = eachDayOfInterval({ start, end });

            return intervalDays.map(day => {
                const dayEnd = endOfDay(day);

                const cumulativeReceived = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isBeforeOrInDay = s.valor_pago > 0 && isBefore(dateToUse, dayEnd);
                        if (!isBeforeOrInDay) return false;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, s) => acc + (s.valor_pago || 0), 0);
                
                const cumulativePaid = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isBeforeOrInDay = a.status === 'pago' && isBefore(dueDate, dayEnd);
                        if (!isBeforeOrInDay) return false;
                        if (selectedEmployee && a.referencia_id !== selectedEmployee) return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return {
                    name: format(day, 'dd/MM'),
                    receitas: cumulativeReceived,
                    despesas: cumulativePaid,
                    saldo: cumulativeReceived - cumulativePaid
                };
            });
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient, selectedEmployee]);

    const monthlyCashFlowSuppliersData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfMonth(dateRange.from);
            end = dateRange.to ? endOfMonth(dateRange.to) : endOfMonth(start);
        } else {
            end = endOfMonth(new Date());
            start = startOfMonth(subMonths(end, 11));
        }

        try {
            const intervalMonths = eachMonthOfInterval({ start, end });

            return intervalMonths.map(month => {
                const monthStart = startOfMonth(month);
                const monthEnd = endOfMonth(month);

                const received = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isInMonth = s.valor_pago > 0 && dateToUse >= monthStart && dateToUse <= monthEnd;
                        if (!isInMonth) return false;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, s) => acc + (s.valor_pago || 0), 0);
                
                const paidSuppliers = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isInMonth = a.status === 'pago' && dueDate >= monthStart && dueDate <= monthEnd;
                        if (!isInMonth) return false;
                        if (a.tipo_referencia !== 'fornecedor') return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: received, 
                    despesas: paidSuppliers,
                    saldo: received - paidSuppliers
                };
            });
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient]);

    const monthlyCashFlowTotalData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfMonth(dateRange.from);
            end = dateRange.to ? endOfMonth(dateRange.to) : endOfMonth(start);
        } else {
            end = endOfMonth(new Date());
            start = startOfMonth(subMonths(end, 11));
        }

        try {
            const intervalMonths = eachMonthOfInterval({ start, end });

            return intervalMonths.map(month => {
                const monthStart = startOfMonth(month);
                const monthEnd = endOfMonth(month);

                const received = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isInMonth = s.valor_pago > 0 && dateToUse >= monthStart && dateToUse <= monthEnd;
                        if (!isInMonth) return false;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, s) => acc + (s.valor_pago || 0), 0);
                
                const paidTotal = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isInMonth = a.status === 'pago' && dueDate >= monthStart && dueDate <= monthEnd;
                        if (!isInMonth) return false;
                        if (selectedEmployee && a.referencia_id !== selectedEmployee) return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((acc, a) => acc + (a.valor || 0), 0);

                return { 
                    name: format(month, 'MMM/yy', { locale: ptBR }), 
                    receitas: received, 
                    despesas: paidTotal,
                    saldo: received - paidTotal
                };
            });
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient, selectedEmployee]);
    
    const dailyFinancialsData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (dateRange?.from) {
            start = startOfDay(dateRange.from);
            end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(start);
        } else {
            const allDates = [
                ...services.filter(s => s.valor_pago > 0).map(s => (s.data_ultimo_pagamento || s.data_cadastro).getTime()),
                ...accountsPayable.filter(a => a.status === 'pago').map(a => a.vencimento.getTime())
            ].filter(t => !isNaN(t));

            if (allDates.length > 0) {
                const maxD = Math.max(...allDates);
                start = startOfDay(subDays(new Date(maxD), 90));
                end = endOfDay(new Date(maxD));
            } else {
                start = startOfDay(subDays(new Date(), 30));
                end = endOfDay(new Date());
            }
        }

        try {
            const intervalDays = eachDayOfInterval({ start, end });

            return intervalDays.map(day => {
                const dayStart = startOfDay(day);
                const dayEnd = endOfDay(day);

                const dailyRevenue = services
                    .filter(s => {
                        const dateToUse = s.data_ultimo_pagamento || s.data_cadastro;
                        const isSameDay = s.valor_pago > 0 && dateToUse >= dayStart && dateToUse <= dayEnd;
                        if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                        if (selectedClient && s.cliente_id !== selectedClient) return false;
                        return isSameDay;
                    })
                    .reduce((sum, s) => sum + (s.valor_pago || 0), 0);

                const dailyExpensesFornecedores = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isMatch = a.status === 'pago' && a.tipo_referencia === 'fornecedor' && dueDate >= dayStart && dueDate <= dayEnd;
                        if (!isMatch) return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((sum, a) => sum + (a.valor || 0), 0);

                const dailyExpensesFolha = accountsPayable
                    .filter(a => {
                        const dueDate = a.vencimento;
                        const isMatch = a.status === 'pago' && a.tipo_referencia === 'funcionario' && dueDate >= dayStart && dueDate <= dayEnd;
                        if (!isMatch) return false;
                        if (selectedEmployee && a.referencia_id !== selectedEmployee) return false;
                        if (selectedClient && a.cliente_id !== selectedClient) return false;
                        return true;
                    })
                    .reduce((sum, a) => sum + (a.valor || 0), 0);

                return {
                    name: format(day, 'dd/MM'),
                    receitas: dailyRevenue,
                    despesasFornecedores: dailyExpensesFornecedores,
                    despesasFolha: dailyExpensesFolha,
                };
            }).filter(d => d.receitas > 0 || d.despesasFornecedores > 0 || d.despesasFolha > 0); 
        } catch (e) {
            return [];
        }
    }, [services, accountsPayable, dateRange, selectedCityFilter, selectedClient, selectedEmployee]);

    const revenueStatusData = useMemo(() => {
        const baseServices = services.filter(s => {
            if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
            if (selectedClient && s.cliente_id !== selectedClient) return false;
            if (dateRange?.from) {
                const from = startOfDay(dateRange.from);
                const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(from);
                const date = s.data_cadastro;
                return date >= from && date <= to;
            }
            return true;
        });

        const totalPaid = baseServices.reduce((sum, s) => sum + (s.valor_pago || 0), 0);
        const totalPending = baseServices.reduce((sum, s) => sum + (s.saldo_devedor || 0), 0);
        
        return [
            { name: 'Recebido', value: totalPaid },
            { name: 'A Receber', value: totalPending },
        ].filter(item => item.value > 0);
    }, [services, selectedCityFilter, selectedClient, dateRange]);


    const serviceStatusData = useMemo(() => {
        const base = services.filter(s => {
            if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
            if (selectedClient && s.cliente_id !== selectedClient) return false;
            if (dateRange?.from) {
                const from = startOfDay(dateRange.from);
                const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(from);
                const date = s.data_cadastro;
                if (date < from || date > to) return false;
            }
            return s.status_financeiro !== 'cancelado';
        });

        const total = base.length;
        const inProgress = base.filter(s => s.status_execucao === 'em andamento').length;
        const completed = base.filter(s => s.status_execucao === 'finalizado').length;

        return [
            { name: 'Cadastrados', value: total, fill: COLORS[0] },
            { name: 'Em Andamento', value: inProgress, fill: COLORS[2] },
            { name: 'Concluídos', value: completed, fill: COLORS[1] },
        ];
    }, [services, selectedCityFilter, selectedClient, dateRange]);

    const revenueByClientData = useMemo(() => {
        return clients
            .map(client => {
                const clientServices = services.filter(s => {
                    const match = s.cliente_id === client.codigo_cliente;
                    if (!match) return false;
                    if (selectedCityFilter && s.endereco_obra?.city !== selectedCityFilter) return false;
                    if (dateRange?.from) {
                        const from = startOfDay(dateRange.from);
                        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(from);
                        const date = s.data_ultimo_pagamento || s.data_cadastro;
                        if (date < from || date > to) return false;
                    }
                    return true;
                });
                const totalRevenue = clientServices.reduce((sum, s) => sum + (s.valor_pago || 0), 0);
                return { 
                    name: client.nome_completo, 
                    receita: totalRevenue,
                    contratos: clientServices.length
                };
            })
            .filter(c => c.receita > 0)
            .sort((a, b) => b.receita - a.receita)
            .slice(0, 5);
    }, [clients, services, selectedCityFilter, dateRange]);
        
    const handleClearFilters = () => {
        setDateRange(undefined);
        setSelectedClient('');
        setSelectedEmployee('');
        setSelectedCityFilter('');
    }

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
        )
    }
    
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
                title="Analytics"
                description="Visualize graficamente os dados da sua empresa."
            />
            
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} - {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>) : (format(dateRange.from, "LLL dd, y", { locale: ptBR }))) : (<span>Todo o período</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                        </PopoverContent>
                    </Popover>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por cliente..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" onClick={() => setSelectedClient('')}>Todos os clientes</SelectItem>
                            {clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por funcionário..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" onClick={() => setSelectedEmployee('')}>Todos os funcionários</SelectItem>
                            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filtrar por cidade..." />
                        </SelectTrigger>
                        <SelectContent>
                            {cities.map(city => (
                                <SelectItem key={city.id} value={city.nome_cidade}>
                                    {city.nome_cidade}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                        <XCircle className="mr-2 h-4 w-4"/>
                        Limpar Filtros
                    </Button>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-8">
                {/* 1. Crescimento Histórico Mensal (Cumulativo) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            Crescimento Histórico Mensal (Cumulativo)
                        </CardTitle>
                        <CardDescription>Evolução da soma total de entradas e saídas ao longo do período.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={cumulativeMonthlyData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="monotone" dataKey="receitas" stroke={POSITIVE_COLOR} strokeWidth={3} dot={{ r: 4 }} name="Receitas Acumuladas" />
                                <Line type="monotone" dataKey="despesas" stroke={NEGATIVE_COLOR} strokeWidth={3} dot={{ r: 4 }} name="Despesas Acumuladas" />
                                <Line type="monotone" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={4} strokeDasharray="5 5" name="Saldo no Período" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 2. Crescimento Histórico Mensal - Apenas Fornecedores (Cumulativo) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-orange-500" />
                            Crescimento Histórico Mensal (Apenas Fornecedores)
                        </CardTitle>
                        <CardDescription>Evolução acumulada focada em gastos com fornecedores comparados à receita total.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={cumulativeMonthlySuppliersData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="monotone" dataKey="receitas" stroke={POSITIVE_COLOR} strokeWidth={3} dot={{ r: 4 }} name="Receitas Totais" />
                                <Line type="monotone" dataKey="despesas" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} name="Despesas Fornecedores" />
                                <Line type="monotone" dataKey="saldo" stroke="#64748b" strokeWidth={4} strokeDasharray="5 5" name="Saldo (Rec - Forn)" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 3. Crescimento Histórico Diário (Cumulativo) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            Crescimento Histórico Diário (Cumulativo)
                        </CardTitle>
                        <CardDescription>Detalhamento dia a dia do saldo acumulado (Últimos 90 dias ou período filtrado).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <LineChart data={cumulativeDailyData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line type="stepAfter" dataKey="receitas" stroke={POSITIVE_COLOR} strokeWidth={2} dot={false} name="Receitas Acumuladas" />
                                <Line type="stepAfter" dataKey="despesas" stroke={NEGATIVE_COLOR} strokeWidth={2} dot={false} name="Despesas Acumuladas" />
                                <Line type="stepAfter" dataKey="saldo" stroke={BALANCE_COLOR} strokeWidth={3} dot={false} name="Saldo em Caixa" />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 4. Fluxo de Caixa Mensal (Receitas vs. Fornecedores) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-green-600" />
                            Fluxo de Caixa Mensal (Receitas vs. Fornecedores)
                        </CardTitle>
                        <CardDescription>Soma de todas as entradas e saídas com fornecedores ocorridas em cada mês.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <BarChart data={monthlyCashFlowSuppliersData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="receitas" fill={POSITIVE_COLOR} name="Receitas do Mês" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="despesas" fill="#f97316" name="Gastos Fornecedores" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 5. Fluxo de Caixa Mensal (Receitas vs. Despesas Totais) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-blue-600" />
                            Fluxo de Caixa Mensal (Receitas vs. Despesas Totais)
                        </CardTitle>
                        <CardDescription>Soma de todas as entradas e saídas totais (fornecedores e folha) ocorridas em cada mês.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <BarChart data={monthlyCashFlowTotalData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="receitas" fill={POSITIVE_COLOR} name="Receitas do Mês" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="despesas" fill={NEGATIVE_COLOR} name="Total Despesas" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 6. Fluxo de Caixa (Diário) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Fluxo de Caixa (Diário)</CardTitle>
                        <CardDescription>Entradas e saídas diárias detalhadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                           <AreaChart data={dailyFinancialsData}>
                                 <defs>
                                    <linearGradient id="colorReceitasDiario" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={POSITIVE_COLOR} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={POSITIVE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorFornecedoresDiario" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={NEGATIVE_COLOR} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={NEGATIVE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorFolhaDiario" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={PAYROLL_COLOR} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={PAYROLL_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${value/1000}k`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR')}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area type="monotone" dataKey="receitas" stroke={POSITIVE_COLOR} fillOpacity={1} fill="url(#colorReceitasDiario)" name="Receitas" />
                                <Area type="monotone" dataKey="despesasFornecedores" stroke={NEGATIVE_COLOR} fillOpacity={1} fill="url(#colorFornecedoresDiario)" name="Fornecedores" />
                                <Area type="monotone" dataKey="despesasFolha" stroke={PAYROLL_COLOR} fillOpacity={1} fill="url(#colorFolhaDiario)" name="Folha Pagto" />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 7. Receita: Recebido vs. A Receber */}
                <Card>
                    <CardHeader>
                        <CardTitle>Receita: Recebido vs. A Receber</CardTitle>
                        <CardDescription>Proporção do valor total contratado.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <ChartContainer config={{}} className="h-[300px] w-[300px]">
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />} />
                                <Pie data={revenueStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={renderCustomizedLabel}>
                                    <Cell key={`cell-recebido`} fill={POSITIVE_COLOR} />
                                    <Cell key={`cell-a-receber`} fill={NEGATIVE_COLOR} />
                                </Pie>
                                <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 8. Top 5 Clientes por Receita */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Clientes por Receita</CardTitle>
                        <CardDescription>Clientes que mais geraram receita.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={revenueByClientData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} />
                                <ChartTooltip 
                                    content={
                                        <ChartTooltipContent 
                                            formatter={(value, name, item) => (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Receita:</span>
                                                        <span className="font-bold">R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Contratos:</span>
                                                        <span className="font-bold">{item.payload.contratos}</span>
                                                    </div>
                                                </div>
                                            )}
                                        />
                                    } 
                                />
                                <Bar dataKey="receita" fill={POSITIVE_COLOR} radius={4} name="Receita" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* 9. Status dos Serviços */}
                <Card>
                    <CardHeader>
                        <CardTitle>Status dos Serviços</CardTitle>
                        <CardDescription>Contagem de serviços por status de execução.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={serviceStatusData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(value) => Number(value).toLocaleString('pt-BR')}/>} />
                                <Bar dataKey="value" name="Total" radius={4}>
                                    {serviceStatusData.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
