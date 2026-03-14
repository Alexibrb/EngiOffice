
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { Service, Client, Account, Employee, AuthorizedUser, City, ServicePayment, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, XCircle, Calendar as CalendarIcon, ShieldAlert, TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const POSITIVE_COLOR = '#16a34a'; // Verde
const NEGATIVE_COLOR = '#dc2626'; // Vermelho
const BALANCE_COLOR = '#3b82f6';  // Azul

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [receivables, setReceivables] = useState<ServicePayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedClient, setSelectedClient] = useState('');
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
            const [servicesSnap, clientsSnap, accountsPayableSnap, citiesSnap, receivablesSnap] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "cidades")),
                getDocs(collection(db, "recebimentos")),
            ]);

            const servicesData = servicesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
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

            const citiesData = citiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as City));
            
            const receivablesData = receivablesSnap.docs.map(doc => {
                const data = doc.data();
                let paymentDate: Date;
                if (data.data instanceof Timestamp) {
                    paymentDate = data.data.toDate();
                } else if (data.data) {
                    paymentDate = new Date(data.data);
                } else {
                    paymentDate = new Date();
                }
                return {
                    ...data,
                    id: doc.id,
                    data: paymentDate,
                } as ServicePayment;
            });

            setServices(servicesData);
            setClients(clientsData);
            setAccountsPayable(accountsData);
            setCities(citiesData.sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade)));
            setReceivables(receivablesData);

        } catch (error) {
            console.error("Erro ao buscar dados para analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredReceivables = useMemo(() => {
        return receivables.filter(r => {
            const service = services.find(s => s.id === r.servico_id);
            if (!service) return false;

            const matchesCity = !selectedCityFilter || selectedCityFilter === 'none' || service.endereco_obra?.city === selectedCityFilter;
            const matchesClient = !selectedClient || selectedClient === 'none' || r.cliente_id === selectedClient;
            
            return matchesCity && matchesClient;
        });
    }, [receivables, services, selectedCityFilter, selectedClient]);

    const filteredAccountsPaid = useMemo(() => {
        return accountsPayable.filter(a => {
            if (a.status !== 'pago') return false;

            if (a.servico_id) {
                const service = services.find(s => s.id === a.servico_id);
                if (!service) return false;
                if (selectedCityFilter && selectedCityFilter !== 'none' && service.endereco_obra?.city !== selectedCityFilter) return false;
            } else {
                if (selectedCityFilter && selectedCityFilter !== 'none') return false;
            }

            const matchesClient = !selectedClient || selectedClient === 'none' || a.cliente_id === selectedClient;
            return matchesClient;
        });
    }, [accountsPayable, services, selectedClient, selectedCityFilter]);

    const cumulativeMonthlyData = useMemo(() => {
        if (services.length === 0 && accountsPayable.length === 0 && receivables.length === 0) return [];

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
            const months = eachMonthOfInterval({ start, end });

            return months.map(month => {
                const monthEnd = endOfMonth(month);

                const totalReceivedUntilNow = filteredReceivables
                    .filter(r => !isAfter(r.data, monthEnd))
                    .reduce((acc, r) => acc + (r.valor || 0), 0);
                
                const totalPaidUntilNow = filteredAccountsPaid
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
    }, [filteredReceivables, filteredAccountsPaid, dateRange, services, accountsPayable, receivables]);

    const handleClearFilters = () => {
        setDateRange(undefined);
        setSelectedClient('');
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

    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
                title="Analytics"
                description="Visualize graficamente o crescimento e a saúde financeira da sua empresa."
            />
            
            <Card>
                <CardHeader>
                    <CardTitle>Filtros de Dashboard</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>) : (format(dateRange.from, "dd/MM/yy"))) : (<span>Ver período específico...</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                        </PopoverContent>
                    </Popover>
                    
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Crescimento Histórico Mensal (Cumulativo)
                    </CardTitle>
                    <CardDescription>
                        Evolução total do patrimônio. As linhas mostram a soma de todas as entradas e saídas desde o início até o mês indicado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="h-[400px] w-full">
                        <LineChart data={cumulativeMonthlyData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis 
                                tickFormatter={(value) => `R$${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/>} />
                            <ChartLegend content={<ChartLegendContent />} />
                            
                            <Line 
                                type="monotone" 
                                dataKey="receitas" 
                                stroke={POSITIVE_COLOR} 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: POSITIVE_COLOR }} 
                                name="Receitas Totais" 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="despesas" 
                                stroke={NEGATIVE_COLOR} 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: NEGATIVE_COLOR }} 
                                name="Despesas Totais" 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="saldo" 
                                stroke={BALANCE_COLOR} 
                                strokeWidth={4} 
                                strokeDasharray="5 5" 
                                name="Saldo Acumulado" 
                            />
                        </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
