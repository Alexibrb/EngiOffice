
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, Download, ExternalLink, ArrowDown, ArrowUp, CircleDollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Account, Client, Supplier, Service } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter, useSearchParams } from 'next/navigation';
import { Label } from '@/components/ui/label';


const accountSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória.'),
  referencia_id: z.string().min(1, 'Referência é obrigatória.'),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero.'),
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


export default function FinanceiroPage() {
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSupplierLoading, setIsSupplierLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const form = useForm<z.infer<typeof accountSchema>>({
        resolver: zodResolver(accountSchema),
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

    const fetchSuppliers = async () => {
      const suppliersSnapshot = await getDocs(collection(db, "fornecedores"));
      const suppliersData = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[];
      setSuppliers(suppliersData);
      return suppliersData;
    };

    const fetchData = async () => {
        try {
            const [payableSnapshot, servicesSnapshot, clientsSnapshot] = await Promise.all([
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
            ]);
            
            const suppliersData = await fetchSuppliers();

            const payableData = payableSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
            });
            setAccountsPayable(payableData);
            
            const servicesData = servicesSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, prazo: data.prazo.toDate() } as Service;
            });
            setServices(servicesData);

            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
            setClients(clientsData);

            const editPayableId = searchParams.get('editPayable');
            const addPayable = searchParams.get('add');
            
            if (editPayableId) {
                const accountToEdit = payableData.find(a => a.id === editPayableId);
                if (accountToEdit) {
                    handleEditClick(accountToEdit);
                    router.replace('/dashboard/financeiro', { scroll: false });
                }
            }

            if (addPayable) {
              handleAddNewClick();
              router.replace('/dashboard/financeiro', { scroll: false });
            }


        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados financeiros." });
        }
    };

    useEffect(() => {
        fetchData();
    }, [searchParams]);

    const getClientName = (id: string) => {
        return clients.find(c => c.codigo_cliente === id)?.nome_completo || 'Desconhecido';
    };

    const getSupplierName = (id: string) => {
        return suppliers.find(s => s.id === id)?.razao_social || 'Desconhecido';
    };

    const handleSaveAccount = async (values: z.infer<typeof accountSchema>) => {
        setIsLoading(true);
        const collectionName = 'contas_a_pagar';
        try {
            if (editingAccount) {
                const docRef = doc(db, collectionName, editingAccount.id);
                await setDoc(docRef, values);
                toast({ title: "Sucesso!", description: "Conta atualizada com sucesso." });
            } else {
                await addDoc(collection(db, collectionName), values);
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
        const collectionName = 'contas_a_pagar';
        try {
            await deleteDoc(doc(db, collectionName, accountId));
            toast({ title: "Sucesso!", description: "Conta excluída com sucesso." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir conta: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir a conta." });
        }
    };

    const handleAddNewClick = () => {
        setEditingAccount(null);
        form.reset({
            descricao: '',
            referencia_id: '',
            valor: 0,
            status: 'pendente',
            vencimento: new Date()
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (account: Account) => {
        setEditingAccount(account);
        form.reset({
            ...account,
            vencimento: account.vencimento instanceof Date ? account.vencimento : new Date(account.vencimento),
        });
        setIsDialogOpen(true);
    };

    const generatePdf = (type: 'pagar' | 'receber') => {
        const doc = new jsPDF();
        const title = type === 'pagar' ? 'Relatório de Contas a Pagar' : 'Relatório de Contas a Receber (Serviços)';
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${title} - EngiFlow`, 14, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
        if (type === 'pagar') {
            autoTable(doc, {
              startY: 35,
              head: [['Descrição', 'Referência', 'Vencimento', 'Valor', 'Status']],
              body: accountsPayable.map((acc) => [
                acc.descricao,
                getSupplierName(acc.referencia_id),
                format(acc.vencimento, 'dd/MM/yyyy'),
                `R$ ${acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                acc.status,
              ]),
              theme: 'striped',
              headStyles: { fillColor: [52, 152, 219] },
            });
        } else {
             autoTable(doc, {
              startY: 35,
              head: [['Descrição', 'Cliente', 'Prazo', 'Valor', 'Status']],
              body: services.map((service) => [
                service.descricao,
                getClientName(service.cliente_id),
                format(service.prazo, 'dd/MM/yyyy'),
                `R$ ${service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                service.status,
              ]),
              theme: 'striped',
              headStyles: { fillColor: [52, 152, 219] },
            });
        }
    
        doc.save(`relatorio_financeiro_${type}.pdf`);
      };

    const totalPayablePending = accountsPayable
        .filter((a) => a.status === 'pendente')
        .reduce((acc, curr) => acc + curr.valor, 0);

    const totalPayable = accountsPayable.reduce((acc, curr) => acc + curr.valor, 0);

    const totalReceivablePending = services
        .filter((s) => s.status === 'em andamento')
        .reduce((acc, curr) => acc + curr.valor, 0);
    
    const selectedSupplierId = form.watch('referencia_id');


    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Financeiro</h1>
                <p className="text-muted-foreground">
                    Gerencie as finanças do seu escritório.
                </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Contas a Receber (Pendente)</CardTitle>
                        <ArrowUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {totalReceivablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground">
                            Soma de todos os serviços "em andamento"
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Contas a Pagar (Pendente)</CardTitle>
                        <ArrowDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                         <p className="text-xs text-muted-foreground">
                            Soma de todas as contas pendentes
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Contas a Pagar (Total)</CardTitle>
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                         <p className="text-xs text-muted-foreground">
                            Soma de todas as contas
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="payable">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
                    <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
                </TabsList>

                <TabsContent value="payable">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Contas a Pagar</CardTitle>
                                <CardDescription>Faturas e despesas a serem pagas.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => generatePdf('pagar')} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar PDF
                                </Button>
                                <Button onClick={handleAddNewClick}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adicionar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <PayableTableComponent 
                                accounts={accountsPayable} 
                                getReferenceName={getSupplierName} 
                                onEdit={handleEditClick} 
                                onDelete={handleDeleteAccount} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="receivable">
                    <Card>
                         <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Contas a Receber</CardTitle>
                                <CardDescription>Serviços prestados a serem recebidos dos clientes.</CardDescription>
                            </div>
                             <Button onClick={() => generatePdf('receber')} variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Exportar PDF
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ReceivableTableComponent 
                                services={services} 
                                getClientName={getClientName} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog para Adicionar/Editar Conta a Pagar */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingAccount ? 'Editar' : 'Adicionar'} Conta a Pagar</DialogTitle>
                        <DialogDescription>
                            Preencha os dados da conta.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveAccount)} className="space-y-6">
                            <PayableFormComponent 
                                form={form} 
                                suppliers={suppliers} 
                                onAddSupplier={() => setIsSupplierDialogOpen(true)}
                                onAddProduct={() => setIsAddProductDialogOpen(true)}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Dialog para Adicionar Novo Fornecedor */}
            <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-headline">Adicionar Novo Fornecedor</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do novo fornecedor.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...supplierForm}>
                        <form onSubmit={supplierForm.handleSubmit(handleSaveSupplier)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={supplierForm.control}
                                    name="razao_social"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Razão Social *</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={supplierForm.control}
                                    name="cnpj"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CNPJ</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={supplierForm.control}
                                    name="telefone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Telefone</FormLabel>
                                            <FormControl><Input type="tel" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={supplierForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl><Input type="email" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={supplierForm.control}
                                    name="endereco"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Endereço</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={supplierForm.control}
                                    name="produtos_servicos"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Produtos/Serviços (um por linha)</FormLabel>
                                            <FormControl><Textarea rows={4} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsSupplierDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isSupplierLoading}>
                                    {isSupplierLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Fornecedor
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Dialog para Adicionar Novo Produto ao Fornecedor */}
             <AddProductDialog 
                isOpen={isAddProductDialogOpen}
                setIsOpen={setIsAddProductDialogOpen}
                supplierId={selectedSupplierId}
                onProductAdded={fetchSuppliers} 
                toast={toast}
            />

        </div>
    );
}

function PayableFormComponent({ form, suppliers, onAddSupplier, onAddProduct }: { 
    form: any, 
    suppliers: Supplier[], 
    onAddSupplier: () => void,
    onAddProduct: () => void
}) {
    const supplierId = useWatch({
      control: form.control,
      name: 'referencia_id',
    });

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const productOptions = selectedSupplier?.produtos_servicos || [];

    useEffect(() => {
        // Reset description when supplier changes
        form.setValue('descricao', '');
    }, [supplierId, form]);

    return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="referencia_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fornecedor *</FormLabel>
                        <div className="flex items-center gap-2">
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o Fornecedor" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {suppliers.map(ref => (
                                        <SelectItem key={ref.id} value={ref.id}>
                                            {ref.razao_social}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button type="button" variant="outline" size="icon" onClick={onAddSupplier}>
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Descrição *</FormLabel>
                        <div className="flex items-center gap-2">
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!supplierId}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={supplierId ? "Selecione o produto/serviço" : "Selecione um fornecedor"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {productOptions.map(product => (
                                        <SelectItem key={product} value={product}>
                                            {product}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             <Button type="button" variant="outline" size="icon" onClick={onAddProduct} disabled={!supplierId}>
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </div>
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
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="vencimento"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Vencimento</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                {field.value ? (format(field.value, "PPP", { locale: ptBR })) : (<span>Escolha uma data</span>)}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                        </PopoverContent>
                        </Popover>
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
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="pago">Pago</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function AddProductDialog({ isOpen, setIsOpen, supplierId, onProductAdded, toast }: {
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => void,
    supplierId: string,
    onProductAdded: () => Promise<any>,
    toast: any
}) {
    const [newProduct, setNewProduct] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddProduct = async () => {
        if (!newProduct.trim()) {
            toast({ variant: 'destructive', title: 'Erro', description: 'O nome do produto não pode ser vazio.' });
            return;
        }
        if (!supplierId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum fornecedor selecionado.' });
            return;
        }

        setIsLoading(true);
        try {
            const supplierDocRef = doc(db, 'fornecedores', supplierId);
            await updateDoc(supplierDocRef, {
                produtos_servicos: arrayUnion(newProduct.trim())
            });
            toast({ title: 'Sucesso!', description: 'Produto adicionado com sucesso.' });
            setNewProduct('');
            setIsOpen(false);
            await onProductAdded();
        } catch (error) {
            console.error("Erro ao adicionar produto:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar o produto.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Produto/Serviço</DialogTitle>
                    <DialogDescription>
                        Digite o nome do novo produto ou serviço para o fornecedor selecionado.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product-name" className="text-right">
                            Nome
                        </Label>
                        <Input
                            id="product-name"
                            value={newProduct}
                            onChange={(e) => setNewProduct(e.target.value)}
                            className="col-span-3"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                <DialogFooter>
                     <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAddProduct} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Produto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function PayableTableComponent({ accounts, getReferenceName, onEdit, onDelete }: { 
    accounts: Account[], 
    getReferenceName: (id: string) => string, 
    onEdit: (account: Account) => void, 
    onDelete: (id: string) => void 
}) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accounts.length > 0 ? accounts.map((account) => (
                        <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.descricao}</TableCell>
                            <TableCell>{getReferenceName(account.referencia_id)}</TableCell>
                            <TableCell>{format(account.vencimento, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {account.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                                <Badge variant={account.status === 'pendente' ? 'destructive' : 'secondary'}>
                                    {account.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onEdit(account)}>Editar</DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Excluir</DropdownMenuItem></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(account.id)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">Nenhum lançamento encontrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function ReceivableTableComponent({ services, getClientName }: { 
    services: Service[], 
    getClientName: (id: string) => string
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
                        <TableHead>Prazo Final</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                         <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.length > 0 ? services.map((service) => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.descricao}</TableCell>
                            <TableCell>{getClientName(service.cliente_id)}</TableCell>
                            <TableCell>{format(service.prazo, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditService(service.id)}
                                >
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  Ver/Editar Serviço
                                </Button>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">Nenhum serviço encontrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
