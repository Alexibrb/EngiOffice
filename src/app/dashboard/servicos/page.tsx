

'use client';

import { useState, useEffect } from 'react';
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
  TableFooter,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Service, Client, ServiceType, Commission, Account, Employee, CompanyData, City, AuthorizedUser } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Calendar as CalendarIcon, Wrench, Link as LinkIcon, ExternalLink, ClipboardCopy, XCircle, FileText, CheckCircle, ArrowUp, TrendingUp, HandCoins, Users, Trash } from 'lucide-react';
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
import { cn, formatCPF_CNPJ, formatTelefone, formatCEP } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import { Label } from '@/components/ui/label';
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
  status: z.enum(['em andamento', 'concluído', 'cancelado']),
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

const AnexosList = ({ urls, toast }: { urls: string[], toast: any }) => {
  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Sucesso!",
      description: "Link copiado para a área de transferência.",
    });
  };

  if (!urls || urls.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
        Nenhum anexo para este serviço.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {urls.map((url, index) => {
        const isWebUrl = url.startsWith('http://') || url.startsWith('https://');
        return (
            <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
                <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                {isWebUrl ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate hover:underline"
                    >
                      {url}
                    </a>
                ) : (
                    <span className="flex-1 truncate">{url}</span>
                )}
                
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(url)}>
                    <ClipboardCopy className="h-4 w-4" />
                </Button>

                {isWebUrl && (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                )}
            </div>
        )
      })}
    </div>
  );
};


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
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isServiceTypeDialogOpen, setIsServiceTypeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [distributingService, setDistributingService] = useState<Service | null>(null);
  const [lastPaymentValue, setLastPaymentValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [financials, setFinancials] = useState({
      balance: 0,
      commissionableEmployees: [] as Employee[],
  });
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
      forma_pagamento: 'a_vista',
      status: 'em andamento',
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

  const anexosValue = useWatch({ control: form.control, name: 'anexos' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (user.email === 'alexandro.ibrb@gmail.com') {
                setIsAdmin(true);
            } else {
                const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data() as AuthorizedUser;
                    setIsAdmin(userData.role === 'admin');
                } else {
                    setIsAdmin(false);
                }
            }
        } else {
            setIsAdmin(false);
        }
    });
    return () => unsubscribe();
}, []);

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
                .reduce((sum, s) => sum + (s.valor_pago || 0), 0);

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
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de tipos de serviço.",
      });
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

  const fetchServicesAndClients = async () => {
    try {
      const servicesSnapshot = await getDocs(collection(db, "servicos"));
      const servicesData = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
        } as Service
      });
      servicesData.sort((a, b) => a.descricao.localeCompare(b.descricao));
      setServices(servicesData);

      await fetchClientsAndCities();
      await fetchServiceTypes();
      await fetchFinancials();


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
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de serviços ou clientes.",
      });
    }
  };

  useEffect(() => {
    fetchServicesAndClients();
  }, [searchParams]);
  
  const getClient = (clientId: string) => {
    return clients.find(c => c.codigo_cliente === clientId);
  }

  const handleSaveService = async (values: z.infer<typeof serviceSchema>) => {
    setIsLoading(true);
    try {
      const valorPago = values.forma_pagamento === 'a_vista' ? values.valor_total : 0;
      const saldoDevedor = values.valor_total - valorPago;
      const status = saldoDevedor === 0 ? 'concluído' : values.status;

      const serviceData: Omit<Service, 'id'> = {
        ...values,
        anexos: values.anexos?.split('\n').filter(a => a.trim() !== '') || [],
        valor_pago: valorPago,
        saldo_devedor: saldoDevedor,
        lucro_distribuido: false,
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
        const currentService = services.find(s => s.id === editingService.id);
        
        const newServiceData = {
            ...serviceData,
            valor_pago: currentService?.valor_pago || valorPago, // Manter valor pago se já existir
            saldo_devedor: values.valor_total - (currentService?.valor_pago || valorPago),
            lucro_distribuido: currentService?.lucro_distribuido || false,
        };
        await setDoc(serviceDocRef, newServiceData, { merge: true });

        toast({
          title: "Sucesso!",
          description: "Serviço atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, 'servicos'), serviceData);
         toast({
          title: "Sucesso!",
          description: "Serviço adicionado com sucesso.",
        });
      }
      
      form.reset();
      setEditingService(null);
      setIsDialogOpen(false);
      await fetchServicesAndClients();

    } catch (error) {
      console.error("Erro ao salvar serviço: ", error);
       toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o serviço.",
      });
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
            lucro_distribuido: false, // Resetar para permitir nova distribuição
        });

        toast({ title: 'Sucesso!', description: 'Pagamento lançado com sucesso.' });
        
        generateReceipt(editingService, values.valor_pago);
        
        setIsPaymentDialogOpen(false);
        
        await fetchServicesAndClients(); // Refresh data


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
      toast({
        title: "Sucesso!",
        description: "Serviço excluído com sucesso.",
      });
      await fetchServicesAndClients();
    } catch (error) {
      console.error("Erro ao excluir serviço: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao excluir o serviço.",
      });
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        if (querySnapshot.empty) {
            toast({ title: 'Aviso', description: 'Não há serviços para excluir.' });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        toast({
            title: "Sucesso!",
            description: "Todos os serviços foram excluídos com sucesso.",
        });
        await fetchServicesAndClients();
    } catch (error) {
        console.error("Erro ao excluir todos os serviços: ", error);
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Ocorreu um erro ao excluir todos os serviços.",
        });
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
        forma_pagamento: 'a_vista',
        status: 'em andamento',
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

  const handleDistributionClick = (service: Service) => {
    setLastPaymentValue(0); // Reset last payment value for manual trigger
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
    const obraAddress = (service.endereco_obra && service.endereco_obra.street) ? `${service.endereco_obra.street}, ${service.endereco_obra.number} - ${service.endereco_obra.neighborhood}, ${service.endereco_obra.city} - ${service.endereco_obra.state}` : 'Endereço da obra não informado';
    const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj || 'Não informado'}, a importância de R$ ${valueToDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento ${isPartialPayment ? 'parcial' : ''} pelo serviço de "${service.descricao}".\n\nEndereço da Obra: ${obraAddress}`;
    const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
    doc.text(splitText, 20, 90);

    // Data e Assinatura
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`${(client.endereco_residencial && client.endereco_residencial.city) ? client.endereco_residencial.city : 'Localidade não informada'}, ${today}.`, 20, 160);
    
    doc.line(pageWidth / 2 - 40, 190, pageWidth / 2 + 40, 190);
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, 195, { align: 'center' });


    doc.save(`recibo_${client.nome_completo.replace(/\s/g, '_')}_${service.id}.pdf`);
  };
  
  const handleClearFilters = () => {
    setDateRange(undefined);
    setStatusFilter('');
    setSearch('');
  }

  const filteredServices = services
    .filter(service => {
        const searchTermLower = search.toLowerCase();
        const clientName = getClient(service.cliente_id)?.nome_completo.toLowerCase() || '';
        return (
            service.descricao.toLowerCase().includes(searchTermLower) ||
            clientName.includes(searchTermLower)
        );
    })
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

    const filteredTotal = filteredServices.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
    const filteredSaldoDevedor = filteredServices.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);

    const ongoingServicesCount = services.filter((s) => s.status === 'em andamento').length;
    const completedServicesCount = services.filter((s) => s.status === 'concluído').length;
    const totalReceivablePaid = services.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);
    const totalReceivablePending = services.reduce((acc, curr) => acc + (curr.saldo_devedor || 0), 0);
    
    const getDistributionStatus = (service: Service) => {
        const isDistributable = service.status !== 'cancelado' && (service.valor_pago || 0) > 0;
        
        if (!isDistributable) {
            return { text: 'Aguardando', variant: 'outline' as const };
        }
        
        if (service.lucro_distribuido) {
            return { text: 'Realizada', variant: 'secondary' as const };
        }
        
        return { text: 'Pendente', variant: 'destructive' as const };
    }


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Serviços"
        description="Gerencie os serviços e projetos do seu escritório."
      />

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serviços em Andamento</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ongoingServicesCount}</div>
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
                <div className="text-2xl font-bold">{completedServicesCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de serviços finalizados
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
      </div>
      
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por descrição ou nome do cliente..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                 <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={services.length === 0 || !isAdmin}>
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir Tudo
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os {services.length} serviços.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll}>
                                  {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Sim, excluir tudo
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick} variant="accent">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Serviço
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                    <DialogTitle className="font-headline">{editingService ? 'Editar Serviço' : 'Adicionar Novo Serviço'}</DialogTitle>
                    <DialogDescription>
                        Preencha os dados do serviço. Campos marcados com * são obrigatórios.
                    </DialogDescription>
                    </DialogHeader>
                    
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveService)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="descricao"
                                render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Descrição *</FormLabel>
                                     <div className="flex items-center gap-2">
                                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo de serviço" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            {serviceTypes.map(type => (
                                                <SelectItem key={type.id} value={type.descricao}>{type.descricao}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsServiceTypeDialogOpen(true)}><PlusCircle className="h-4 w-4" /></Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                            control={form.control}
                            name="cliente_id"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Cliente *</FormLabel>
                                 <div className="flex items-center gap-2">
                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o cliente" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {clients.map(client => (
                                            <SelectItem key={client.codigo_cliente} value={client.codigo_cliente}>{client.nome_completo}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                     <Button type="button" variant="outline" size="icon" onClick={() => router.push('/dashboard/clientes?add=true')}>
                                        <PlusCircle className="h-4 w-4" />
                                     </Button>
                                </div>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="data_cadastro"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Data de Cadastro</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, "PPP", { locale: ptBR })
                                        ) : (
                                            <span>Escolha uma data</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="valor_total"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Valor Total (R$)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                            control={form.control}
                            name="quantidade_m2"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Quantidade (m²)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                                control={form.control}
                                name="forma_pagamento"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Forma de Pagamento *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="a_vista">À Vista</SelectItem>
                                        <SelectItem value="a_prazo">A Prazo</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="em andamento">Em andamento</SelectItem>
                                    <SelectItem value="concluído">Concluído</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>

                         <Separator />

                            <div>
                                <h3 className="text-lg font-medium mb-4">Endereço da Obra e Coordenadas</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.street"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Rua</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.number"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Número</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.neighborhood"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                        <FormLabel>Bairro</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="endereco_obra.city"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <div className="flex items-center gap-2">
                                            <Select onValueChange={(value) => {
                                                const selectedCity = cities.find(c => c.nome_cidade === value);
                                                field.onChange(value);
                                                form.setValue('endereco_obra.state', selectedCity?.estado || '');
                                            }} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione a Cidade" /></SelectTrigger></FormControl>
                                                <SelectContent><>
                                                {cities.map(city => (<SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>))}
                                                </></SelectContent>
                                            </Select>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.state"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado</FormLabel>
                                        <FormControl>
                                        <Input {...field} disabled />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="endereco_obra.zip"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CEP</FormLabel>
                                        <FormControl>
                                        <Input 
                                            {...field}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                field.onChange(formatCEP(value));
                                            }}
                                        />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                    <FormField
                                    control={form.control}
                                    name="coordenadas.lat"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Latitude</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="coordenadas.lng"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Longitude</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                            </div>
                        
                        <Separator />

                        <div className="space-y-4">
                            {editingService && (
                                <div>
                                    <FormLabel>Anexos Salvos</FormLabel>
                                    <AnexosList urls={anexosValue?.split('\n').filter(Boolean) || []} toast={toast} />
                                </div>
                            )}
                            <FormField
                                control={form.control}
                                name="anexos"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{editingService ? 'Adicionar ou Remover Anexos (URLs, um por linha)' : 'Anexos (URLs, um por linha)'}</FormLabel>
                                        <FormControl>
                                            <Textarea rows={3} {...field} placeholder="https://exemplo.com/documento.pdf\nC:\Projetos\Cliente_Alfa\Planta_Baixa.dwg" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading} variant="accent">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingService ? 'Salvar Alterações' : 'Salvar Serviço'}
                        </Button>
                        </DialogFooter>
                    </form>
                    </Form>
                </DialogContent>
                </Dialog>
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
            <div className="border rounded-lg">
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Detalhes do Serviço</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredServices.length > 0 ? filteredServices.map((service) => {
                        const client = getClient(service.cliente_id);
                        const obra = service?.endereco_obra;
                        const formattedObra = (obra && obra.street) ? `Obra: ${obra.street}, ${obra.number} - ${obra.neighborhood}, ${obra.city}` : '';
                        const distributionStatus = getDistributionStatus(service);
                        const coordenadas = (service?.coordenadas?.lat && service?.coordenadas?.lng) ? `Coords: ${service.coordenadas.lat}, ${service.coordenadas.lng}` : '';

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
                                    <div className="text-sm text-red-500">Saldo: R$ {(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    {service.quantidade_m2 && <div className="text-xs text-muted-foreground">Área: {service.quantidade_m2} m²</div>}
                                </TableCell>
                                 <TableCell className="align-top space-y-1">
                                    <Badge variant={service.status === 'concluído' ? 'secondary' : service.status === 'cancelado' ? 'destructive' : 'default'}>{service.status}</Badge>
                                    <Badge variant={distributionStatus.variant}>{distributionStatus.text}</Badge>
                                </TableCell>
                                <TableCell className="align-top">
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleEditClick(service)} disabled={!isAdmin}>
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handlePaymentClick(service)} disabled={service.status === 'concluído' || service.status === 'cancelado'}>
                                          <HandCoins className="mr-2 h-4 w-4" />
                                          Lançar Pagamento
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            onClick={() => handleDistributionClick(service)} 
                                            disabled={!isAdmin || service.status === 'cancelado' || (service.valor_pago || 0) === 0 || service.lucro_distribuido}
                                        >
                                            <Users className="mr-2 h-4 w-4" />
                                            Distribuir Lucro
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateReceipt(service)}>
                                          <FileText className="mr-2 h-4 w-4" />
                                          Gerar Recibo
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600" disabled={!isAdmin}>
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
                        <TableCell colSpan={5} className="h-24 text-center">
                        Nenhum serviço encontrado.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="font-bold">Total</TableCell>
                        <TableCell className="font-bold">
                           <div>Total: R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                           <div className="text-red-500">Saldo: R$ {filteredSaldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
                </Table>
            </div>
        </CardContent>
      </Card>
      <AddServiceTypeDialog isOpen={isServiceTypeDialogOpen} setIsOpen={setIsServiceTypeDialogOpen} onServiceTypeAdded={fetchServiceTypes} />
    
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
                onDistributionComplete={fetchServicesAndClients}
            />
        )}
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
    const amountPaidSoFar = service.valor_pago || 0;
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
    const cashBalanceBeforeThisPayment = financials.balance - valueForCalculation;

    let amountToDistribute = profitFromPayment;
    let deficitCoverage = 0;

    if (cashBalanceBeforeThisPayment < 0) {
        deficitCoverage = Math.min(profitFromPayment, Math.abs(cashBalanceBeforeThisPayment));
        amountToDistribute -= deficitCoverage;
    }
    
    amountToDistribute = Math.max(0, amountToDistribute);

    const handleConfirmDistribution = async () => {
        if (financials.commissionableEmployees.length === 0) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum funcionário comissionado ativo encontrado.' });
            return;
        }
        
        setIsLoading(true);
        try {
            const batch = writeBatch(db);

            financials.commissionableEmployees.forEach(employee => {
                const commissionRate = (employee.taxa_comissao || 0) / 100;
                const individualCommission = amountToDistribute * commissionRate;

                if (individualCommission > 0) {
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
                }
            });
            
            const serviceDocRef = doc(db, 'servicos', service.id);
            const isFullyPaid = (service.saldo_devedor || 0) <= 0;
            batch.update(serviceDocRef, { lucro_distribuido: isFullyPaid });


            await batch.commit();

            toast({ title: 'Sucesso!', description: 'Comissões distribuídas e lançadas com sucesso!' });
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
                            <span className="font-bold">Valor Base para Comissões:</span>
                            <span className="font-bold text-primary">{amountToDistribute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                     <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-semibold text-center mb-2">Comissão por Funcionário</h4>
                        {financials.commissionableEmployees.length > 0 ? (
                            financials.commissionableEmployees.map(emp => {
                                const commissionRate = (emp.taxa_comissao || 0) / 100;
                                const individualCommission = amountToDistribute * commissionRate;
                                return (
                                    <div key={emp.id} className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{emp.nome} ({emp.taxa_comissao}%)</span>
                                        <span className="font-medium text-green-600">{individualCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-center text-sm text-red-500">Nenhum funcionário comissionado ativo encontrado.</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button variant="accent" onClick={handleConfirmDistribution} disabled={isLoading || amountToDistribute <= 0}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar e Lançar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

