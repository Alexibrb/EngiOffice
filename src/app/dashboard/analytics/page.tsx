
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, Client, Account, Commission, Employee } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

                setServices(servicesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, data_cadastro: doc.data().data_cadastro.toDate() } as Service)));
                setClients(clientsSnap.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client)));
                setAccountsPayable(accountsPayableSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, vencimento: doc.data().vencimento.toDate() } as Account)));
                setCommissions(commissionsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, data: doc.data().data.toDate() } as Commission)));
                setEmployees(employeesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Employee)));

            } catch (error) {
                console.error("Erro ao buscar dados para analytics:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const financialOverviewData = () => {
        const data: { name: string; recebido: number; pago: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const monthName = format(date, 'MMM/yy', { locale: ptBR });
            const monthStart = startOfMonth(date);

            const received = services
                .filter(s => s.valor_pago > 0 && s.data_cadastro >= monthStart && s.data_cadastro < startOfMonth(subMonths(new Date(), i - 1)))
                .reduce((acc, s) => acc + s.valor_pago, 0);
            
            const paid = accountsPayable
                .filter(a => a.status === 'pago' && a.vencimento >= monthStart && a.vencimento < startOfMonth(subMonths(new Date(), i - 1)))
                .reduce((acc, a) => acc + a.valor, 0);

            data.push({ name: monthName, recebido: received, pago: paid });
        }
        return data;
    };

    const serviceStatusData = [
        { name: 'Em Andamento', value: services.filter(s => s.status === 'em andamento').length },
        { name: 'Concluído', value: services.filter(s => s.status === 'concluído').length },
        { name: 'Cancelado', value: services.filter(s => s.status === 'cancelado').length },
    ].filter(item => item.value > 0);

    const revenueByClientData = clients
        .map(client => {
            const clientServices = services.filter(s => s.cliente_id === client.codigo_cliente);
            const totalRevenue = clientServices.reduce((sum, s) => sum + (s.valor_pago || 0), 0);
            return { name: client.nome_completo, receita: totalRevenue };
        })
        .filter(c => c.receita > 0)
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 5);
        
    const commissionByEmployeeData = employees
        .filter(emp => emp.tipo_contratacao === 'comissao')
        .map(employee => {
            const employeeCommissions = commissions.filter(c => c.funcionario_id === employee.id && c.status === 'pago');
            const totalCommission = employeeCommissions.reduce((sum, c) => sum + c.valor, 0);
            return { name: employee.nome, comissao: totalCommission };
        })
        .filter(e => e.comissao > 0)
        .sort((a, b) => b.comissao - a.comissao)
        .slice(0, 5);

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
                title="Analytics"
                description="Visualize graficamente os dados da sua empresa."
            />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Visão Geral Financeira</CardTitle>
                        <CardDescription>Receita vs. Despesas nos últimos 6 meses.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={financialOverviewData()}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="recebido" fill="var(--color-chart-2)" radius={4} name="Recebido" />
                                <Bar dataKey="pago" fill="var(--color-chart-5)" radius={4} name="Pago"/>
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Status dos Serviços</CardTitle>
                        <CardDescription>Distribuição dos serviços por status.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <ChartContainer config={{}} className="h-[300px] w-[300px]">
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                <Pie data={serviceStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {serviceStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Clientes por Receita</CardTitle>
                        <CardDescription>Clientes que mais geraram receita para a empresa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={revenueByClientData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="receita" fill="var(--color-chart-1)" radius={4} name="Receita" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Funcionários por Comissão</CardTitle>
                        <CardDescription>Comissões pagas aos funcionários com melhor desempenho.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[300px] w-full">
                            <BarChart data={commissionByEmployeeData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150}/>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="comissao" fill="var(--color-chart-3)" radius={4} name="Comissão" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

