
'use client';

import { useState, useEffect } from 'react';
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
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, Download } from 'lucide-react';
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
import type { Account, Client, Supplier } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const accountSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória.'),
  referencia_id: z.string().min(1, 'Referência é obrigatória.'),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero.'),
  vencimento: z.date({ required_error: 'Data de vencimento é obrigatória.' }),
  status: z.enum(['pendente', 'pago', 'recebido']),
});


export default function FinanceiroPage() {
    const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
    const [accountsReceivable, setAccountsReceivable] = useState<Account[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountType, setAccountType] = useState<'pagar' | 'receber'>('pagar');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof accountSchema>>({
        resolver: zodResolver(accountSchema),
    });

    const fetchData = async () => {
        try {
            const [payableSnapshot, receivableSnapshot, clientsSnapshot, suppliersSnapshot] = await Promise.all([
                getDocs(collection(db, "contas_a_pagar")),
                getDocs(collection(db, "contas_a_receber")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "fornecedores")),
            ]);

            const payableData = payableSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
            });
            setAccountsPayable(payableData);

            const receivableData = receivableSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
            });
            setAccountsReceivable(receivableData);

            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
            setClients(clientsData);

            const suppliersData = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[];
            setSuppliers(suppliersData);

        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados financeiros." });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getReferenceName = (id: string) => {
        const client = clients.find(c => c.codigo_cliente === id);
        if (client) return client.nome_completo;
        const supplier = suppliers.find(s => s.id === id);
        if (supplier) return supplier.razao_social;
        return 'Desconhecido';
    };

    const handleSaveAccount = async (values: z.infer<typeof accountSchema>) => {
        setIsLoading(true);
        const collectionName = accountType === 'pagar' ? 'contas_a_pagar' : 'contas_a_receber';
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
    
    const handleDeleteAccount = async (accountId: string, type: 'pagar' | 'receber') => {
        const collectionName = type === 'pagar' ? 'contas_a_pagar' : 'contas_a_receber';
        try {
            await deleteDoc(doc(db, collectionName, accountId));
            toast({ title: "Sucesso!", description: "Conta excluída com sucesso." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir conta: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir a conta." });
        }
    };

    const handleAddNewClick = (type: 'pagar' | 'receber') => {
        setAccountType(type);
        setEditingAccount(null);
        form.reset({
            descricao: '',
            referencia_id: '',
            valor: 0,
            status: type === 'pagar' ? 'pendente' : 'pendente',
            vencimento: new Date()
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (account: Account, type: 'pagar' | 'receber') => {
        setAccountType(type);
        setEditingAccount(account);
        form.reset({
            ...account,
            vencimento: account.vencimento instanceof Date ? account.vencimento : new Date(account.vencimento),
        });
        setIsDialogOpen(true);
    };

    const generateFinancialPdf = (type: 'pagar' | 'receber') => {
        const doc = new jsPDF();
        const title = type === 'pagar' ? 'Relatório de Contas a Pagar' : 'Relatório de Contas a Receber';
        const data = type === 'pagar' ? accountsPayable : accountsReceivable;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${title} - EngiFlow`, 14, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
        autoTable(doc, {
          startY: 35,
          head: [['Descrição', 'Referência', 'Vencimento', 'Valor', 'Status']],
          body: data.map((acc) => [
            acc.descricao,
            getReferenceName(acc.referencia_id),
            format(acc.vencimento, 'dd/MM/yyyy'),
            `R$ ${acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            acc.status,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [52, 152, 219] },
        });
    
        doc.save(`relatorio_financeiro_${type}.pdf`);
      };

    const dialogTitle = `${editingAccount ? 'Editar' : 'Adicionar'} Conta a ${accountType === 'pagar' ? 'Pagar' : 'Receber'}`;
    const referenceList = accountType === 'pagar' ? suppliers : clients;
    const referenceLabel = accountType === 'pagar' ? 'Fornecedor' : 'Cliente';

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Financeiro</h1>
                <p className="text-muted-foreground">
                    Gerencie as finanças do seu escritório.
                </p>
            </div>
            
            <Tabs defaultValue="payable">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
                    <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
                </TabsList>

                {/* Contas a Pagar */}
                <TabsContent value="payable">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Contas a Pagar</CardTitle>
                                <CardDescription>Faturas e despesas a serem pagas.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => generateFinancialPdf('pagar')} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar PDF
                                </Button>
                                <Button onClick={() => handleAddNewClick('pagar')}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adicionar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TableComponent 
                                accounts={accountsPayable} 
                                type="pagar" 
                                getReferenceName={getReferenceName} 
                                onEdit={handleEditClick} 
                                onDelete={handleDeleteAccount} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contas a Receber */}
                <TabsContent value="receivable">
                    <Card>
                         <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Contas a Receber</CardTitle>
                                <CardDescription>Valores a serem recebidos dos clientes.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => generateFinancialPdf('receber')} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar PDF
                                </Button>
                                <Button onClick={() => handleAddNewClick('receber')}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adicionar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TableComponent 
                                accounts={accountsReceivable} 
                                type="receber" 
                                getReferenceName={getReferenceName} 
                                onEdit={handleEditClick} 
                                onDelete={handleDeleteAccount} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog para Adicionar/Editar */}
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
                        <DialogDescription>
                            Preencha os dados da conta.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveAccount)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="descricao"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Descrição *</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="referencia_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{referenceLabel} *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={`Selecione o ${referenceLabel.toLowerCase()}`} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {referenceList.map(ref => (
                                                        <SelectItem key={accountType === 'pagar' ? ref.id : ref.codigo_cliente} value={accountType === 'pagar' ? ref.id : ref.codigo_cliente}>
                                                            {accountType === 'pagar' ? ref.razao_social : ref.nome_completo}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                                                    {accountType === 'pagar' ? (
                                                        <SelectItem value="pago">Pago</SelectItem>
                                                    ) : (
                                                        <SelectItem value="recebido">Recebido</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
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
        </div>
    );
}


function TableComponent({ accounts, type, getReferenceName, onEdit, onDelete }: { 
    accounts: Account[], 
    type: 'pagar' | 'receber', 
    getReferenceName: (id: string) => string, 
    onEdit: (account: Account, type: 'pagar' | 'receber') => void, 
    onDelete: (id: string, type: 'pagar' | 'receber') => void 
}) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Referência</TableHead>
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
                                        <DropdownMenuItem onClick={() => onEdit(account, type)}>Editar</DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Excluir</DropdownMenuItem></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(account.id, type)}>Excluir</AlertDialogAction>
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

    