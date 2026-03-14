
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
import type { Service, Client, ServiceType, City, AuthorizedUser, Account, ServicePayment } from '@/lib/types';
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

const serviceTypeSchema = z.object({
  descricao: z.string().min(1, { message: 'Descrição é obrigatória.' }),
});

const paymentSchema = z.object({
  valor_pago: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
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

    } catch (error) {
      console.error("Erro ao buscar dados: ", error);
      toast({ variant: "destructive", title: "Erro ao buscar dados" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveService = async (values: z.infer<typeof serviceSchema>) => {
    setIsLoading(true);
    try {
      const serviceData = {
        ...values,
        valor_pago: editingService?.valor_pago || 0,
        saldo_devedor: values.valor_total - (editingService?.valor_pago || 0),
        status_financeiro: (values.valor_total - (editingService?.valor_pago || 0)) <= 0.01 ? 'pago' : 'pendente',
      };

      if (editingService) {
        await updateDoc(doc(db, 'servicos', editingService.id), serviceData);
        toast({ title: "Sucesso!", description: "Serviço atualizado." });
      } else {
        await addDoc(collection(db, 'servicos'), serviceData);
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
        
        // 1. Recebimentos
        const rSnap = await getDocs(query(collection(db, "recebimentos"), where("servico_id", "==", serviceId)));
        rSnap.docs.forEach(d => batch.delete(d.ref));
        
        // 2. Contas a Pagar
        const cSnap = await getDocs(query(collection(db, "contas_a_pagar"), where("servico_id", "==", serviceId)));
        cSnap.docs.forEach(d => batch.delete(d.ref));
        
        // 3. Comissões
        const comSnap = await getDocs(query(collection(db, "comissoes"), where("servico_id", "==", serviceId)));
        comSnap.docs.forEach(d => batch.delete(d.ref));

        batch.delete(doc(db, "servicos", serviceId));
        await batch.commit();
        
        toast({ title: "Sucesso!", description: "Serviço e dados relacionados excluídos." });
        fetchData();
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = s.descricao.toLowerCase().includes(search.toLowerCase());
    const matchesCity = !selectedCityFilter || selectedCityFilter === 'none' || s.endereco_obra?.city === selectedCityFilter;
    return matchesSearch && matchesCity;
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Serviços" description="Gerencie seus serviços." />
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex gap-4">
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
                <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Cidade" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Todas as Cidades</SelectItem>
                        {cities.map(c => <SelectItem key={c.id} value={c.nome_cidade}>{c.nome_cidade}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={handleAddNewClick} variant="accent"><PlusCircle className="mr-2 h-4 w-4" />Novo Serviço</Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredServices.map(s => (
                        <TableRow key={s.id}>
                            <TableCell>{format(s.data_cadastro, 'dd/MM/yy')}</TableCell>
                            <TableCell>{s.descricao}</TableCell>
                            <TableCell>R$ {s.valor_total.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className={s.saldo_devedor > 0 ? 'text-red-500' : ''}>R$ {s.saldo_devedor.toLocaleString('pt-BR')}</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleEditClick(s)}>Editar</DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteService(s.id)}>Excluir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveService)} className="space-y-4">
                    <FormField control={form.control} name="descricao" render={({field}) => (
                        <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_id" render={({field}) => (
                        <FormItem><FormLabel>Cliente</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>{clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="valor_total" render={({field}) => (
                        <FormItem><FormLabel>Valor Total</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 animate-spin" />}Salvar</Button>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
  );

  function handleAddNewClick() {
    form.reset();
    setEditingService(null);
    setIsDialogOpen(true);
  }
}
