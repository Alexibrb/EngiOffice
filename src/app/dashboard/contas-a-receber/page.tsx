
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { collection, getDocs, doc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Calendar as CalendarIcon, Download, ExternalLink, XCircle, ArrowUp, TrendingUp, MoreHorizontal, HandCoins, FileText, Loader2, Link as LinkIcon, ClipboardCopy } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import type { Client, Service, AuthorizedUser, City } from '@/lib/types';
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/page-header';
import { useCompanyData } from '../layout';
import { onAuthStateChanged } from 'firebase/auth';

const paymentSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

export default function ContasAReceberPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const { toast } = useToast();
    const [isAdmin, setIsAdmin] = useState(false);
    const companyData = useCompanyData();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedCityFilter, setSelectedCityFilter] = useState<string>('');

    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);

    const paymentForm = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: { valor_pago: 0 },
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data() as AuthorizedUser;
                    setIsAdmin(userData.role === 'admin' || user.email === 'alexandro.ibrb@gmail.com');
                } else {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async () => {
        try {
            const [servicesSnapshot, clientsSnapshot, citiesSnapshot] = await Promise.all([
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "cidades")),
            ]);
            
            const servicesData = servicesSnapshot.docs.map(doc => {
                const data = doc.data();
                 return {
                  ...data,
                  id: doc.id,
                  data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
                  data_ultimo_pagamento: data.data_ultimo_pagamento?.toDate(),
                } as Service
            });
            // Ordenação por data de cadastro decrescente
            servicesData.sort((a, b) => b.data_cadastro.getTime() - a.data_cadastro.getTime());
            setServices(servicesData);

            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client));
            setClients(clientsData.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)));

            const citiesData = citiesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as City));
            setCities(citiesData.sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade)));

        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados." });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getClient = (id: string) => {
        return clients.find(c => c.codigo_cliente === id);
    };

    const handlePaymentClick = (service: Service) => {
        setEditingService(service);
        paymentForm.reset({ valor_pago: 0 });
        setIsPaymentDialogOpen(true);
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
        const valueToDisplay = isPartialPayment ? paymentValue : service.valor_pago;
        const title = isPartialPayment ? 'RECIBO DE PAGAMENTO PARCIAL' : 'RECIBO DE PAGAMENTO';


        // Cabeçalho
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, 20, { align: 'center' });

        // Informações da Empresa
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(companyData?.companyName || 'Empresa/Profissional', 20, 40);
        const contactInfo = [
            companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : '',
            companyData?.crea ? `CREA: ${companyData.crea}` : ''
        ].filter(Boolean).join(' | ');
        doc.text(contactInfo, 20, 46);
        doc.text(companyData?.address || 'Endereço da empresa', 20, 52);


        doc.setLineWidth(0.5);
        doc.line(20, 60, pageWidth - 20, 60);

        // Valor
        doc.setFontSize(14);
        doc.text('Valor Recebido:', 20, 70);
        doc.setFont('helvetica', 'bold');
        doc.text(`R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, 70, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setLineWidth(0.2);
        doc.line(20, 75, pageWidth - 20, 75);

        // Corpo do Recibo
        doc.setFontSize(12);
        const areaText = service.quantidade_m2 ? ` (Área: ${service.quantidade_m2} m²)` : '';
        const obraAddress = (service.endereco_obra && service.endereco_obra.street) ? `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}` : 'Endereço da obra não informado';
        const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj || 'Não informado'}, a importância de R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento ${isPartialPayment ? 'parcial' : ''} pelo serviço de "${service.descricao}"${areaText}.\n\nEndereço da Obra: ${obraAddress}`;
        const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
        doc.text(splitText, 20, 90);

        let currentY = 120;
        
        // Resumo Financeiro
        autoTable(doc, {
            startY: currentY,
            head: [['Resumo Financeiro do Serviço']],
            body: [
                [`Valor Total do Serviço: R$ ${service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                [`Total Pago: R$ ${service.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                [`Saldo Devedor: R$ ${service.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ],
            theme: 'plain',
            headStyles: { fontStyle: 'bold', halign: 'center' },
            bodyStyles: { halign: 'right' }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;


        // Data e Assinatura
        const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
        doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, 20, currentY);
        
        currentY += 20;
        doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
        doc.text(companyData?.companyName || 'Empresa/Profissional', pageWidth / 2, currentY + 5, { align: 'center' });


        doc.save(`recibo_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
    };

    const generateProofOfService = (service: Service) => {
        const client = clients.find(c => c.codigo_cliente === service.cliente_id);
        if (!client) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não encontrado para gerar o comprovante.' });
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let currentY = 15;

        // Cabeçalho da Empresa
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(companyData?.companyName || 'Empresa/Profissional', pageWidth / 2, currentY, { align: 'center' });
        currentY += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyData?.slogan) {
            doc.text(companyData.slogan, pageWidth / 2, currentY, { align: 'center' });
            currentY += 5;
        }
        const creaCnpj = [
            companyData?.crea ? `CREA: ${companyData.crea}` : '',
            companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : ''
        ].filter(Boolean).join(' | ');
        if (creaCnpj) {
            doc.text(creaCnpj, pageWidth / 2, currentY, { align: 'center' });
            currentY += 5;
        }
        doc.setLineWidth(0.3);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 10;
        
        // Título do Documento
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('COMPROVANTE DE PRESTAÇÃO DE SERVIÇO', pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        // Data e Valor
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Data de Cadastro: ${format(service.data_cadastro, 'dd/MM/yyyy')}`, 14, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text('Valor Total:', pageWidth - 60, currentY);
        doc.rect(pageWidth - 40, currentY - 4, 26, 6);
        doc.setFont('helvetica', 'normal');
        doc.text(`R$ ${service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 38, currentY);
        currentY += 8;

        // Seção Cliente
        doc.setFont('helvetica', 'bold');
        autoTable(doc, {
            startY: currentY,
            head: [['DADOS DO CLIENTE']],
            body: [],
            theme: 'plain',
            headStyles: { halign: 'left', fontStyle: 'bold', fillColor: [230, 230, 230] },
        });
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [{ content: 'Nome Completo:', styles: { fontStyle: 'bold', cellWidth: 35 } }, client.nome_completo],
                [{ content: 'CPF/CNPJ:', styles: { fontStyle: 'bold' } }, client.cpf_cnpj || 'N/A'],
                [{ content: 'RG:', styles: { fontStyle: 'bold' } }, client.rg || 'N/A'],
                [{ content: 'Telefone:', styles: { fontStyle: 'bold' } }, client.telefone || 'N/A'],
                [{ content: 'Endereço:', styles: { fontStyle: 'bold' } }, `${client.endereco_residencial.street || ''}, ${client.endereco_residencial.number || ''} - ${client.endereco_residencial.neighborhood || ''}, ${client.endereco_residencial.city || ''} - ${client.endereco_residencial.state || ''}`]
            ],
            theme: 'plain',
            styles: { cellPadding: 1, fontSize: 10 },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
        
        // Seção Serviço
        doc.setFont('helvetica', 'bold');
        autoTable(doc, {
            startY: currentY,
            head: [['DADOS DO SERVIÇO']],
            body: [],
            theme: 'plain',
            headStyles: { halign: 'left', fontStyle: 'bold', fillColor: [230, 230, 230] },
        });
        let obraAddress = 'N/A';
        if(service.endereco_obra && service.endereco_obra.street) {
            obraAddress = `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}`;
        }
        if (service.coordenadas?.lat && service.coordenadas?.lng) {
            obraAddress += ` (Coords: ${service.coordenadas.lat}, ${service.coordenadas.lng})`
        }
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [{ content: 'Descrição:', styles: { fontStyle: 'bold', cellWidth: 35 } }, service.descricao],
                [{ content: 'Endereço da Obra:', styles: { fontStyle: 'bold' } }, obraAddress],
                [{ content: 'Área (m²):', styles: { fontStyle: 'bold' } }, service.quantidade_m2?.toLocaleString('pt-BR') || 'N/A'],
                [{ content: 'Anexos:', styles: { fontStyle: 'bold' } }, service.anexos && service.anexos.length > 0 ? service.anexos.join('\n') : 'Nenhum'],
                [{ content: 'Forma de Pagamento:', styles: { fontStyle: 'bold' } }, service.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo'],
            ],
            theme: 'plain',
            styles: { cellPadding: 1, fontSize: 10 },
        });
        currentY = (doc as any).lastAutoTable.finalY + 25;


        // Assinatura e Data
        const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 20;
        
        doc.setLineWidth(0.3);
        doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
        doc.text(companyData?.companyName || 'Empresa/Profissional', pageWidth / 2, currentY + 5, { align: 'center' });
        
        // Rodapé
        if (companyData?.address && companyData?.phone) {
            const footerText = `${companyData.address} | ${companyData.phone}`;
            doc.setFontSize(8);
            doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        }

        doc.save(`comprovante_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
    };

    const handleProcessPayment = async (values: z.infer<typeof paymentSchema>) => {
        if (!editingService) return;

        setIsPaymentLoading(true);
        try {
            const valorPagoAtual = editingService.valor_pago || 0;
            const novoValorPago = valorPagoAtual + values.valor_pago;
            const novoSaldoDevedor = editingService.valor_total - novoValorPago;

            if (novoSaldoDevedor < -0.01) {
                toast({ variant: 'destructive', title: 'Erro', description: 'O valor pago não pode ser maior que o saldo devedor.' });
                setIsPaymentLoading(false);
                return;
            }

            const serviceDocRef = doc(db, 'servicos', editingService.id);
            const newStatus = novoSaldoDevedor <= 0.01 ? 'pago' : 'pendente';
            
            await updateDoc(serviceDocRef, {
                valor_pago: novoValorPago,
                saldo_devedor: Math.max(0, novoSaldoDevedor),
                status_financeiro: newStatus,
                data_ultimo_pagamento: Timestamp.now(),
            });

            toast({ title: 'Sucesso!', description: 'Pagamento lançado com sucesso.' });
            
            const updatedServiceForReceipt = {
                ...editingService,
                valor_pago: novoValorPago,
                saldo_devedor: Math.max(0, novoSaldoDevedor),
            };
            generateReceipt(updatedServiceForReceipt, values.valor_pago);

            setIsPaymentDialogOpen(false);
            
            await fetchData();


        } catch (error) {
            console.error("Erro ao processar pagamento: ", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar o pagamento.' });
        } finally {
            setIsPaymentLoading(false);
        }
    };
    
    const filteredReceivable = useMemo(() => {
        return services
            .filter(service => {
                return statusFilter ? service.status_financeiro === statusFilter : true;
            })
            .filter(service => {
                return selectedClient ? service.cliente_id === selectedClient : true;
            })
            .filter(service => {
                if (!selectedCityFilter) return true;
                // CORREÇÃO: Utiliza a cidade da obra
                return service.endereco_obra?.city === selectedCityFilter;
            })
            .filter(service => {
                if (!dateRange?.from) return true;
                const fromDate = startOfDay(dateRange.from);
                const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                const serviceDate = service.data_cadastro;
                return serviceDate >= fromDate && serviceDate <= toDate;
            });
    }, [services, statusFilter, selectedClient, selectedCityFilter, dateRange]);

    const totalReceivablePending = services
        .reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);

    const totalReceivablePaid = services.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);

    const filteredTotal = useMemo(() => filteredReceivable.reduce((acc, curr) => acc + curr.valor_total, 0), [filteredReceivable]);
    const filteredSaldoDevedor = useMemo(() => filteredReceivable.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0), [filteredReceivable]);
    const filteredRecebido = useMemo(() => filteredReceivable.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0), [filteredReceivable]);

    const generatePdf = () => {
        const doc = new jsPDF();
        const title = 'Relatório de Contas a Receber (Serviços)';
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${title} - ${companyData?.companyName || 'Empresa/Profissional'}`, 14, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

        // Quadro de Resumo no Topo
        autoTable(doc, {
            startY: 35,
            head: [['Resumo Financeiro do Filtro', '']],
            body: [
                ['Total dos Contratos:', `R$ ${filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Total Recebido:', `R$ ${filteredRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Total Saldo Devedor:', `R$ ${filteredSaldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [34, 139, 34] },
            styles: { fontSize: 9 },
            margin: { left: 14 },
            tableWidth: 100,
        });
    
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Descrição', 'Cliente', 'Data de Cadastro', 'Valor Total', 'Saldo Devedor', 'Status']],
            body: filteredReceivable.map((service) => [
            service.descricao,
            getClient(service.cliente_id)?.nome_completo || 'Desconhecido',
            format(service.data_cadastro, 'dd/MM/yyyy'),
            `R$ ${(service.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            service.status_financeiro,
            ]),
            theme: 'striped',
            headStyles: { fillColor: [34, 139, 34] },
            rowPageBreak: 'avoid',
        });
    
        doc.save(`relatorio_financeiro_receber.pdf`);
      };

    const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
        setSelectedClient('');
        setSelectedCityFilter('');
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
              title="Contas a Receber"
              description="Gerencie os serviços prestados a serem recebidos dos clientes."
            />
            
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
                        <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                         <p className="text-xs text-muted-foreground">
                            Soma de todos os pagamentos recebidos
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
                     <div className="flex flex-wrap items-center gap-4 p-4 mt-4 bg-muted rounded-lg">
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
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="flex items-center gap-2">
                            <Select value={selectedClient} onValueChange={setSelectedClient}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder="Filtrar por cliente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(c => (
                                        <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>
                                            {c.nome_completo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="flex items-center gap-2">
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
                         </div>
                         <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
                            <XCircle className="mr-2 h-4 w-4"/>
                            Limpar Filtros
                         </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Barra de Totais Filtrados */}
                    <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                        <div className="font-bold text-lg pl-2">Totais Filtrados</div>
                        <div className="flex flex-row gap-12 pr-4">
                            <div className="text-right">
                                <div className="text-sm font-bold text-green-500">Recebido: R$ {filteredRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                <div className="text-sm font-bold text-red-500">Saldo: R$ {filteredSaldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-blue-400">Total Contratos: R$</div>
                                <div className="text-lg font-bold text-blue-300">{filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </div>

                    <ReceivableTableComponent 
                        services={filteredReceivable} 
                        getClient={getClient}
                        totalValor={filteredTotal}
                        totalSaldo={filteredSaldoDevedor}
                        onPayment={handlePaymentClick}
                        onReceipt={generateReceipt}
                        onProofOfService={generateProofOfService}
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
        </div>
    );
}


function ReceivableTableComponent({ services, getClient, totalValor, totalSaldo, onPayment, onReceipt, onProofOfService }: { 
    services: Service[], 
    getClient: (id: string) => Client | undefined,
    totalValor: number,
    totalSaldo: number,
    onPayment: (service: Service) => void,
    onReceipt: (service: Service) => void,
    onProofOfService: (service: Service) => void,
}) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data() as AuthorizedUser;
                    setIsAdmin(userData.role === 'admin' || user.email === 'alexandro.ibrb@gmail.com');
                } else {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleEditService = (serviceId: string) => {
        router.push(`/dashboard/servicos?edit=${serviceId}`);
    };
    
    return (
        <div className="border border-t-0 rounded-b-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Detalhes do Serviço</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Status Pagto</TableHead>
                         <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.length > 0 ? services.map((service) => {
                        const client = getClient(service.cliente_id);
                        const obra = service.endereco_obra;
                        const formattedObra = (obra && obra.street) ? `Obra: ${obra.street}, ${obra.number} - ${obra.neighborhood}, ${obra.city}` : '';
                        const coordenadas = (service.coordenadas?.lat && service.coordenadas?.lng) ? `Coords: ${service.coordenadas.lat}, ${service.coordenadas.lng}` : '';

                        // Lógica derivada para garantir que o status exibido corresponda ao saldo real
                        const isFullyPaid = (service.saldo_devedor || 0) <= 0.01;
                        const financialStatus = service.status_financeiro === 'cancelado' 
                            ? { text: 'Cancelado', variant: 'outline' as const }
                            : isFullyPaid 
                                ? { text: 'Pago', variant: 'secondary' as const }
                                : { text: 'Pendente', variant: 'destructive' as const };

                        return (
                            <TableRow key={service.id}>
                                <TableCell className="align-top">
                                    <div className="font-bold">{client?.nome_completo || 'Desconhecido'}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="font-medium">{service.descricao}</div>
                                  <div className="text-xs text-muted-foreground">{formattedObra}</div>
                                  <div className="text-xs text-muted-foreground">{coordenadas}</div>
                                  {(service.anexos && service.anexos.length > 0) && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        {service.anexos.map((anexo, index) => (
                                            <a key={index} href={anexo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline truncate">
                                                <LinkIcon className="h-3 w-3 shrink-0"/>
                                                <span className="truncate">{anexo}</span>
                                            </a>
                                        ))}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="font-medium">Total: R$ {(service.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className={cn("text-sm font-medium", isFullyPaid ? "text-muted-foreground" : "text-red-500")}>
                                        Saldo: R$ {(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    {service.quantidade_m2 ? <div className="text-xs text-muted-foreground">Área: {service.quantidade_m2} m²</div> : null}
                                </TableCell>
                                 <TableCell className="align-top space-y-1">
                                    <Badge 
                                        className="capitalize"
                                        variant={financialStatus.variant}
                                    >
                                        {financialStatus.text}
                                    </Badge>
                                    <div className="text-[10px] text-muted-foreground capitalize">
                                        Execução: {service.status_execucao}
                                    </div>
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
                                            <DropdownMenuItem onClick={() => handleEditService(service.id)} disabled={!isAdmin}>
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Ver/Editar Serviço
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onPayment(service)} disabled={isFullyPaid || service.status_financeiro === 'cancelado'}>
                                                <HandCoins className="mr-2 h-4 w-4" />
                                                Lançar Pagamento
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => onReceipt(service)}>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Gerar Recibo
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onProofOfService(service)}>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Gerar Comprovante
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">Nenhum serviço encontrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
