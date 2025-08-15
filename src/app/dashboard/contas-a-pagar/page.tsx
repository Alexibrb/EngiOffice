
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
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, Download, XCircle } from 'lucide-react';
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
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Account, Supplier, Employee, Payee } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter, useSearchParams } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';

const accountSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória.'),
  referencia_id: z.string().min(1, 'Favorecido é obrigatório.'),
  tipo_referencia: z.enum(['fornecedor', 'funcionario']).optional(),
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


export default function ContasAPagarPage() {
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSupplierLoading, setIsSupplierLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');

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
    
    const fetchEmployees = async () => {
        const employeesSnapshot = await getDocs(collection(db, "funcionarios"));
        const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[];
        setEmployees(employeesData);
    }

    const fetchData = async () => {
        try {
            const payableSnapshot = await getDocs(collection(db, "contas_a_pagar"));
            
            await fetchSuppliers();
            await fetchEmployees();

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
        if (account.tipo_referencia === 'funcionario') {
            return employees.find(e => e.id === account.referencia_id)?.nome || 'Funcionário não encontrado';
        }
        return suppliers.find(s => s.id === account.referencia_id)?.razao_social || 'Fornecedor não encontrado';
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

    const generatePdf = () => {
        const doc = new jsPDF();
        const title = 'Relatório de Contas a Pagar';
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${title} - EngiFlow`, 14, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
        autoTable(doc, {
          startY: 35,
          head: [['Descrição', 'Favorecido', 'Vencimento', 'Valor', 'Status']],
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
    
        doc.save(`relatorio_contas_a_pagar.pdf`);
      };

    const selectedSupplierId = form.watch('referencia_id');
    
    const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
    }

    const filteredPayable = accountsPayable
        .filter(acc => {
            return statusFilter ? acc.status === statusFilter : true;
        })
        .filter(acc => {
            if (!dateRange?.from) return true;
            const fromDate = dateRange.from;
            const toDate = dateRange.to ? dateRange.to : fromDate;
            const accDate = acc.vencimento;
            return accDate >= fromDate && accDate <= addDays(toDate, 1);
        });

    const payees: Payee[] = [
        ...suppliers.map(s => ({ id: s.id, nome: s.razao_social, tipo: 'fornecedor' as const, ...s })),
        ...employees.filter(e => e.tipo_contratacao === 'salario_fixo').map(e => ({ id: e.id, nome: e.nome, tipo: 'funcionario' as const, ...e })),
    ];


    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary">Contas a Pagar</h1>
                <p className="text-muted-foreground">
                    Gerencie as faturas, salários e despesas a serem pagas.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Lançamentos</CardTitle>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={generatePdf} variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Exportar PDF
                            </Button>
                            <Button onClick={handleAddNewClick} variant="accent">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Adicionar Conta
                            </Button>
                        </div>
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
                                      <span>Filtrar por vencimento...</span>
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
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
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
                    <PayableTableComponent 
                        accounts={filteredPayable} 
                        getPayeeName={getPayeeName} 
                        onEdit={handleEditClick} 
                        onDelete={handleDeleteAccount} 
                    />
                </CardContent>
            </Card>

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
                                payees={payees} 
                                onAddSupplier={() => setIsSupplierDialogOpen(true)}
                                onAddProduct={() => setIsAddProductDialogOpen(true)}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isLoading} variant="accent">
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

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
                                <Button type="submit" disabled={isSupplierLoading} variant="accent">
                                    {isSupplierLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Fornecedor
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

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

function PayableFormComponent({ form, payees, onAddSupplier, onAddProduct }: { 
    form: any, 
    payees: Payee[], 
    onAddSupplier: () => void,
    onAddProduct: () => void
}) {
    const payeeId = useWatch({ control: form.control, name: 'referencia_id' });
    const selectedPayee = payees.find(p => p.id === payeeId) as (Supplier | Employee | undefined);

    const isSupplier = selectedPayee?.tipo === 'fornecedor';
    
    useEffect(() => {
        if (selectedPayee) {
            form.setValue('tipo_referencia', selectedPayee.tipo);
            if (selectedPayee.tipo === 'funcionario') {
                form.setValue('descricao', 'Pagamento de Salário');
                form.setValue('valor', (selectedPayee as Employee).salario || 0);
            } else {
                 form.setValue('valor', 0);
                 form.setValue('descricao', '');
            }
        }
    }, [selectedPayee, form]);


    return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="referencia_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Favorecido *</FormLabel>
                        <div className="flex items-center gap-2">
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                            }} value={field.value} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o Favorecido" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {payees.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.nome} ({p.tipo === 'funcionario' ? 'Funcionário' : 'Fornecedor'})
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
                        {isSupplier ? (
                             <>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um produto/serviço" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {(selectedPayee as Supplier)?.produtos_servicos?.map((product, index) => (
                                            <SelectItem key={index} value={product}>{product}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="outline" size="icon" onClick={onAddProduct}>
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                             </>
                        ) : (
                            <Input {...field} disabled={!isSupplier} placeholder="Pagamento de Salário"/>
                        )}
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
                        <FormControl><Input type="number" step="0.01" {...field} disabled={!isSupplier} /></FormControl>
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
                    <Button onClick={handleAddProduct} disabled={isLoading} variant="accent">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Produto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function PayableTableComponent({ accounts, getPayeeName, onEdit, onDelete }: { 
    accounts: Account[], 
    getPayeeName: (account: Account) => string, 
    onEdit: (account: Account) => void, 
    onDelete: (id: string) => void 
}) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Favorecido</TableHead>
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
                            <TableCell>{getPayeeName(account)}</TableCell>
                            <TableCell>{format(account.vencimento, 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-red-500">R$ {account.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">Excluir</DropdownMenuItem></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(account.id)} variant="destructive">Excluir</AlertDialogAction>
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

