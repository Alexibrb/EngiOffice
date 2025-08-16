
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
  TableFooter,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast"
import { collection, getDocs, doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar as CalendarIcon, Download, ExternalLink, XCircle, ArrowUp, TrendingUp, MoreHorizontal, HandCoins, FileText, Loader2, User, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import type { Client, Service, Employee, Account, Commission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ptBR } from 'date-fns/locale';

const paymentSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

export default function ContasAReceberPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [financials, setFinancials] = useState({
      balance: 0,
      commissionableEmployees: [] as Employee[],
    });
    const { toast } = useToast();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
    const [distributingService, setDistributingService] = useState<Service | null>(null);
    const [lastPaymentValue, setLastPaymentValue] = useState(0);

    const [editingService, setEditingService] = useState<Service | null>(null);
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);

    const paymentForm = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: { valor_pago: 0 },
    });

   const fetchFinancials = async () => {
        try {
             const [servicesSnap, accountsPayableSnap, employeesSnap, commissionsSnap] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "funcionarios")),
                getDocs(collection(db, "comissoes")),
            ]);

            const allServices = servicesSnap.docs.map(doc => doc.data() as Service);
            const totalRevenue = allServices
                .reduce((sum, s) => sum + (s.valor_total - s.saldo_devedor), 0);

            const allAccountsPayable = accountsPayableSnap.docs.map(doc => doc.data() as Account);
            const totalExpenses = allAccountsPayable
                .filter(acc => acc.status === 'pago')
                .reduce((sum, currentAccount) => sum + currentAccount.valor, 0);
            
            const allCommissions = commissionsSnap.docs.map(doc => doc.data() as Commission);
            const totalCommissionsPaid = allCommissions
                .filter(c => c.status === 'pago')
                .reduce((sum, c) => sum + c.valor, 0);

            const allEmployees = employeesSnap.docs.map(doc => ({...doc.data(), id: doc.id }) as Employee);
            const commissionableEmployees = allEmployees.filter(e => e.tipo_contratacao === 'comissao' && e.status === 'ativo');

            setFinancials({
                balance: totalRevenue - totalExpenses - totalCommissionsPaid,
                commissionableEmployees,
            });

        } catch (error) {
            console.error("Erro ao calcular finanças:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados financeiros para distribuição." });
        }
  };


    const fetchData = async () => {
        try {
            const [servicesSnapshot, clientsSnapshot] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
            ]);
            
            const servicesData = servicesSnapshot.docs.map(doc => {
                const data = doc.data();
                 return {
                  ...data,
                  id: doc.id,
                  data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
                } as Service
            });
            setServices(servicesData);

            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
            setClients(clientsData);

            await fetchFinancials();
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

    const handlePaymentClick = (service: Service) => {
        setEditingService(service);
        paymentForm.reset({ valor_pago: 0 });
        setIsPaymentDialogOpen(true);
    };

    const handleDistributionClick = (service: Service) => {
        setLastPaymentValue(0);
        setDistributingService(service);
        setIsDistributionDialogOpen(true);
    };

    const generateReceipt = (service: Service, paymentValue?: number) => {
        const client = clients.find(c => c.codigo_cliente === service.cliente_id);
        if (!client) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não encontrado para gerar o recibo.' });
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        const isPartialPayment = paymentValue !== undefined && paymentValue < service.valor_total;
        const valueToDisplay = isPartialPayment ? paymentValue : service.valor_total;
        const title = isPartialPayment ? 'RECIBO DE PAGAMENTO PARCIAL' : 'RECIBO DE PAGAMENTO';


        // Cabeçalho
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, 20, { align: 'center' });

        // Informações da Empresa
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('EngiFlow - Soluções em Engenharia', 20, 40);
        doc.text('CNPJ: 00.000.000/0001-00', 20, 46);
        doc.text('contato@engiflow.com', 20, 52);

        doc.setLineWidth(0.5);
        doc.line(20, 60, pageWidth - 20, 60);

        // Valor
        doc.setFontSize(14);
        doc.text('Valor:', 20, 70);
        doc.setFont('helvetica', 'bold');
        doc.text(`R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, 70, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setLineWidth(0.2);
        doc.line(20, 75, pageWidth - 20, 75);

        // Corpo do Recibo
        doc.setFontSize(12);
        const obraAddress = (client.endereco_obra && client.endereco_obra.street) ? `${client.endereco_obra.street}, ${client.endereco_obra.number} - ${client.endereco_obra.neighborhood}, ${client.endereco_obra.city} - ${client.endereco_obra.state}` : 'Endereço da obra não informado';
        const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj || 'Não informado'}, a importância de R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento ${isPartialPayment ? 'parcial' : ''} pelo serviço de "${service.descricao}".\n\nEndereço da Obra: ${obraAddress}`;
        const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
        doc.text(splitText, 20, 90);

        // Data e Assinatura
        const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
        doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, 20, 160);
        
        doc.line(pageWidth / 2 - 40, 190, pageWidth / 2 + 40, 190);
        doc.text('EngiFlow', pageWidth / 2, 195, { align: 'center' });


        doc.save(`recibo_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
    };

    const handleProcessPayment = async (values: z.infer<typeof paymentSchema>) => {
        if (!editingService) return;

        setIsPaymentLoading(true);
        try {
            const newBalance = editingService.saldo_devedor - values.valor_pago;
            if (newBalance < 0) {
                toast({ variant: 'destructive', title: 'Erro', description: 'O valor pago não pode ser maior que o saldo devedor.' });
                setIsPaymentLoading(false);
                return;
            }

            const serviceDocRef = doc(db, 'servicos', editingService.id);
            await updateDoc(serviceDocRef, {
                saldo_devedor: newBalance,
                status: newBalance === 0 ? 'concluído' : 'em andamento'
            });

            toast({ title: 'Sucesso!', description: 'Pagamento lançado com sucesso.' });
            
            generateReceipt(editingService, values.valor_pago);

            setIsPaymentDialogOpen(false);
            
            const updatedService = { ...editingService, saldo_devedor: newBalance, status: newBalance === 0 ? 'concluído' : 'em andamento' } as Service;
            
            setLastPaymentValue(values.valor_pago);
            setDistributingService(updatedService);
            setIsDistributionDialogOpen(true);
            await fetchData();


        } catch (error) {
            console.error("Erro ao processar pagamento: ", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar o pagamento.' });
        } finally {
            setIsPaymentLoading(false);
        }
    };
    
    const filteredReceivable = services
        .filter(service => {
            return statusFilter ? service.status === statusFilter : true;
        })
        .filter(service => {
            if (!dateRange?.from) return true;
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            const serviceDate = service.data_cadastro;
            return serviceDate >= fromDate && serviceDate <= toDate;
        });

    const totalReceivablePending = services
        .reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);

    const totalReceivablePaid = services.reduce((acc, curr) => curr.status === 'concluído' ? acc + curr.valor_total : acc, 0);

    const filteredTotal = filteredReceivable.reduce((acc, curr) => acc + curr.valor_total, 0);
    const filteredSaldoDevedor = filteredReceivable.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);

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
            head: [['Descrição', 'Cliente', 'Data de Cadastro', 'Valor Total', 'Saldo Devedor', 'Status']],
            body: filteredReceivable.map((service) => [
            service.descricao,
            getClientName(service.cliente_id),
            format(service.data_cadastro, 'dd/MM/yyyy'),
            `R$ ${(service.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            service.status,
            ]),
            foot: [
                ['Total', '', '', 
                `R$ ${filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${filteredSaldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                 '']
            ],
            theme: 'striped',
            headStyles: { fillColor: [34, 139, 34] },
            footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold' }
        });
    
        doc.save(`relatorio_financeiro_receber.pdf`);
      };

    const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary">Contas a Receber</h1>
                <p className="text-muted-foreground">
                    Gerencie os serviços prestados a serem recebidos dos clientes.
                </p>
            </div>
            
             <div className="grid gap-4 md:grid-cols-2">
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
                        <CardTitle className="text-sm font-medium">Receita de Serviços Concluídos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                         <p className="text-xs text-muted-foreground">
                            Soma do valor de todos os serviços concluídos
                        </p>
                    </CardContent>
                </Card>
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
                        totalValor={filteredTotal}
                        totalSaldo={filteredSaldoDevedor}
                        onPayment={handlePaymentClick}
                        onReceipt={generateReceipt}
                        onDistribute={handleDistributionClick}
                    />
                </CardContent>
            </Card>

             <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Lançar Pagamento</DialogTitle>
                        <DialogDescription>
                            Serviço: {editingService?.descricao}<br/>
                            Saldo Devedor Atual: <span className="font-bold text-red-500">R$ {(editingService?.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...paymentForm}>
                        <form onSubmit={paymentForm.handleSubmit(handleProcessPayment)} className="space-y-4">
                            <FormField
                                control={paymentForm.control}
                                name="valor_pago"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor Recebido (R$)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" variant="accent" disabled={isPaymentLoading}>
                                    {isPaymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmar Pagamento
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            {distributingService && (
            <ProfitDistributionDialog
                isOpen={isDistributionDialogOpen}
                setIsOpen={setIsDistributionDialogOpen}
                service={distributingService}
                paymentValue={lastPaymentValue}
                financials={financials}
                toast={toast}
                onDistributionComplete={fetchData}
            />
        )}
        </div>
    );
}


function ReceivableTableComponent({ services, getClientName, totalValor, totalSaldo, onPayment, onReceipt, onDistribute }: { 
    services: Service[], 
    getClientName: (id: string) => string,
    totalValor: number,
    totalSaldo: number,
    onPayment: (service: Service) => void,
    onReceipt: (service: Service) => void,
    onDistribute: (service: Service) => void,
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
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Saldo Devedor</TableHead>
                        <TableHead>Status</TableHead>
                         <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.length > 0 ? services.map((service) => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.descricao}</TableCell>
                            <TableCell>{getClientName(service.cliente_id)}</TableCell>
                            <TableCell className="text-green-500">R$ {(service.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-red-500">R$ {(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleEditService(service.id)}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Ver/Editar Serviço
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onPayment(service)} disabled={service.status === 'concluído' || service.status === 'cancelado'}>
                                            <HandCoins className="mr-2 h-4 w-4" />
                                            Lançar Pagamento
                                        </DropdownMenuItem>
                                         <DropdownMenuItem 
                                            onClick={() => onDistribute(service)} 
                                            disabled={service.status === 'cancelado' || service.saldo_devedor === service.valor_total}
                                         >
                                            <Users className="mr-2 h-4 w-4" />
                                            Distribuir Lucro
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onReceipt(service)}>
                                            <FileText className="mr-2 h-4 w-4" />
                                            Gerar Recibo
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">Nenhum serviço encontrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold text-green-500">
                           R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                         <TableCell className="text-right font-bold text-red-500">
                           R$ {totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}

function ProfitDistributionDialog({ isOpen, setIsOpen, service, paymentValue, financials, toast, onDistributionComplete }: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    service: Service;
    paymentValue: number;
    financials: { balance: number; commissionableEmployees: Employee[] };
    toast: any;
    onDistributionComplete: () => void;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [serviceCosts, setServiceCosts] = useState(0);
    const [profitMargin, setProfitMargin] = useState(0);

    const isManualTrigger = paymentValue === 0;
    const amountPaidSoFar = service.valor_total - service.saldo_devedor;
    const valueForCalculation = isManualTrigger ? amountPaidSoFar : paymentValue;

    useEffect(() => {
        const fetchCostsAndCalculateMargin = async () => {
            if (!service || !isOpen) return;
            
            setIsLoading(true);
            try {
                const accountsPayableSnap = await getDocs(collection(db, 'contas_a_pagar'));
                const accountsPayable = accountsPayableSnap.docs.map(doc => doc.data() as Account);
                const relatedExpenses = accountsPayable
                    .filter(acc => acc.servico_id === service.id)
                    .reduce((sum, acc) => sum + acc.valor, 0);
                
                const totalCosts = relatedExpenses;
                setServiceCosts(totalCosts);

                if (service.valor_total > 0) {
                    const margin = (service.valor_total - totalCosts) / service.valor_total;
                    setProfitMargin(margin);
                } else {
                    setProfitMargin(0);
                }

            } catch (error) {
                console.error("Erro ao buscar custos do serviço:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível calcular os custos do serviço.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCostsAndCalculateMargin();
    }, [isOpen, service, toast]);

    const profitFromPayment = valueForCalculation * profitMargin;
    const cashBalanceBeforeThisPayment = financials.balance;

    let amountToDistribute = profitFromPayment;
    let deficitCoverage = 0;

    if (cashBalanceBeforeThisPayment < 0) {
        deficitCoverage = Math.min(profitFromPayment, Math.abs(cashBalanceBeforeThisPayment));
        amountToDistribute -= deficitCoverage;
    }
    
    amountToDistribute = Math.max(0, amountToDistribute);

    const numEmployees = financials.commissionableEmployees.length;
    const individualCommission = numEmployees > 0 ? amountToDistribute / numEmployees : 0;
    
    const handleConfirmDistribution = async () => {
        if(numEmployees === 0) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum funcionário comissionado ativo encontrado para distribuir o lucro.' });
            return;
        }
        
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            
            financials.commissionableEmployees.forEach(employee => {
                const commissionData = {
                    funcionario_id: employee.id,
                    servico_id: service.id,
                    cliente_id: service.cliente_id,
                    valor: individualCommission,
                    data: Timestamp.now(),
                    status: 'pago', 
                };
                const commissionDocRef = doc(collection(db, 'comissoes'));
                batch.set(commissionDocRef, commissionData);
            });
            
            await batch.commit();

            toast({ title: 'Sucesso!', description: 'Lucro distribuído e comissões lançadas com sucesso!' });
            setIsOpen(false);
            onDistributionComplete();
        } catch (error) {
            console.error('Erro ao distribuir lucro:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar as comissões.' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Distribuir Lucro do Serviço</DialogTitle>
                    <DialogDescription>
                       {isManualTrigger 
                        ? `Revisão da distribuição do lucro total já pago para "${service.descricao}".`
                        : `Distribuição de lucro referente ao último pagamento para "${service.descricao}".`
                       }
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="p-4 border rounded-lg space-y-2 bg-muted/50">
                        <h4 className="font-semibold text-center mb-2">Resumo da Distribuição</h4>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{isManualTrigger ? 'Valor Total Pago:' : 'Valor do Pagamento:'}</span>
                            <span className="font-medium text-green-600">{valueForCalculation.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Margem de Lucro do Serviço:</span>
                            <span className="font-medium">{profitMargin.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lucro deste Montante:</span>
                            <span className="font-medium text-green-600">{profitFromPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Saldo de Caixa (antes do valor):</span>
                            <span className={cn("font-medium", cashBalanceBeforeThisPayment < 0 ? 'text-red-600' : 'text-green-600')}>{cashBalanceBeforeThisPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                         {cashBalanceBeforeThisPayment < 0 && (
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Cobertura de Déficit:</span>
                                <span className="font-medium text-orange-500">-{deficitCoverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                         )}
                        <div className="flex justify-between items-center text-lg border-t pt-2 mt-2">
                            <span className="font-bold">Valor a ser Distribuído:</span>
                            <span className="font-bold text-primary">{amountToDistribute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                     <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-semibold text-center mb-2">Comissão por Funcionário</h4>
                        {numEmployees > 0 ? (
                            financials.commissionableEmployees.map(emp => (
                                <div key={emp.id} className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{emp.nome}:</span>
                                    <span className="font-medium text-green-600">{individualCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-red-500">Nenhum funcionário comissionado ativo encontrado.</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Fechar</Button>
                    <Button variant="accent" onClick={handleConfirmDistribution} disabled={isLoading || individualCommission <= 0}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar e Lançar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    
