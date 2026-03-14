
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Service, Client, ServiceType, City, AuthorizedUser, Account } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Calendar as CalendarIcon, Wrench, Link as LinkIcon, ExternalLink, ClipboardCopy, XCircle, FileText, CheckCircle, ArrowUp, TrendingUp, HandCoins, Trash, DollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, Timestamp, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCEP } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader } from '@/components/page-header';
import { useCompanyData } from '../layout';
import { Separator } from '@/components/ui/separator';
import { onAuthStateChanged } from 'firebase/auth';

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional().refine(val => !val || val.length === 9, {
    message: 'CEP deve ter 8 dígitos.',
  }),
});

const serviceSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
  cliente_id: z.string().min(1, { message: 'Selecione um cliente.' }),
  data_cadastro: z.date({
    required_error: "A data de cadastro é obrigatória.",
  }),
  valor_total: z.coerce.number().min(0.01, 'O valor total deve ser maior que zero.'),
  quantidade_m2: z.coerce.number().optional(),
  forma_pagamento: z.enum(['a_vista', 'a_prazo'], { required_error: 'Forma de pagamento é obrigatória.' }),
  status_execucao: z.enum(['não iniciado', 'em andamento', 'paralisado', 'fiscalizado', 'finalizado'], { required_error: 'Status de execução é obrigatório.'}),
  anexos: z.string().optional(),
  endereco_obra: addressSchema.optional(),
  coordenadas: z.object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
  }).optional(),
});

const serviceTypeSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
});

const paymentSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

function AddServiceTypeDialog({ isOpen, setIsOpen, onServiceTypeAdded }: { 
    isOpen: boolean, 
    setIsOpen: (isOpen: boolean) => void, 
    onServiceTypeAdded: () => Promise<void> 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof serviceTypeSchema>>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: { descricao: '' },
  });

  const handleSaveServiceType = async (values: z.infer<typeof serviceTypeSchema>) => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'tipos_servico'), values);
      toast({ title: 'Sucesso!', description: 'Tipo de serviço adicionado com sucesso.' });
      form.reset();
      setIsOpen(false);
      await onServiceTypeAdded();
    } catch (error) {
      console.error("Erro ao salvar tipo de serviço: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar o tipo de serviço.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Novo Tipo de Serviço</DialogTitle>
          <DialogDescription>Preencha a descrição do novo tipo de serviço.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveServiceType)} className="space-y-4">
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [expenses, setExpenses] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isServiceTypeDialogOpen, setIsServiceTypeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const companyData = useCompanyData();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');


  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      descricao: '',
      cliente_id: '',
      valor_total: 0,
      quantidade_m2: 0,
      forma_pagamento: 'a_prazo',
      status_execucao: 'não iniciado',
      anexos: '',
      data_cadastro: new Date(),
      endereco_obra: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
      coordenadas: { lat: 0, lng: 0 },
    },
  });

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

  const fetchServiceTypes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "tipos_servico"));
      const typesData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as ServiceType[];
      typesData.sort((a, b) => a.descricao.localeCompare(b.descricao));
      setServiceTypes(typesData);
    } catch (error) {
      console.error("Erro ao buscar tipos de serviço: ", error);
    }
  };

  const fetchClientsAndCities = async () => {
    try {
        const [clientsSnapshot, citiesSnapshot] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "cidades"))
        ]);
        const clientsData = clientsSnapshot.docs.map(doc => ({
            ...doc.data(),
            codigo_cliente: doc.id,
        })) as Client[];
        setClients(clientsData);

        const citiesData = citiesSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as City[];
        citiesData.sort((a,b) => a.nome_cidade.localeCompare(b.nome_cidade));
        setCities(citiesData);

    } catch (error) {
        console.error("Erro ao buscar clientes ou cidades: ", error);
    }
  }

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [servicesSnapshot, accountsSnapshot] = await Promise.all([
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "contas_a_pagar")),
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
      // Ordenação por data de cadastro decrescente (mais recente primeiro)
      servicesData.sort((a, b) => b.data_cadastro.getTime() - a.data_cadastro.getTime());
      setServices(servicesData);

      const accountsData = accountsSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          vencimento: doc.data().vencimento instanceof Timestamp ? doc.data().vencimento.toDate() : new Date(doc.data().vencimento)
      })) as Account[];
      setExpenses(accountsData);

      await fetchClientsAndCities();
      await fetchServiceTypes();

      const editId = searchParams.get('edit');
      if (editId) {
        const serviceToEdit = servicesData.find(s => s.id === editId);
        if (serviceToEdit) {
            handleEditClick(serviceToEdit);
            router.replace('/dashboard/servicos', { scroll: false });
        }
      }

    } catch (error) {
      console.error("Erro ao buscar dados: ", error);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);
  
  const getClient = (clientId: string) => {
    return clients.find(c => c.codigo_cliente === clientId);
  }

  const handleSaveService = async (values: z.infer<typeof serviceSchema>) => {
    setIsLoading(true);
    try {
      let valorPago = 0;
      if (!editingService) {
        valorPago = values.forma_pagamento === 'a_vista' ? values.valor_total : 0;
      } else {
        valorPago = editingService.valor_pago;
      }

      const saldoDevedor = values.valor_total - valorPago;
      const status_financeiro = saldoDevedor <= 0.01 ? 'pago' : 'pendente';

      const serviceData: Omit<Service, 'id'> = {
        ...values,
        anexos: values.anexos?.split('\n').filter(a => a.trim() !== '') || [],
        valor_pago: valorPago,
        saldo_devedor: Math.max(0, saldoDevedor),
        status_financeiro: status_financeiro,
        endereco_obra: {
            street: values.endereco_obra?.street || '',
            number: values.endereco_obra?.number || '',
            neighborhood: values.endereco_obra?.neighborhood || '',
            city: values.endereco_obra?.city || '',
            state: values.endereco_obra?.state || '',
            zip: values.endereco_obra?.zip || '',
        },
        coordenadas: {
          lat: values.coordenadas?.lat || 0,
          lng: values.coordenadas?.lng || 0,
        },
      };

      if (editingService) {
        const serviceDocRef = doc(db, 'servicos', editingService.id);
        const updatedServiceData = {
          ...serviceData,
          valor_pago: editingService.valor_pago,
          saldo_devedor: Math.max(0, values.valor_total - editingService.valor_pago),
          status_financeiro: (values.valor_total - editingService.valor_pago) <= 0.01 ? 'pago' : 'pendente',
        };
        await setDoc(serviceDocRef, updatedServiceData, { merge: true });
        toast({ title: "Sucesso!", description: "Serviço atualizado com sucesso." });
      } else {
        await addDoc(collection(db, 'servicos'), serviceData);
         toast({ title: "Sucesso!", description: "Serviço adicionado com sucesso." });
      }
      
      form.reset();
      setEditingService(null);
      setIsDialogOpen(false);
      await fetchData();

    } catch (error) {
      console.error("Erro ao salvar serviço: ", error);
       toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar o serviço." });
    } finally {
      setIsLoading(false);
    }
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
        paymentForm.reset();
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, "servicos", serviceId));
      toast({ title: "Sucesso!", description: "Serviço excluído com sucesso." });
      await fetchData();
    } catch (error) {
      console.error("Erro ao excluir serviço: ", error);
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir the serviço." });
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "Sucesso!", description: "Todos os serviços foram excluídos." });
        await fetchData();
    } catch (error) {
        console.error("Erro ao excluir tudo: ", error);
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." });
    } finally {
        setIsDeletingAll(false);
    }
  };

  const handleAddNewClick = () => {
    form.reset({
        descricao: '',
        cliente_id: '',
        valor_total: 0,
        quantidade_m2: 0,
        forma_pagamento: 'a_prazo',
        status_execucao: 'não iniciado',
        anexos: '',
        data_cadastro: new Date(),
        endereco_obra: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
        coordenadas: { lat: 0, lng: 0 },
    });
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (service: Service) => {
    setEditingService(service);
    form.reset({
        ...service,
        quantidade_m2: service.quantidade_m2 || 0,
        data_cadastro: service.data_cadastro instanceof Date ? service.data_cadastro : new Date(service.data_cadastro),
        anexos: service.anexos?.join('\n')
    });
    setIsDialogOpen(true);
  }
  
  const handlePaymentClick = (service: Service) => {
    setEditingService(service);
    paymentForm.reset({ valor_pago: 0 });
    setIsPaymentDialogOpen(true);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSelectedCityFilter('');
    setDateRange(undefined);
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Sucesso!",
      description: "Link copiado para a área de transferência.",
    });
  };

  const generateReceipt = (service: Service, paymentValue?: number) => {
    const client = clients.find(c => c.codigo_cliente === service.cliente_id);
    if (!client) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const isPartialPayment = paymentValue !== undefined && paymentValue < service.valor_total;
    const valueToDisplay = isPartialPayment ? paymentValue : service.valor_pago;
    const title = isPartialPayment ? 'RECIBO DE PAGAMENTO PARCIAL' : 'RECIBO DE PAGAMENTO';

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(companyData?.companyName || 'EngiOffice', 20, 40);
    doc.text(companyData?.address || 'Endereço não informado', 20, 52);

    doc.setLineWidth(0.5);
    doc.line(20, 60, pageWidth - 20, 60);

    doc.setFontSize(14);
    doc.text('Valor Recebido:', 20, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, 70, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setLineWidth(0.2);
    doc.line(20, 75, pageWidth - 20, 75);

    const obraAddress = (service.endereco_obra && service.endereco_obra.street) ? `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}` : 'Endereço da obra não informado';
    const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj || 'Não informado'}, a importância de R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento ${isPartialPayment ? 'parcial' : ''} pelo serviço de "${service.descricao}".\n\nEndereço da Obra: ${obraAddress}`;
    const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
    doc.text(splitText, 20, 90);

    autoTable(doc, {
        startY: 120,
        head: [['Resumo Financeiro do Serviço']],
        body: [
            [`Valor Total: R$ ${service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            [`Saldo Devedor: R$ ${service.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ],
        theme: 'plain',
        headStyles: { fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'right' }
    });

    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, 20, (doc as any).lastAutoTable.finalY + 15);
    
    doc.save(`recibo_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
  };

  const generateProofOfService = (service: Service) => {
    const client = clients.find(c => c.codigo_cliente === service.cliente_id);
    if (!client) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('COMPROVANTE DE PRESTAÇÃO DE SERVIÇO', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    autoTable(doc, {
        startY: currentY,
        body: [
            ['Cliente:', client.nome_completo],
            ['Descrição:', service.descricao],
            ['Valor:', `R$ ${service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ['Data:', format(service.data_cadastro, 'dd/MM/yyyy')],
        ],
        theme: 'striped',
    });

    doc.save(`comprovante_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
  };
  
  const getServiceProfitability = (serviceId: string, serviceTotal: number) => {
      const serviceExpenses = expenses
        .filter(acc => acc.servico_id === serviceId && acc.status === 'pago')
        .reduce((sum, item) => sum + item.valor, 0);
      
      const profit = serviceTotal - serviceExpenses;
      const margin = serviceTotal > 0 ? (profit / serviceTotal) * 100 : 0;

      return {
          expenses: serviceExpenses,
          profit: profit,
          margin: margin
      };
  }

  const filteredServices = useMemo(() => {
    return services
        .filter(service => {
            const searchTermLower = search.toLowerCase();
            const client = getClient(service.cliente_id);
            const clientName = client?.nome_completo.toLowerCase() || '';
            return (
                service.descricao.toLowerCase().includes(searchTermLower) ||
                clientName.includes(searchTermLower)
            );
        })
        .filter(service => {
            return statusFilter ? service.status_execucao === statusFilter : true;
        })
        .filter(service => {
            if (!selectedCityFilter) return true;
            // CORREÇÃO: Utiliza a cidade da obra em vez da residencial do cliente
            return service.endereco_obra?.city === selectedCityFilter;
        })
        .filter(service => {
            if (!dateRange?.from) return true;
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            const serviceDate = service.data_cadastro;
            return serviceDate >= fromDate && serviceDate <= toDate;
        });
  }, [services, search, statusFilter, selectedCityFilter, dateRange, clients]);

  const filteredTotal = filteredServices.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
  const filteredSaldoDevedor = filteredServices.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);
  const filteredLucroTotal = useMemo(() => {
    return filteredServices.reduce((acc, curr) => acc + getServiceProfitability(curr.id, curr.valor_total).profit, 0);
  }, [filteredServices, expenses]);

  const getExecutionStatusBadge = (status: Service['status_execucao']) => {
    switch (status) {
        case 'não iniciado': return 'secondary';
        case 'em andamento': return 'default';
        case 'paralisado': return 'destructive';
        case 'fiscalizado': return 'outline';
        case 'finalizado': return 'accent';
        default: return 'default';
    }
  };
    
  const getFinancialStatus = (service: Service) => {
    if (service.status_financeiro === 'cancelado') return { text: 'Cancelado', variant: 'destructive' as const };
    if (service.saldo_devedor <= 0.01 || service.status_financeiro === 'pago') return { text: 'Pago', variant: 'secondary' as const };
    return { text: 'Pendente', variant: 'destructive' as const };
  }

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Serviços" description="Gerencie os serviços e projetos do seu escritório." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{services.filter(s => s.status_execucao === 'em andamento').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-500">R$ {services.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                  <ArrowUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-green-500">R$ {services.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Investido (Gasto)</CardTitle>
                  <DollarSign className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-red-500">R$ {expenses.filter(e => e.status === 'pago').reduce((acc, curr) => acc + curr.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </CardContent>
          </Card>
      </div>
      
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por descrição ou cliente..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {isAdmin && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" disabled={services.length === 0}><Trash className="mr-2 h-4 w-4" />Limpar Tudo</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Excluir todos os registros?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll}>{isDeletingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <Button onClick={handleAddNewClick} variant="accent"><PlusCircle className="mr-2 h-4 w-4" />Novo Serviço</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 p-4 mt-4 bg-muted rounded-lg text-sm">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[250px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</> : format(dateRange.from, "dd/MM/yy")) : "Filtrar por data"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/></PopoverContent>
                </Popover>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status execução" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="não iniciado">Não Iniciado</SelectItem>
                        <SelectItem value="em andamento">Em Andamento</SelectItem>
                        <SelectItem value="paralisado">Paralisado</SelectItem>
                        <SelectItem value="fiscalizado">Fiscalizado</SelectItem>
                        <SelectItem value="finalizado">Finalizado</SelectItem>
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
                <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground"><XCircle className="mr-2 h-4 w-4"/>Limpar</Button>
            </div>
        </CardHeader>
        <CardContent>
            {/* Barra de Totais Filtrados */}
            <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                <div className="font-bold text-lg pl-2">Totais Filtrados</div>
                <div className="flex flex-row gap-12 pr-4">
                    <div className="text-right">
                        <div className="text-sm font-bold">Contratos: R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className={cn("text-sm font-bold", filteredSaldoDevedor > 0 ? "text-red-500" : "text-muted-foreground")}>Saldo: R$ {filteredSaldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-green-600">Lucro Total: R$</div>
                        <div className="text-lg font-bold text-green-500">{filteredLucroTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead>Cliente / Projeto</TableHead>
                        <TableHead>Localização / Anexos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valores Contrato</TableHead>
                        <TableHead className="text-right">Lucratividade</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredServices.length > 0 ? filteredServices.map((service) => {
                        const client = getClient(service.cliente_id);
                        const obra = service?.endereco_obra;
                        const formattedObra = (obra && obra.street) ? `${obra.street}, ${obra.number} - ${obra.neighborhood}` : 'Endereço não cadastrado';
                        
                        const isFullyPaid = (service.saldo_devedor || 0) <= 0.01;
                        const financial = getFinancialStatus(service);
                        const stats = getServiceProfitability(service.id, service.valor_total);

                        return (
                            <TableRow key={service.id}>
                                <TableCell className="align-top">
                                    <div className="text-sm font-medium">{format(service.data_cadastro, 'dd/MM/yyyy')}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="font-bold">{client?.nome_completo || 'Desconhecido'}</div>
                                    <div className="text-sm text-muted-foreground">{service.descricao}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs font-medium">Obra: {formattedObra}</div>
                                  {(service.coordenadas?.lat && service.coordenadas?.lng) && (
                                    <div className="text-[10px] text-muted-foreground">
                                        Coords: {service.coordenadas.lat}, {service.coordenadas.lng}
                                    </div>
                                  )}
                                  {(service.anexos && service.anexos.length > 0) && (
                                    <div className="text-[10px] text-muted-foreground mt-1 space-y-1">
                                        {service.anexos.map((anexo, index) => {
                                             const isWebUrl = anexo.startsWith('http://') || anexo.startsWith('https://');
                                             return (
                                                <div key={index} className="flex items-center gap-1 group max-w-[250px]">
                                                    <LinkIcon className="h-3 w-3 shrink-0 text-primary" />
                                                    <span className="truncate flex-1" title={anexo}>{anexo}</span>
                                                    <Button variant="ghost" size="icon" className="h-4 w-4 opacity-50 group-hover:opacity-100" onClick={() => handleCopyLink(anexo)}>
                                                        <ClipboardCopy className="h-2 w-2" />
                                                    </Button>
                                                    {isWebUrl && (
                                                    <a href={anexo} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 opacity-50 group-hover:opacity-100">
                                                            <ExternalLink className="h-2 w-2" />
                                                        </Button>
                                                    </a>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top space-y-1">
                                    <Badge variant={getExecutionStatusBadge(service.status_execucao)} className="block w-fit">{service.status_execucao}</Badge>
                                    <Badge variant={financial.variant} className="block w-fit">{financial.text}</Badge>
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="text-xs">Total: <span className="font-bold">R$ {service.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    <div className="text-xs text-green-600">Pago: R$ {service.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className={cn("text-xs font-medium", isFullyPaid ? "text-muted-foreground" : "text-red-500")}>
                                        Saldo: R$ {service.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                </TableCell>
                                <TableCell className="align-top text-right">
                                    <div className="text-xs text-red-500">Gastos: R$ {stats.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className={cn("text-sm font-bold", stats.profit >= 0 ? "text-green-600" : "text-red-600")}>
                                        Lucro: R$ {stats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">Margem: {stats.margin.toFixed(1)}%</div>
                                </TableCell>
                                <TableCell className="align-top">
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Gestão</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleEditClick(service)} disabled={!isAdmin}>Editar Dados</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handlePaymentClick(service)} disabled={isFullyPaid || service.status_financeiro === 'cancelado'}>Lançar Pagamento</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Documentos</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => generateReceipt(service)}>Gerar Recibo</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateProofOfService(service)}>Comprovante Obra</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600" disabled={!isAdmin}>Excluir</DropdownMenuItem></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Excluir serviço?</AlertDialogTitle><AlertDialogDescription>Isso removerá os vínculos financeiros deste projeto.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteService(service.id)} variant="destructive">Confirmar Exclusão</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    }) : <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>}
                </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <AddServiceTypeDialog isOpen={isServiceTypeDialogOpen} setIsOpen={setIsServiceTypeDialogOpen} onServiceTypeAdded={fetchServiceTypes} />
    
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Registrar Recebimento</DialogTitle>
                  <DialogDescription>
                    Serviço: {editingService?.descricao}<br/>
                    Saldo em aberto: <span className="font-bold text-red-500">R$ {(editingService?.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </DialogDescription>
              </DialogHeader>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handleProcessPayment)} className="space-y-4">
                    <FormField control={paymentForm.control} name="valor_pago" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Valor Recebido (R$)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="accent" disabled={isPaymentLoading}>{isPaymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button>
                    </DialogFooter>
                </form>
              </Form>
          </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingService ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveService)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="descricao" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Tipo de Serviço / Descrição *</FormLabel>
                                <div className="flex items-center gap-2">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                        <SelectContent>{serviceTypes.map(type => <SelectItem key={type.id} value={type.descricao}>{type.descricao}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsServiceTypeDialogOpen(true)}><PlusCircle className="h-4 w-4" /></Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="cliente_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cliente *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                                    <SelectContent>{clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="data_cadastro" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data de Início</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="valor_total" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valor do Contrato (R$) *</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="quantidade_m2" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Área Estimada (m²)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value || ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="status_execucao" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status de Obra</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="não iniciado">Não Iniciado</SelectItem>
                                        <SelectItem value="em andamento">Em Andamento</SelectItem>
                                        <SelectItem value="paralisado">Paralisado</SelectItem>
                                        <SelectItem value="fiscalizado">Fiscalizado</SelectItem>
                                        <SelectItem value="finalizado">Finalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="forma_pagamento" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Condição de Pagamento</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!!editingService}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="a_vista">À Vista (Receber Total)</SelectItem><SelectItem value="a_prazo">Parcelado / Pendente</SelectItem></SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="endereco_obra.street" render={({ field }) => (
                            <FormItem><FormLabel>Rua da Obra</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )}/>
                        <FormField control={form.control} name="endereco_obra.number" render={({ field }) => (
                            <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )}/>
                        <FormField control={form.control} name="endereco_obra.city" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cidade</FormLabel>
                                <Select onValueChange={(v) => { field.onChange(v); form.setValue('endereco_obra.state', cities.find(c => c.nome_cidade === v)?.estado || '') }} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                    <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.nome_cidade}>{c.nome_cidade}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="anexos" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Anexos (URLs - uma por linha)</FormLabel>
                                <FormControl><Textarea rows={3} {...field} placeholder="Links para plantas, licenças, etc." /></FormControl>
                            </FormItem>
                        )}/>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading} variant="accent">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
