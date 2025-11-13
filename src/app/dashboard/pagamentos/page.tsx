
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, doc, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Trash, DollarSign } from 'lucide-react';
import type { Account, Employee, AuthorizedUser } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/page-header';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const paymentSchema = z.object({
  referencia_id: z.string().min(1, 'Funcionário é obrigatório.'),
  valor: z.coerce.number().min(0.01, 'O valor deve ser maior que zero.'),
  vencimento: z.date({ required_error: 'Data de pagamento é obrigatória.' }),
});

export default function PagamentosPage() {
    const [payments, setPayments] = useState<Account[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            vencimento: new Date(),
            valor: 0,
        },
    });

    const selectedEmployeeId = form.watch('referencia_id');

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
                router.push('/');
            }
        });
        return () => unsubscribe();
    }, [router]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [employeesSnapshot, paymentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "funcionarios"), where("tipo_contratacao", "==", "salario_fixo"))),
                getDocs(query(collection(db, "contas_a_pagar"), where("tipo_referencia", "==", "funcionario")))
            ]);

            const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[];
            setEmployees(employeesData);

            const paymentsData = paymentsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, vencimento: doc.data().vencimento.toDate() })) as Account[];
            setPayments(paymentsData);
            
        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados." });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedEmployeeId) {
            const employee = employees.find(e => e.id === selectedEmployeeId);
            if (employee && employee.salario) {
                form.setValue('valor', employee.salario);
            }
        }
    }, [selectedEmployeeId, employees, form]);

    const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.nome || 'Desconhecido';

    const handleSavePayment = async (values: z.infer<typeof paymentSchema>) => {
        setIsSubmitting(true);
        try {
            const paymentData = {
                ...values,
                descricao: `Pagamento de Salário - ${getEmployeeName(values.referencia_id)}`,
                tipo_referencia: 'funcionario' as const,
                status: 'pago' as const,
            };

            await addDoc(collection(db, 'contas_a_pagar'), paymentData);
            toast({ title: "Sucesso!", description: "Pagamento de salário registrado com sucesso." });
            form.reset({
                referencia_id: '',
                valor: 0,
                vencimento: new Date(),
            });
            await fetchData();
        } catch (error) {
            console.error("Erro ao salvar pagamento: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar o pagamento." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePayment = async (paymentId: string) => {
        try {
            await deleteDoc(doc(db, "contas_a_pagar", paymentId));
            toast({
                title: "Sucesso!",
                description: "Lançamento de pagamento excluído.",
            });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir pagamento: ", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao excluir o lançamento.",
            });
        }
    };

    const totalPaid = payments.reduce((sum, item) => sum + item.valor, 0);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Folha de Pagamento"
                description="Gerencie os pagamentos de salários dos funcionários."
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Lançar Pagamento de Salário</CardTitle>
                        <CardDescription>Selecione um funcionário para registrar o pagamento.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSavePayment)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="referencia_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Funcionário</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione um funcionário" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {employees.map(emp => (
                                                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
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
                                            <FormControl>
                                                <Input
                                                    placeholder="Valor do Salário"
                                                    type="number"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Registrar Pagamento
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Histórico de Pagamentos</CardTitle>
                        <CardDescription>Visualize todos os pagamentos de salários registrados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Funcionário</TableHead>
                                        <TableHead>Data do Pagamento</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        {isAdmin && <TableHead className="w-[50px] text-right">Ações</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={isAdmin ? 4 : 3} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : payments.length > 0 ? payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell className="font-medium">{getEmployeeName(payment.referencia_id)}</TableCell>
                                            <TableCell>{format(payment.vencimento, 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-medium text-green-500">
                                                {payment.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <Trash className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir este lançamento?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o registro de pagamento.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeletePayment(payment.id)}>Excluir</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={isAdmin ? 4 : 3} className="h-24 text-center">Nenhum pagamento encontrado.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 3 : 2} className="font-bold">Total Pago</TableCell>
                                        <TableCell className="text-right font-bold text-green-500">
                                            {totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                        {isAdmin && <TableCell></TableCell>}
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
