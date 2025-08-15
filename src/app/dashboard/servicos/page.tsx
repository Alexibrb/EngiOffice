
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
import type { Service, Client, ServiceType } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Calendar as CalendarIcon, Wrench, Link as LinkIcon, ExternalLink, ClipboardCopy, XCircle, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';

const serviceSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
  cliente_id: z.string().min(1, { message: 'Selecione um cliente.' }),
  data_cadastro: z.date({
    required_error: "A data de cadastro é obrigatória.",
  }),
  valor: z.coerce.number().optional(),
  status: z.enum(['em andamento', 'concluído', 'cancelado']),
  anexos: z.string().optional(),
});

const serviceTypeSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
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
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isServiceTypeDialogOpen, setIsServiceTypeDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');


  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      descricao: '',
      cliente_id: '',
      valor: 0,
      status: 'em andamento',
      anexos: '',
      data_cadastro: new Date(),
    },
  });

  const anexosValue = useWatch({ control: form.control, name: 'anexos' });

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

      const clientsSnapshot = await getDocs(collection(db, "clientes"));
      const clientsData = clientsSnapshot.docs.map(doc => ({
        ...doc.data(),
        codigo_cliente: doc.id,
      })) as Client[];
      setClients(clientsData);

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
  
  const getClientName = (clientId: string) => {
    return clients.find(c => c.codigo_cliente === clientId)?.nome_completo || 'Desconhecido';
  }

  const handleSaveService = async (values: z.infer<typeof serviceSchema>) => {
    setIsLoading(true);
    try {
       const serviceData = {
        ...values,
        anexos: values.anexos?.split('\n').filter(a => a.trim() !== '') || [],
      };

      if (editingService) {
        const serviceDocRef = doc(db, 'servicos', editingService.id);
        await setDoc(serviceDocRef, serviceData);
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

  const handleAddNewClick = () => {
    form.reset({
        descricao: '',
        cliente_id: '',
        valor: 0,
        status: 'em andamento',
        anexos: '',
        data_cadastro: new Date()
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

  const generateReceipt = (service: Service) => {
    const client = clients.find(c => c.codigo_cliente === service.cliente_id);
    if (!client) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não encontrado para gerar o recibo.' });
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE PAGAMENTO', pageWidth / 2, 20, { align: 'center' });

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
    doc.text(`R$ ${service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, 70, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setLineWidth(0.2);
    doc.line(20, 75, pageWidth - 20, 75);

    // Corpo do Recibo
    doc.setFontSize(12);
    const obraAddress = client.endereco_obra ? `${client.endereco_obra.street}, ${client.endereco_obra.number} - ${client.endereco_obra.neighborhood}, ${client.endereco_obra.city} - ${client.endereco_obra.state}` : 'Endereço da obra não informado';
    const receiptText = `Recebemos de ${client.nome_completo}, CPF/CNPJ nº ${client.cpf_cnpj}, a importância de R$ ${service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao pagamento pelo serviço de "${service.descricao}".\n\nEndereço da Obra: ${obraAddress}`;
    const splitText = doc.splitTextToSize(receiptText, pageWidth - 40);
    doc.text(splitText, 20, 90);

    // Data e Assinatura
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`${client.endereco_residencial.city}, ${today}.`, 20, 160);
    
    doc.line(pageWidth / 2 - 40, 190, pageWidth / 2 + 40, 190);
    doc.text('EngiFlow', pageWidth / 2, 195, { align: 'center' });


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
        return (
            service.descricao.toLowerCase().includes(searchTermLower) ||
            getClientName(service.cliente_id).toLowerCase().includes(searchTermLower)
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

    const filteredTotal = filteredServices.reduce((acc, curr) => acc + curr.valor, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Serviços</h1>
        <p className="text-muted-foreground">
          Gerencie os serviços e projetos do seu escritório.
        </p>
      </div>

       <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Serviços</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{services.length}</div>
              <p className="text-xs text-muted-foreground">
                Total de serviços cadastrados
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
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick} variant="accent">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Serviço
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            name="valor"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Valor (R$)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
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
                            <div className="md:col-span-2 space-y-4">
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
                                                <Textarea rows={3} {...field} placeholder="https://exemplo.com/documento.pdf&#10;C:\Projetos\Cliente_Alfa\Planta_Baixa.dwg" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
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
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
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
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredServices.length > 0 ? filteredServices.map((service) => (
                    <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.descricao}</TableCell>
                        <TableCell>{getClientName(service.cliente_id)}</TableCell>
                        <TableCell>{service.data_cadastro ? format(service.data_cadastro, "dd/MM/yyyy") : '-'}</TableCell>
                        <TableCell className="text-right text-green-500">R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEditClick(service)}>
                                Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generateReceipt(service)} disabled={service.status !== 'concluído'}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Gerar Recibo
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
                    )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                        Nenhum serviço encontrado.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold text-green-500">
                           R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
                </Table>
            </div>
        </CardContent>
      </Card>
      <AddServiceTypeDialog isOpen={isServiceTypeDialogOpen} setIsOpen={setIsServiceTypeDialogOpen} onServiceTypeAdded={fetchServiceTypes} />
    </div>
  );
}

    

    
