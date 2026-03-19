'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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
import type { Service, Client, ServiceType, City, AuthorizedUser } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Calendar as CalendarIcon, Wrench, Link as LinkIcon, ExternalLink, ClipboardCopy, XCircle, Trash, TrendingUp, ArrowUp, DollarSign } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const citySchema = z.object({
  nome_cidade: z.string().min(1, { message: 'Nome da cidade é obrigatório.' }),
  estado: z.string().min(2, { message: 'Estado é obrigatório (UF com 2 letras).' }).max(2),
});

const serviceTypeSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
});

function AddCityDialog({ isOpen, setIsOpen, onCityAdded }: {
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void,
  onCityAdded: () => Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof citySchema>>({
    resolver: zodResolver(citySchema),
    defaultValues: { nome_cidade: '', estado: '' },
  });

  const handleSaveCity = async (values: z.infer<typeof citySchema>) => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'cidades'), values);
      toast({ title: 'Sucesso!', description: 'Cidade adicionada.' });
      form.reset();
      setIsOpen(false);
      await onCityAdded();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Cidade</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveCity)} className="space-y-4">
            <FormField control={form.control} name="nome_cidade" render={({ field }) => (
              <FormItem><FormLabel>Nome da Cidade *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="estado" render={({ field }) => (
              <FormItem><FormLabel>Estado (UF) *</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 animate-spin" />}Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddServiceTypeDialog({ isOpen, setIsOpen, onTypeAdded }: {
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void,
  onTypeAdded: () => Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof serviceTypeSchema>>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: { descricao: '' },
  });

  const handleSaveType = async (values: z.infer<typeof serviceTypeSchema>) => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'tipos_servico'), values);
      toast({ title: 'Sucesso!', description: 'Tipo de serviço adicionado.' });
      form.reset();
      setIsOpen(false);
      await onTypeAdded();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Tipo de Serviço</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveType)} className="space-y-4">
            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem><FormLabel>Descrição *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 animate-spin" />}Salvar</Button>
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
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyData = useCompanyData();
  const [isAdmin, setIsAdmin] = useState(false);

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
    setIsLoading(true);
    try {
      const [servicesSnapshot, clientsSnapshot, citiesSnapshot, typesSnapshot] = await Promise.all([
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "cidades")),
        getDocs(collection(db, "tipos_servico")),
      ]);

      const servicesData = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
        } as Service
      });
      setServices(servicesData.sort((a, b) => b.data_cadastro.getTime() - a.data_cadastro.getTime()));
      setClients(clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client)));
      setCities(citiesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as City)).sort((a,b) => a.nome_cidade.localeCompare(b.nome_cidade)));
      setServiceTypes(typesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceType)).sort((a,b) => a.descricao.localeCompare(b.descricao)));

      const editId = searchParams.get('edit');
      if (editId) {
        const s = servicesData.find(x => x.id === editId);
        if (s) handleEditClick(s);
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao buscar dados" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const handleSaveService = async (values: z.infer<typeof serviceSchema>) => {
    setIsLoading(true);
    try {
      const anexosArray = values.anexos ? values.anexos.split('\n').map(a => a.trim()).filter(a => a !== '') : [];
      
      let valorPago = editingService?.valor_pago || 0;
      
      // Lógica de pagamento à vista: Se for novo serviço ou se foi alterado para à vista e ainda não estava pago
      if (values.forma_pagamento === 'a_vista' && (!editingService || editingService.forma_pagamento !== 'a_vista')) {
          valorPago = values.valor_total;
      }

      const saldoDevedor = values.valor_total - valorPago;
      const statusFinanceiro = saldoDevedor <= 0.01 ? 'pago' : 'pendente';

      const serviceData = {
        ...values,
        anexos: anexosArray,
        valor_pago: valorPago,
        saldo_devedor: Math.max(0, saldoDevedor),
        status_financeiro: statusFinanceiro,
      };

      if (editingService) {
        await updateDoc(doc(db, 'servicos', editingService.id), serviceData);
        
        // Se mudou para à vista na edição, lança a diferença como recebimento
        if (values.forma_pagamento === 'a_vista' && editingService.forma_pagamento !== 'a_vista') {
            const diferenca = values.valor_total - editingService.valor_pago;
            if (diferenca > 0) {
                await addDoc(collection(db, 'recebimentos'), {
                    servico_id: editingService.id,
                    cliente_id: values.cliente_id,
                    valor: diferenca,
                    data: Timestamp.now(),
                });
            }
        }
        
        toast({ title: "Sucesso!", description: "Serviço atualizado." });
      } else {
        const docRef = await addDoc(collection(db, 'servicos'), serviceData);
        
        // Se for à vista no cadastro inicial, cria o registro de recebimento automático
        if (values.forma_pagamento === 'a_vista') {
            await addDoc(collection(db, 'recebimentos'), {
                servico_id: docRef.id,
                cliente_id: values.cliente_id,
                valor: values.valor_total,
                data: Timestamp.now(),
            });
        }
        
        toast({ title: "Sucesso!", description: "Serviço adicionado." });
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
        const batch = writeBatch(db);
        
        const collections = ['recebimentos', 'contas_a_pagar', 'comissoes'];
        for (const col of collections) {
            const snap = await getDocs(query(collection(db, col), where("servico_id", "==", serviceId)));
            snap.docs.forEach(d => batch.delete(d.ref));
        }

        batch.delete(doc(db, "servicos", serviceId));
        await batch.commit();
        
        toast({ title: "Sucesso!", description: "Serviço e dados relacionados excluídos." });
        fetchData();
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const handleEditClick = (s: Service) => {
    setEditingService(s);
    form.reset({
      ...s,
      anexos: s.anexos?.join('\n') || '',
      data_cadastro: s.data_cadastro,
    });
    setIsDialogOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingService(null);
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
    setIsDialogOpen(true);
  };

  const filteredServices = services.filter(s => {
    const client = clients.find(c => c.codigo_cliente === s.cliente_id);
    const matchesSearch = s.descricao.toLowerCase().includes(search.toLowerCase()) || (client?.nome_completo.toLowerCase() || '').includes(search.toLowerCase());
    const matchesCity = !selectedCityFilter || selectedCityFilter === 'none' || s.endereco_obra?.city === selectedCityFilter;
    return matchesSearch && matchesCity;
  });

  const getStatusBadge = (status: Service['status_execucao']) => {
    const variants: Record<string, "secondary" | "default" | "destructive" | "outline" | "accent"> = {
      'não iniciado': 'secondary',
      'em andamento': 'default',
      'paralisado': 'destructive',
      'fiscalizado': 'outline',
      'finalizado': 'accent'
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const totals = useMemo(() => {
    return {
        total: filteredServices.reduce((acc, s) => acc + s.valor_total, 0),
        recebido: filteredServices.reduce((acc, s) => acc + (s.valor_pago || 0), 0),
        pendente: filteredServices.reduce((acc, s) => acc + (s.saldo_devedor || 0), 0)
    };
  }, [filteredServices]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Serviços" description="Gestão de projetos e execuções de obras." />
      
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por descrição ou cliente..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                        <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filtrar por cidade" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todas as Cidades</SelectItem>
                            {cities.map(c => <SelectItem key={c.id} value={c.nome_cidade}>{c.nome_cidade}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAddNewClick} variant="accent" className="shrink-0"><PlusCircle className="mr-2 h-4 w-4" />Novo Serviço</Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                <div className="font-bold text-lg pl-2">Totais da Lista</div>
                <div className="flex flex-row gap-8 pr-4">
                    <div className="text-right">
                        <div className="text-xs text-green-400">Recebido:</div>
                        <div className="text-base font-bold">R$ {totals.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-red-400">Pendente:</div>
                        <div className="text-base font-bold">R$ {totals.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-blue-400">Total:</div>
                        <div className="text-base font-bold">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Cliente / Serviço</TableHead>
                            <TableHead>Endereço / Cidade</TableHead>
                            <TableHead>Valores</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredServices.length > 0 ? filteredServices.map(s => {
                            const client = clients.find(c => c.codigo_cliente === s.cliente_id);
                            return (
                                <TableRow key={s.id}>
                                    <TableCell className="text-xs">{format(s.data_cadastro, 'dd/MM/yy')}</TableCell>
                                    <TableCell>
                                        <div className="font-bold">{client?.nome_completo || 'N/A'}</div>
                                        <div className="text-xs text-muted-foreground">{s.descricao}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs">{s.endereco_obra?.street}, {s.endereco_obra?.number}</div>
                                        <div className="text-[10px] text-muted-foreground">{s.endereco_obra?.city} - {s.endereco_obra?.state}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">Total: R$ {s.valor_total.toLocaleString('pt-BR')}</div>
                                        <div className={cn("text-[10px]", s.saldo_devedor > 0.01 ? "text-red-500 font-bold" : "text-green-500")}>Saldo: R$ {s.saldo_devedor.toLocaleString('pt-BR')}</div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(s.status_execucao)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditClick(s)}>Editar</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600" onSelect={e => e.preventDefault()}>Excluir</DropdownMenuItem></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Excluir Serviço?</AlertDialogTitle><AlertDialogDescription>Isso removerá também recebimentos e despesas vinculados.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteService(s.id)} variant="destructive">Excluir</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        }) : (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingService ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
                <DialogDescription>Preencha os dados técnicos e financeiros da obra.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveService)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="cliente_id" render={({field}) => (
                            <FormItem>
                                <FormLabel>Cliente *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                                    <SelectContent>{clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="descricao" render={({field}) => (
                            <FormItem>
                                <FormLabel>Descrição do Serviço / Tipo *</FormLabel>
                                <div className="flex gap-2">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione ou digite..." /></SelectTrigger></FormControl>
                                        <SelectContent>{serviceTypes.map(t => <SelectItem key={t.id} value={t.descricao}>{t.descricao}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsTypeDialogOpen(true)}><PlusCircle className="h-4 w-4"/></Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="data_cadastro" render={({field}) => (
                            <FormItem>
                                <FormLabel>Data de Início/Cadastro *</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full text-left", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : "Escolha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="status_execucao" render={({field}) => (
                            <FormItem>
                                <FormLabel>Status de Execução *</FormLabel>
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
                        )} />
                        <FormField control={form.control} name="valor_total" render={({field}) => (
                            <FormItem><FormLabel>Valor do Contrato (R$) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="quantidade_m2" render={({field}) => (
                            <FormItem><FormLabel>Área Construída (m²)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="forma_pagamento" render={({field}) => (
                            <FormItem>
                                <FormLabel>Forma de Pagamento *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="a_vista">À Vista</SelectItem>
                                        <SelectItem value="a_prazo">A Prazo / Parcelado</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <Separator />
                    <h3 className="font-bold text-lg">Endereço da Obra</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="endereco_obra.street" render={({field}) => (<FormItem><FormLabel>Rua</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="endereco_obra.number" render={({field}) => (<FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="endereco_obra.neighborhood" render={({field}) => (<FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="endereco_obra.city" render={({field}) => (
                            <FormItem>
                                <FormLabel>Cidade</FormLabel>
                                <div className="flex gap-2">
                                    <Select onValueChange={v => { field.onChange(v); const c = cities.find(x => x.nome_cidade === v); if(c) form.setValue('endereco_obra.state', c.estado); }} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                        <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.nome_cidade}>{c.nome_cidade}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsCityDialogOpen(true)}><PlusCircle className="h-4 w-4"/></Button>
                                </div>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="endereco_obra.state" render={({field}) => (<FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input {...field} disabled /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="endereco_obra.zip" render={({field}) => (<FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    </div>

                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="coordenadas.lat" render={({field}) => (<FormItem><FormLabel>Latitude (Opcional)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="coordenadas.lng" render={({field}) => (<FormItem><FormLabel>Longitude (Opcional)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl></FormItem>)} />
                    </div>

                    <FormField control={form.control} name="anexos" render={({field}) => (
                        <FormItem><FormLabel>Links / Anexos (um por linha)</FormLabel><FormControl><Textarea rows={3} placeholder="https://drive.google.com/..." {...field} /></FormControl></FormItem>
                    )} />

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading} variant="accent">{isLoading && <Loader2 className="mr-2 animate-spin" />}Salvar Serviço</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <AddCityDialog isOpen={isCityDialogOpen} setIsOpen={setIsCityDialogOpen} onCityAdded={fetchData} />
      <AddServiceTypeDialog isOpen={isTypeDialogOpen} setIsOpen={setIsTypeDialogOpen} onTypeAdded={fetchData} />
    </div>
  );
}
