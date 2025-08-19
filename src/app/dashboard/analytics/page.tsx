
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, Client, Account, Commission, Employee } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Loader2, XCircle, Calendar as CalendarIcon, Wrench, CheckCircle, CircleOff } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [servicesSnap, clientsSnap, accountsPayableSnap, commissionsSnap, employeesSnap] = await Promise.all([
                    getDocs(collection(db, "servicos")),
                    getDocs(collection(db, "clientes")),
                    getDocs(collection(db, "contas_a_pagar")),
                    getDocs(collection(db, "comissoes")),
                    getDocs(collection(db, "funcionarios")),
                ]);

                const servicesData = servicesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, data_cadastro: doc.data().data_cadastro.toDate() } as Service));
                const clientsData = clientsSnap.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client));
                const accountsData = accountsPayableSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, vencimento: doc.data().vencimento.toDate() } as Account));
                const commissionsData = commissionsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, data: doc.data().data.toDate() } as Commission));
                const employeesData = employeesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Employee));

                setServices(servicesData);
                setClients(clientsData);
                setAccountsPayable(accountsData);
                setCommissions(commissionsData);
                setEmployees(employeesData);

            } catch (error) {
                console.error("Erro ao buscar dados para analytics:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredServices = useMemo(() => {
        return services.filter(service => {
            const serviceDate = new Date(service.data_cadastro);
            if (isNaN(serviceDate.getTime())) return false; // Invalid date guard

            const inDateRange = dateRange?.from ? (serviceDate >= dateRange.from && serviceDate <= (dateRange.to || dateRange.from)) : true;
            const clientMatch = selectedClient ? service.cliente_id === selectedClient : true;
            return inDateRange && clientMatch;
        });
    }, [services, dateRange, selectedClient]);
    
    const filteredCommissions = useMemo(() => {
         return commissions.filter(commission => {
            const commissionDate = new Date(commission.data);
            if (isNaN(commissionDate.getTime())) return false;

            const inDateRange = dateRange?.from ? (commissionDate >= dateRange.from && commissionDate <= (dateRange.to || dateRange.from)) : true;
            const employeeMatch = selectedEmployee ? commission.funcionario_id === selectedEmployee : true;
            const clientMatch = selectedClient ? commission.cliente_id === selectedClient : true;
            return inDateRange && employeeMatch && clientMatch;
        });
    }, [commissions, dateRange, selectedClient, selectedEmployee])

    const filteredAccountsPayable = useMemo(() => {
         return accountsPayable.filter(account => {
            const dueDate = new Date(account.vencimento);
            if (isNaN(dueDate.getTime())) return false;

            const inDateRange = dateRange?.from ? (dueDate >= dateRange.from && dueDate <= (dateRange.to || dateRange.from)) : true;
            return inDateRange;
        });
    }, [accountsPayable, dateRange])


    const financialOverviewData = () => {
        const data: { name: string; recebido: number; pago: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const monthName = format(date, 'MMM/yy', { locale: ptBR });
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);

            const received = filteredServices
                .filter(s => {
                    const serviceDate = new Date(s.data_cadastro);
                    return s.valor_pago > 0 && !isNaN(serviceDate.getTime()) && serviceDate >= monthStart && serviceDate <= monthEnd;
                })
                .reduce((acc, s) => acc + s.valor_pago, 0);
            
            const paid = filteredAccountsPayable
                .filter(a => {
                    const dueDate = new Date(a.vencimento);
                    return a.status === 'pago' && !isNaN(dueDate.getTime()) && dueDate >= monthStart && dueDate <= monthEnd;
                })
                .reduce((acc, a) => acc + a.valor, 0);

            data.push({ name: monthName, recebido: received, pago: paid });
        }
        return data;
    };

    const commissionByMonthData = () => {
        const data: { name: string; comissao: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const monthName = format(date, 'MMM/yy', { locale: ptBR });
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);

            const paidCommissions = filteredCommissions
                .filter(c => {
                    const commissionDate = new Date(c.data);
                    return c.status === 'pago' && !isNaN(commissionDate.getTime()) && commissionDate >= monthStart && commissionDate <= monthEnd
                })
                .reduce((acc, c) => acc + c.valor, 0);
            
            data.push({ name: monthName, comissao: paidCommissions });
        }
        return data;
    }
    
    const revenueStatusData = useMemo(() => {
        const totalPaid = filteredServices.reduce((sum, s) => sum + (s.valor_pago || 0), 0);
        const totalPending = filteredServices.reduce((sum, s) => sum + (s.saldo_devedor || 0), 0);
        
        return [
            { name: 'Recebido', value: totalPaid },
            { name: 'A Receber', value: totalPending },
        ].filter(item => item.value > 0);
    }, [filteredServices]);


    const serviceStatusData = useMemo(() => {
        const total = filteredServices.filter(s => s.status !== 'cancelado').length;
        const inProgress = filteredServices.filter(s => s.status === 'em andamento').length;
        const completed = filteredServices.filter(s => s.status === 'concluído').length;

        return [
            { name: 'Cadastrados', value: total, fill: COLORS[0] },
            { name: 'Em Andamento', value: inProgress, fill: COLORS[2] },
            { name: 'Concluídos', value: completed, fill: COLORS[1] },
        ];
    }, [filteredServices]);

    const revenueByClientData = clients
        .map(client => {
            const clientServices = filteredServices.filter(s => s.cliente_id === client.codigo_cliente);
            const totalRevenue = clientServices.reduce((sum, s) => sum + (s.valor_pago || 0), 0);
            return { name: client.nome_completo, receita: totalRevenue };
        })
        .filter(c => c.receita > 0)
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 5);
        
    const handleClearFilters = () => {
        setDateRange(undefined);
        setSelectedClient('');
        setSelectedEmployee('');
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
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
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} - {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>) : (format(dateRange.from, "LLL dd, y", { locale: ptBR }))) : (<span>Filtrar por período</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                        </PopoverContent>
                    </Popover>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por cliente..." /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por funcionário..." /></SelectTrigger>
                        <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                        <XCircle className="mr-2 h-4 w-4"/>
                        Limpar Filtros
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Visão Geral Financeira</CardTitle>
                        <CardDescription>Receita vs. Despesas nos últimos 6 meses (baseado nos filtros).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <AreaChart data={financialOverviewData()}>
                                 <defs>
                                    <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={POSITIVE_COLOR} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={POSITIVE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={NEGATIVE_COLOR} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={NEGATIVE_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${value/1000}k`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}/>} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area type="monotone" dataKey="recebido" stroke={POSITIVE_COLOR} fillOpacity={1} fill="url(#colorRecebido)" name="Recebido" />
                                <Area type="monotone" dataKey="pago" stroke={NEGATIVE_COLOR} fillOpacity={1} fill="url(#colorPago)" name="Pago" />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Status dos Serviços</CardTitle>
                        <CardDescription>Contagem de serviços por status (baseado nos filtros).</CardDescription>
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

                 <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Clientes por Receita</CardTitle>
                        <CardDescription>Clientes que mais geraram receita (baseado nos filtros).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={revenueByClientData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} />
                                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}/>} />
                                <Bar dataKey="receita" fill={POSITIVE_COLOR} radius={4} name="Receita" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Comissões por Mês</CardTitle>
                        <CardDescription>Total de comissões pagas nos últimos 6 meses (baseado nos filtros).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                           <BarChart data={commissionByMonthData()}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => `R$${value/1000}k`}/>
                                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}/>} />
                                <Bar dataKey="comissao" fill={NEGATIVE_COLOR} radius={4} name="Comissão" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Receita: Recebido vs. A Receber</CardTitle>
                        <CardDescription>Proporção do valor total dos serviços que foi pago versus o que está pendente.</CardDescription>
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
            </div>
        </div>
    );
}
