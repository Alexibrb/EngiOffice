
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
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Service, Client } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Calendar as CalendarIcon, Wrench, Link as LinkIcon, ExternalLink, ClipboardCopy, XCircle } from 'lucide-react';
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
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';

const serviceSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
  cliente_id: z.string().min(1, { message: 'Selecione um cliente.' }),
  prazo: z.date({
    required_error: "A data do prazo é obrigatória.",
  }),
  valor: z.coerce.number().optional(),
  status: z.enum(['em andamento', 'concluído', 'cancelado']),
  anexos: z.string().optional(),
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


export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    },
  });

  const anexosValue = useWatch({ control: form.control, name: 'anexos' });

  const fetchServicesAndClients = async () => {
    try {
      const servicesSnapshot = await getDocs(collection(db, "servicos"));
      const servicesData = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          prazo: data.prazo instanceof Timestamp ? data.prazo.toDate() : new Date(data.prazo),
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
        anexos: ''
    });
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (service: Service) => {
    setEditingService(service);
    form.reset({
        ...service,
        prazo: service.prazo instanceof Date ? service.prazo : new Date(service.prazo),
        anexos: service.anexos?.join('\n')
    });
    setIsDialogOpen(true);
  }
  
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
        const fromDate = dateRange.from;
        const toDate = dateRange.to ? dateRange.to : fromDate;
        const serviceDate = service.prazo;
        return serviceDate >= fromDate && serviceDate <= addDays(toDate, 1);
    });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Serviços</h1>
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
      
      <div className="flex flex-col gap-4">
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
                <Button onClick={handleAddNewClick}>
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
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
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
                          name="prazo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prazo</FormLabel>
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
                      <Button type="submit" disabled={isLoading}>
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
                          <span>Filtrar por prazo...</span>
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
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.length > 0 ? filteredServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium">{service.descricao}</TableCell>
                <TableCell>{getClientName(service.cliente_id)}</TableCell>
                <TableCell>{service.prazo ? format(service.prazo, "dd/MM/yyyy") : '-'}</TableCell>
                <TableCell>R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
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
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
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
                              <AlertDialogAction onClick={() => handleDeleteService(service.id)}>
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
        </Table>
      </div>
    </div>
  );
}

    