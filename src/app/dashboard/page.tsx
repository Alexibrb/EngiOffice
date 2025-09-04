

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Service, Account, Client, Commission } from '@/lib/types';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import {
  Activity,
  CircleDollarSign,
  ClipboardList,
  Users,
  Loader2,
  ExternalLink,
  HandCoins,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  CreditCard,
  TrendingUp,
  MoreHorizontal,
  FileText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useCompanyData } from './layout';
import Image from 'next/image';
import { PageHeader } from '@/components/page-header';


const paymentSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

export default function DashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const companyData = useCompanyData();

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { valor_pago: 0 },
  });
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
      try {
        const [servicesSnapshot, payableSnapshot, clientsSnapshot, commissionsSnapshot] = await Promise.all([
          getDocs(collection(db, "servicos")),
          getDocs(collection(db, "contas_a_pagar")),
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "comissoes")),
        ]);

        const servicesData = servicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, data_cadastro: data.data_cadastro.toDate() } as Service;
        });
        setServices(servicesData);

        const payableData = payableSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
        });
        setAccountsPayable(payableData);
        
        const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
        setClients(clientsData);
        
        const commissionsData = commissionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, data: data.data.toDate() } as Commission;
        });
        setCommissions(commissionsData);


      } catch (error) {
        console.error("Erro ao buscar dados do dashboard: ", error);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, []);

  const getClient = (clientId: string) => {
    return clients.find(c => c.codigo_cliente === clientId);
  }

  const ongoingServices = services.filter(
    (s) => s.status === 'em andamento'
  );
  
  const upcomingPayable = accountsPayable
    .filter((a) => a.status === 'pendente')
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());

  const totalReceivablePaid = services.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);
  const totalPayablePaid = accountsPayable.reduce((acc, curr) => curr.status === 'pago' ? acc + curr.valor : acc, 0);
  const totalCommissionsPaid = commissions.reduce((acc, curr) => curr.status === 'pago' ? acc + curr.valor : acc, 0);
  const balance = totalReceivablePaid - totalPayablePaid - totalCommissionsPaid;
  
  const totalServices = services.filter(s => s.status !== 'cancelado').length;
  const completedServices = services.filter(s => s.status === 'concluído').length;
  
  const totalCommissionsPending = commissions
    .filter((c) => c.status === 'pendente')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalReceivablePending = services.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);

  const totalPayablePending = accountsPayable
    .filter((a) => a.status === 'pendente')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalExpenses = accountsPayable.reduce((acc, curr) => acc + curr.valor, 0);

  const handlePayAccount = (accountId: string) => {
    router.push(`/dashboard/contas-a-pagar?editPayable=${accountId}`);
  };

  const handleEditService = (serviceId: string) => {
    router.push(`/dashboard/servicos?edit=${serviceId}`);
  };
  
  const handlePaymentClick = (service: Service) => {
    setEditingService(service);
    paymentForm.reset({ valor_pago: 0 });
    setIsPaymentDialogOpen(true);
  };
  
  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, "servicos", serviceId));
      toast({
        title: "Sucesso!",
        description: "Serviço excluído com sucesso.",
      });
      await fetchData();
    } catch (error) {
      console.error("Erro ao excluir serviço: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao excluir o serviço.",
      });
    }
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
    doc.text(companyData?.companyName || 'EngiOffice', 20, 40);
    const contactInfo = [
        companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : '',
        companyData?.crea ? `CREA: ${companyData.crea}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(contactInfo, 20, 46);
    doc.text(companyData?.address || 'Endereço não informado', 20, 52);


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
    const areaText = service.quantidade_m2 ? ` (Área: ${service.quantidade_m2} m²)` : '';
    const obraAddress = (service.endereco_obra && service.endereco_obra.street) ? `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}` : 'Endereço da obra não informado';
    const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj || 'Não informado'}, a importância de R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento ${isPartialPayment ? 'parcial' : ''} pelo serviço de "${service.descricao}"${areaText}.\n\nEndereço da Obra: ${obraAddress}`;
    const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
    doc.text(splitText, 20, 90);

    // Data e Assinatura
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, 20, 160);
    
    doc.line(pageWidth / 2 - 40, 190, pageWidth / 2 + 40, 190);
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, 195, { align: 'center' });


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

    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companyData?.slogan) {
        doc.text(companyData.slogan, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }
     const contactInfo = [
        companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : '',
        companyData?.crea ? `CREA: ${companyData.crea}` : ''
    ].filter(Boolean).join(' | ');
    if (contactInfo) {
        doc.text(contactInfo, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }
     if (companyData?.address) {
        doc.text(companyData.address, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }


    currentY += 5;
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE DE PRESTAÇÃO DE SERVIÇO', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;


    // Dados do Cliente
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', 14, currentY);
    currentY += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
        startY: currentY,
        body: [
            ['Nome Completo:', client.nome_completo],
            ['CPF/CNPJ:', client.cpf_cnpj || 'N/A'],
            ['RG:', client.rg || 'N/A'],
            ['Telefone:', client.telefone || 'N/A'],
            ['Endereço:', `${client.endereco_residencial.street || ''}, ${client.endereco_residencial.number || ''} - ${client.endereco_residencial.neighborhood || ''}, ${client.endereco_residencial.city || ''} - ${client.endereco_residencial.state || ''}`],
        ],
        theme: 'plain',
        styles: { cellPadding: 1, fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
    
    // Dados do Serviço
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO SERVIÇO', 14, currentY);
    currentY += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let obraAddress = 'N/A';
    if(service.endereco_obra && service.endereco_obra.street) {
        obraAddress = `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}`;
    }
    if (service.coordenadas?.lat && service.coordenadas?.lng) {
        obraAddress += ` (Coords: ${service.coordenadas.lat}, ${service.coordenadas.lng})`
    }
    
    autoTable(doc, {
        startY: currentY,
        body: [
            ['Descrição:', service.descricao],
            ['Endereço da Obra:', obraAddress],
            ['Data de Cadastro:', format(service.data_cadastro, 'dd/MM/yyyy')],
            ['Área (m²):', service.quantidade_m2?.toLocaleString('pt-BR') || 'N/A'],
            ['Valor Total:', `R$ ${service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ['Forma de Pagamento:', service.forma_pagamento === 'a_vista' ? 'À Vista' : 'A Prazo'],
            ['Anexos:', service.anexos && service.anexos.length > 0 ? service.anexos.join('\n') : 'Nenhum'],
        ],
        theme: 'plain',
        styles: { cellPadding: 1, fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Assinatura
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;
    
    doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, currentY + 5, { align: 'center' });

    doc.save(`comprovante_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
  };

  const handleProcessPayment = async (values: z.infer<typeof paymentSchema>) => {
    if (!editingService) return;

    setIsPaymentLoading(true);
    try {
        const valorPagoAtual = editingService.valor_pago || 0;
        const novoValorPago = valorPagoAtual + values.valor_pago;
        const novoSaldoDevedor = editingService.valor_total - novoValorPago;

        if (novoSaldoDevedor < 0) {
            toast({ variant: 'destructive', title: 'Erro', description: 'O valor pago não pode ser maior que o saldo devedor.' });
            setIsPaymentLoading(false);
            return;
        }

        const serviceDocRef = doc(db, 'servicos', editingService.id);
        const newStatus = novoSaldoDevedor === 0 ? 'concluído' : 'em andamento';
        await updateDoc(serviceDocRef, {
            valor_pago: novoValorPago,
            saldo_devedor: novoSaldoDevedor,
            status: newStatus,
            lucro_distribuido: false,
        });

        toast({ title: 'Sucesso!', description: 'Pagamento lançado com sucesso.' });
        
        generateReceipt(editingService, values.valor_pago);

        setIsPaymentDialogOpen(false);
        setEditingService(null);
        paymentForm.reset();
        await fetchData();

    } catch (error) {
         console.error("Erro ao processar pagamento: ", error);
         toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar o pagamento.' });
    } finally {
        setIsPaymentLoading(false);
    }
  };


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
        title={`Olá, ${user?.displayName || 'Usuário'}!`}
        description="Uma visão geral do seu escritório."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo em Caixa
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className={cn("text-2xl font-bold", balance < 0 ? "text-red-500" : "text-green-500")}>R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              Recebidos - Contas Pagas - Comissões Pagas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Recebido
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             <p className="text-xs text-muted-foreground">
                Soma de todos os pagamentos recebidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Serviços em Andamento
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ongoingServices.length}</div>
            <p className="text-xs text-muted-foreground">
              Total de projetos em execução
            </p>
          </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Serviços Concluídos</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{completedServices}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de serviços finalizados
                </p>
            </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Receber (Pendente)</CardTitle>
                  <ArrowUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-green-500">R$ {totalReceivablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground">
                      Soma de todos os saldos devedores
                  </p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Pagar (Pendente)</CardTitle>
                  <ArrowDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">
                      Soma de todas as contas pendentes
                  </p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Comissões Pendentes
                </CardTitle>
                <HandCoins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">R$ {totalCommissionsPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">
                  Total de comissões a pagar
                </p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">
                      Soma de despesas pagas e pendentes
                  </p>
              </CardContent>
          </Card>
       </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Serviços em Andamento</CardTitle>
            <CardDescription>
              Projetos que estão atualmente em execução.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição / Endereço</TableHead>
                  <TableHead>Saldo Devedor</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ongoingServices.length > 0 ? ongoingServices.map((service) => {
                  const client = getClient(service.cliente_id);
                  const address = service?.endereco_obra;
                  const formattedAddress = address ? `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}` : 'N/A';
                  return (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{client?.nome_completo || 'Desconhecido'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{service.descricao}</div>
                        <div className="text-xs text-muted-foreground">{formattedAddress}</div>
                      </TableCell>
                      <TableCell className="text-red-500">R$ {(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
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
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePaymentClick(service)} disabled={service.status !== 'em andamento'}>
                                    <HandCoins className="mr-2 h-4 w-4" />
                                    Lançar Pagamento
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => generateReceipt(service)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Gerar Recibo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => generateProofOfService(service)}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      Gerar Comprovante
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                          Excluir
                                      </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Essa ação não pode ser desfeita. Isso excluirá permanentemente o serviço.
                                      </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteService(service.id)} variant="destructive">
                                          Excluir
                                      </AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                                  </AlertDialog>
                              </DropdownMenuContent>
                              </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                }) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum serviço em andamento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contas a Pagar Próximas</CardTitle>
            <CardDescription>
              Faturas e contas com vencimento próximo.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayable.length > 0 ? upcomingPayable.slice(0, 5).map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.descricao}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{format(account.vencimento, 'dd/MM/yyyy')}</span>
                        {isPast(account.vencimento) && account.status === 'pendente' && (
                          <Badge variant="destructive">Vencida</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-red-500">R$ {account.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePayAccount(account.id)}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhuma conta pendente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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




