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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, arrayUnion, writeBatch, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, Download, XCircle, ArrowDown, CreditCard, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Account, Supplier, Service, CompanyData, AuthorizedUser, Employee, Client } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter, useSearchParams } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { PageHeader } from '@/components/page-header';
import { onAuthStateChanged } from 'firebase/auth';


const accountSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória.'),
  referencia_id: z.string().min(1, 'Fornecedor é obrigatório.'),
  tipo_referencia: z.literal('fornecedor'),
  cliente_id: z.string().optional(),
  servico_id: z.string().optional(),
  valor: z.any().refine(val => {
    const num = parseFloat(String(val).replace(',', '.'));
    return !isNaN(num) && num > 0;
  }, {
    message: 'Valor deve ser maior que zero.',
  }),
  vencimento: z.date({ required_error: 'Data de vencimento é obrigatória.' }),
  status: z.enum(['pendente', 'pago']),
});


const supplierSchema = z.object({
  razao_social: z.string().min(1, { message: 'Razão Social é obrigatória.' }),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  endereco: z.string().optional(),
  produtos_servicos: z.string().optional(),
});


export default function DespesasPage() {
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSupplierLoading, setIsSupplierLoading] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAdmin, setIsAdmin] = useState(false);

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');


    const form = useForm<z.infer<typeof accountSchema>>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            valor: '0,00',
            tipo_referencia: 'fornecedor',
            cliente_id: '',
            servico_id: '',
        }
    });
    
    const supplierForm = useForm<z.infer<typeof supplierSchema>>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            razao_social: '',
            cnpj: '',
            telefone: '',
            email: '',
            endereco: '',
            produtos_servicos: '',
        },
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, "authorized_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data() as AuthorizedUser;
                    setIsAdmin(userData.role === 'admin');
                } else {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchSuppliers = async () => {
      const suppliersSnapshot = await getDocs(collection(db, "fornecedores"));
      const suppliersData = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[];
      setSuppliers(suppliersData);
      return suppliersData;
    };
    
    const fetchEmployees = async () => {
        const employeesSnapshot = await getDocs(collection(db, "funcionarios"));
        const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[];
        setEmployees(employeesData);
    };

    const fetchClients = async () => {
      const clientsSnapshot = await getDocs(collection(db, 'clientes'));
      const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id } as Client));
      setClients(clientsData);
    }

    const fetchServices = async () => {
      const servicesSnapshot = await getDocs(collection(db, 'servicos'));
      const servicesData = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Service));
      setServices(servicesData);
    }
    
    const fetchData = async () => {
        try {
            try {
                const companyDocRef = doc(db, 'empresa', 'dados');
                const companyDocSnap = await getDoc(companyDocRef);
                if (companyDocSnap.exists()) {
                  setCompanyData(companyDocSnap.data() as CompanyData);
                }
            } catch (e) {
                console.warn("Could not fetch company data", e)
            }

            const payableSnapshot = await getDocs(collection(db, "contas_a_pagar"));
            
            await fetchSuppliers();
            await fetchEmployees();
            await fetchClients();
            await fetchServices();
            
            const payableData = payableSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
            });
            setAccountsPayable(payableData);
            
            const editPayableId = searchParams.get('editPayable');
            const addPayable = searchParams.get('add');
            
            if (editPayableId) {
                const accountToEdit = payableData.find(a => a.id === editPayableId);
                if (accountToEdit) {
                    handleEditClick(accountToEdit);
                    router.replace('/dashboard/contas-a-pagar', { scroll: false });
                }
            }

            if (addPayable) {
              handleAddNewClick();
              router.replace('/dashboard/contas-a-pagar', { scroll: false });
            }


        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados financeiros." });
        }
    };

    useEffect(() => {
        fetchData();
    }, [searchParams]);

    const getPayeeName = (account: Account) => {
        if (account.tipo_referencia === 'funcionario') return employees.find(e => e.id === account.referencia_id)?.nome || 'Funcionário não encontrado';
        return suppliers.find(s => s.id === account.referencia_id)?.razao_social || 'Fornecedor não encontrado';
    };


    const handleSaveAccount = async (values: z.infer<typeof accountSchema>) => {
        setIsLoading(true);
        const collectionName = 'contas_a_pagar';
        try {
             const submissionValues = {
                ...values,
                valor: parseFloat(String(values.valor).replace(',', '.')),
                cliente_id: values.cliente_id === 'none' ? '' : (values.cliente_id || ''),
                servico_id: values.servico_id === 'none' ? '' : (values.servico_id || ''),
                tipo_referencia: 'fornecedor',
            };

            if (editingAccount) {
                const docRef = doc(db, collectionName, editingAccount.id);
                await setDoc(docRef, submissionValues);
                toast({ title: "Sucesso!", description: "Conta atualizada com sucesso." });
            } else {
                await addDoc(collection(db, collectionName), submissionValues);
                toast({ title: "Sucesso!", description: "Conta adicionada com sucesso." });
            }
            form.reset();
            setEditingAccount(null);
            setIsDialogOpen(false);
            await fetchData();
        } catch (error) {
            console.error("Erro ao salvar conta: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar a conta." });
        } finally {
            setIsLoading(false);
        }
    };

     const handleSaveSupplier = async (values: z.infer<typeof supplierSchema>) => {
        setIsSupplierLoading(true);
        try {
            const supplierData = {
                ...values,
                produtos_servicos: values.produtos_servicos?.split('\n').filter(p => p.trim() !== '') || [],
            };
            await addDoc(collection(db, 'fornecedores'), supplierData);
            toast({
                title: "Sucesso!",
                description: "Fornecedor adicionado com sucesso.",
            });
            supplierForm.reset();
            setIsSupplierDialogOpen(false);
            await fetchSuppliers();
        } catch (error) {
            console.error("Erro ao salvar fornecedor: ", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao salvar o fornecedor.",
            });
        } finally {
            setIsSupplierLoading(false);
        }
    };
    
    const handleDeleteAccount = async (accountId: string) => {
        try {
            await deleteDoc(doc(db, "contas_a_pagar", accountId));
            toast({ title: "Sucesso!", description: "Conta excluída com sucesso." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir conta: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir a conta." });
        }
    };
    
    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        try {
            const q = query(collection(db, "contas_a_pagar"), where("tipo_referencia", "==", "fornecedor"));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            toast({ title: "Sucesso!", description: "Todas as despesas foram excluídas." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir todas as contas: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro." });
        } finally {
            setIsDeletingAll(false);
        }
    };

    const handleAddNewClick = () => {
        setEditingAccount(null);
        form.reset({
            descricao: '',
            referencia_id: '',
            cliente_id: '',
            servico_id: '',
            valor: '0,00',
            status: 'pendente',
            vencimento: new Date(),
            tipo_referencia: 'fornecedor',
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (account: Account) => {
        setEditingAccount(account);
        form.reset({
            ...account,
            valor: String(account.valor).replace('.',','), 
            vencimento: account.vencimento instanceof Date ? account.vencimento : new Date(account.vencimento),
            tipo_referencia: 'fornecedor',
            cliente_id: account.cliente_id || '',
            servico_id: account.servico_id || '',
        });
        setIsDialogOpen(true);
    };
    
    const filteredPayable = useMemo(() => {
        return accountsPayable
            .filter(acc => typeFilter ? acc.tipo_referencia === typeFilter : true)
            .filter(acc => statusFilter ? acc.status === statusFilter : true)
            .filter(acc => {
                if (!dateRange?.from) return true;
                const fromDate = startOfDay(dateRange.from);
                const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                return acc.vencimento >= fromDate && acc.vencimento <= toDate;
            });
    }, [accountsPayable, typeFilter, statusFilter, dateRange]);

    const totalPayablePending = accountsPayable
      .filter((a) => a.status === 'pendente')
      .reduce((acc, curr) => acc + curr.valor, 0);

    const filteredTotal = filteredPayable.reduce((acc, curr) => acc + curr.valor, 0);
    const filteredPago = useMemo(() => filteredPayable.filter(a => a.status === 'pago').reduce((acc, curr) => acc + curr.valor, 0), [filteredPayable]);
    const filteredPendente = useMemo(() => filteredPayable.filter(a => a.status === 'pendente').reduce((acc, curr) => acc + curr.valor, 0), [filteredPayable]);

    const generatePdf = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Relatório de Despesas - ${companyData?.companyName || 'EngiOffice'}`, 14, 22);
        autoTable(doc, {
          startY: 35,
          head: [['Descrição', 'Fornecedor', 'Vencimento', 'Valor', 'Status']],
          body: filteredPayable.map((acc) => [
            acc.descricao,
            getPayeeName(acc),
            format(acc.vencimento, 'dd/MM/yyyy'),
            `R$ ${acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            acc.status,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [34, 139, 34] },
        });
        doc.save(`relatorio_despesas.pdf`);
    };

    const selectedSupplierId = form.watch('referencia_id');
    
    const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
        setTypeFilter('');
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="Despesas e Fornecedores" description="Gerencie as faturas e despesas com fornecedores." />
            
             <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Despesas a Pagar (Pendente)</CardTitle>
                        <ArrowDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-500">R$ {totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-500">R$ {accountsPayable.reduce((acc, curr) => acc + curr.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardContent>
                </Card>
             </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                        <CardTitle>Lançamentos</CardTitle>
                        <div className="flex gap-2">
                            {isAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" disabled={accountsPayable.length === 0}><Trash className="mr-2 h-4 w-4" />Limpar Fornecedores</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Apenas as contas de fornecedores serão removidas.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll}>{isDeletingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <Button onClick={generatePdf} variant="outline"><Download className="mr-2 h-4 w-4" />PDF</Button>
                            <Button onClick={handleAddNewClick} variant="accent"><PlusCircle className="mr-2 h-4 w-4" />Adicionar Despesa</Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 p-4 mt-4 bg-muted rounded-lg text-sm">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-[250px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? format(dateRange.from, "dd/MM/yy") : "Período"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo de despesa" /></SelectTrigger>
                            <SelectContent><SelectItem value="fornecedor">Fornecedores</SelectItem><SelectItem value="funcionario">Folha Pagto</SelectItem></SelectContent>
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
                                <div className="text-sm font-bold text-green-500">Pago: R$ {filteredPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                <div className="text-sm font-bold text-red-500">Pendente: R$ {filteredPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-blue-400">Total Filtrado: R$</div>
                                <div className="text-lg font-bold text-blue-300">{filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </div>
                    <PayableTableComponent accounts={filteredPayable} getPayeeName={getPayeeName} onEdit={handleEditClick} onDelete={handleDeleteAccount} total={filteredTotal} />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader><DialogTitle>{editingAccount ? 'Editar' : 'Lançar'} Despesa</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveAccount)} className="space-y-6">
                            <PayableFormComponent form={form} suppliers={suppliers} clients={clients} services={services} onAddSupplier={() => setIsSupplierDialogOpen(true)} onAddProduct={() => setIsAddProductDialogOpen(true)} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isLoading} variant="accent">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
                    <Form {...supplierForm}>
                        <form onSubmit={supplierForm.handleSubmit(handleSaveSupplier)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={supplierForm.control} name="razao_social" render={({ field }) => (<FormItem><FormLabel>Razão Social *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={supplierForm.control} name="cnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={supplierForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={supplierForm.control} name="produtos_servicos" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Produtos (um por linha)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsSupplierDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isSupplierLoading} variant="accent">{isSupplierLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

             <AddProductDialog isOpen={isAddProductDialogOpen} setIsOpen={setIsAddProductDialogOpen} supplierId={selectedSupplierId || ''} onProductAdded={fetchSuppliers} toast={toast} />
        </div>
    );
}

function PayableFormComponent({ form, suppliers, clients, services, onAddSupplier, onAddProduct }: { 
    form: any, suppliers: Supplier[], clients: Client[], services: Service[], onAddSupplier: () => void, onAddProduct: () => void
}) {
    const supplierId = useWatch({ control: form.control, name: 'referencia_id' });
    const clientId = useWatch({ control: form.control, name: 'cliente_id' });
    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    
    const uniqueProducts = useMemo(() => {
        if (!selectedSupplier?.produtos_servicos) return [];
        return [...new Set(selectedSupplier.produtos_servicos)];
    }, [selectedSupplier]);

    const filteredServices = useMemo(() => {
        if (!clientId || clientId === 'none') return [];
        return services.filter(s => s.cliente_id === clientId);
    }, [clientId, services]);

    return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="referencia_id" render={({ field }) => (
                <FormItem>
                    <FormLabel>Fornecedor *</FormLabel>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={onAddSupplier}><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="descricao" render={({ field }) => (
                <FormItem>
                    <FormLabel>Produto/Serviço *</FormLabel>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value} disabled={!supplierId}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>{uniqueProducts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={onAddProduct} disabled={!supplierId}><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}/>
             <FormField control={form.control} name="cliente_id" render={({ field }) => (
                <FormItem>
                    <FormLabel>Vincular Cliente (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="none">Nenhum</SelectItem>{clients.map(c => <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>{c.nome_completo}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
            )}/>
            <FormField control={form.control} name="servico_id" render={({ field }) => (
                <FormItem>
                    <FormLabel>Vincular Obra / Projeto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!clientId || clientId === 'none'}>
                        <FormControl><SelectTrigger><SelectValue placeholder={!clientId || clientId === 'none' ? "Selecione um cliente" : "Nenhum"} /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="none">Nenhum</SelectItem>{filteredServices.map(s => <SelectItem key={s.id} value={s.id}>{s.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
            )}/>
            <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="vencimento" render={({ field }) => (
                <FormItem>
                    <FormLabel>Vencimento</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full text-left", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : "Escolha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                    </Popover>
                </FormItem>
            )}/>
            <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
                    </Select>
                </FormItem>
            )}/>
        </div>
    );
}

function AddProductDialog({ isOpen, setIsOpen, supplierId, onProductAdded, toast }: {
    isOpen: boolean, setIsOpen: (v: boolean) => void, supplierId: string, onProductAdded: () => Promise<any>, toast: any
}) {
    const [newProduct, setNewProduct] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const handleAdd = async () => {
        if (!newProduct.trim() || !supplierId) return;
        setIsLoading(true);
        try {
            await updateDoc(doc(db, 'fornecedores', supplierId), { produtos_servicos: arrayUnion(newProduct.trim()) });
            toast({ title: 'Sucesso!' });
            setNewProduct('');
            setIsOpen(false);
            await onProductAdded();
        } catch (e) { console.error(e) } finally { setIsLoading(false); }
    };
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>Novo Produto/Serviço</DialogTitle></DialogHeader>
                <div className="py-4"><Input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="Nome do item" /></div>
                <DialogFooter><Button onClick={handleAdd} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PayableTableComponent({ accounts, getPayeeName, onEdit, onDelete, total }: { 
    accounts: Account[], getPayeeName: (account: Account) => string, onEdit: (account: Account) => void, onDelete: (id: string) => void, total: number
}) {
    return (
        <div className="border border-t-0 rounded-b-lg overflow-hidden">
            <Table>
                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Favorecido</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                    {accounts.length > 0 ? accounts.map((acc) => (
                        <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.descricao}</TableCell>
                            <TableCell>{getPayeeName(acc)}</TableCell>
                            <TableCell>{format(acc.vencimento, 'dd/MM/yy')}</TableCell>
                            <TableCell className="text-right text-red-500">R$ {acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell><Badge variant={acc.status === 'pago' ? 'secondary' : 'destructive'}>{acc.status}</Badge></TableCell>
                            <TableCell>
                                <div className="flex justify-end items-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(acc)}>Editar</DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">Excluir</DropdownMenuItem></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Excluir lançamento?</AlertDialogTitle></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(acc.id)} variant="destructive">Excluir</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="text-center py-4">Vazio</TableCell></TableRow>}
                </TableBody>
            </Table>
        </div>
    );
}
