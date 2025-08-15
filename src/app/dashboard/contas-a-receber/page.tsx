
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
} from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast"
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar as CalendarIcon, Download, ExternalLink, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import type { Client, Service } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContasAReceberPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const { toast } = useToast();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const fetchData = async () => {
        try {
            const [servicesSnapshot, clientsSnapshot] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
            ]);
            
            const servicesData = servicesSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, data_cadastro: data.data_cadastro.toDate() } as Service;
            });
            setServices(servicesData);

            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
            setClients(clientsData);

        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados." });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getClientName = (id: string) => {
        return clients.find(c => c.codigo_cliente === id)?.nome_completo || 'Desconhecido';
    };

    const generatePdf = () => {
        const doc = new jsPDF();
        const title = 'Relatório de Contas a Receber (Serviços)';
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${title} - EngiFlow`, 14, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
        autoTable(doc, {
            startY: 35,
            head: [['Descrição', 'Cliente', 'Data de Cadastro', 'Valor', 'Status']],
            body: filteredReceivable.map((service) => [
            service.descricao,
            getClientName(service.cliente_id),
            format(service.data_cadastro, 'dd/MM/yyyy'),
            `R$ ${service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            service.status,
            ]),
            theme: 'striped',
            headStyles: { fillColor: [34, 139, 34] },
        });
    
        doc.save(`relatorio_financeiro_receber.pdf`);
      };

    const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
    }

    const filteredReceivable = services
        .filter(service => {
            return statusFilter ? service.status === statusFilter : true;
        })
        .filter(service => {
            if (!dateRange?.from) return true;
            const fromDate = dateRange.from;
            const toDate = dateRange.to ? dateRange.to : fromDate;
            const serviceDate = service.data_cadastro;
            return serviceDate >= fromDate && serviceDate <= addDays(toDate, 1);
        });

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary">Contas a Receber</h1>
                <p className="text-muted-foreground">
                    Gerencie os serviços prestados a serem recebidos dos clientes.
                </p>
            </div>
            
             <Card>
                 <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Lançamentos</CardTitle>
                        </div>
                        <Button onClick={generatePdf} variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Exportar PDF
                        </Button>
                    </div>
                     <div className="flex items-center gap-4 p-4 mt-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn( "w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                      dateRange.to ? (
                                        <>
                                          {format(dateRange.from, "LLL dd, y")} -{" "}
                                          {format(dateRange.to, "LLL dd, y")}
                                        </>
                                      ) : (
                                        format(dateRange.from, "LLL dd, y")
                                      )
                                    ) : (
                                      <span>Filtrar por data...</span>
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
                                  />
                                </PopoverContent>
                            </Popover>
                        </div>
                         <div className="flex items-center gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filtrar por status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="em andamento">Em andamento</SelectItem>
                                    <SelectItem value="concluído">Concluído</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                         <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                            <XCircle className="mr-2 h-4 w-4"/>
                            Limpar Filtros
                         </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ReceivableTableComponent 
                        services={filteredReceivable} 
                        getClientName={getClientName} 
                    />
                </CardContent>
            </Card>
        </div>
    );
}


function ReceivableTableComponent({ services, getClientName }: { 
    services: Service[], 
    getClientName: (id: string) => string
}) {
    const router = useRouter();

    const handleEditService = (serviceId: string) => {
        router.push(`/dashboard/servicos?edit=${serviceId}`);
    };

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data de Cadastro</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                         <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.length > 0 ? services.map((service) => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.descricao}</TableCell>
                            <TableCell>{getClientName(service.cliente_id)}</TableCell>
                            <TableCell>{format(service.data_cadastro, 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-green-500">R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                                <Badge variant={
                                    service.status === 'concluído' ? 'secondary' :
                                    service.status === 'cancelado' ? 'destructive' :
                                    'default'
                                }>
                                    {service.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditService(service.id)}
                                >
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  Ver/Editar Serviço
                                </Button>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">Nenhum serviço encontrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

