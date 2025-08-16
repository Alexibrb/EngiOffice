
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
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Commission, Employee, Service, Client } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const commissionSchema = z.object({
  funcionario_id: z.string().min(1, 'Funcionário é obrigatório.'),
  cliente_id: z.string().min(1, 'Cliente é obrigatório.'),
  servico_id: z.string().min(1, 'Serviço é obrigatório.'),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero.'),
  data: z.date({ required_error: 'Data é obrigatória.' }),
  status: z.enum(['pendente', 'pago']),
});

const CommissionFormContent = ({ form, employees, clients, services }: { form: any, employees: Employee[], clients: Client[], services: Service[] }) => {
    const selectedClientId = useWatch({
      control: form.control,
      name: 'cliente_id',
    });
    
    const selectedServicoId = useWatch({
        control: form.control,
        name: 'servico_id'
    });

    const filteredServices = services.filter(service => service.cliente_id === selectedClientId);
    
    const commissionBasedEmployees = employees.filter(emp => emp.tipo_contratacao === 'comissao');
    
    const selectedService = services.find(s => s.id === selectedServicoId);
    const selectedClient = clients.find(c => c.codigo_cliente === selectedService?.cliente_id);


    useEffect(() => {
        form.setValue('servico_id', '');
    }, [selectedClientId, form]);

    const workAddress = selectedClient?.endereco_obra;
    const fullAddress = workAddress ? [workAddress.street, workAddress.number, workAddress.neighborhood, workAddress.city, workAddress.state].filter(Boolean).join(', ') : 'Endereço da obra não disponível';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="funcionario_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Funcionário (Comissão) *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione o Funcionário" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {commissionBasedEmployees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}
                            </SelectContent>
                        </Select>
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
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione o Cliente" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {clients.map(cli => (<SelectItem key={cli.codigo_cliente} value={cli.codigo_cliente}>{cli.nome_completo}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="servico_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Serviço Referente *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!selectedClientId}>
                            <FormControl><SelectTrigger><SelectValue placeholder={selectedClientId ? "Selecione o Serviço" : "Selecione um cliente primeiro"} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {filteredServices.map(srv => (<SelectItem key={srv.id} value={srv.id}>{srv.descricao}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
             {selectedClient && (
                <>
                    <div className="md:col-span-2 space-y-2">
                        <Label>Nome do Cliente</Label>
                        <Input value={selectedClient.nome_completo} readOnly disabled />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label>Endereço da Obra</Label>
                        <Textarea value={fullAddress} readOnly disabled rows={2} />
                    </div>
                </>
            )}
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
                name="data"
                render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Pagamento</FormLabel>
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
};


export default function ComissoesPage() {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const form = useForm<z.infer<typeof commissionSchema>>({
        resolver: zodResolver(commissionSchema),
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [commissionsSnapshot, employeesSnapshot, servicesSnapshot, clientsSnapshot] = await Promise.all([
                getDocs(collection(db, "comissoes")),
                getDocs(collection(db, "funcionarios")),
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
            ]);

            const commissionsData = commissionsSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, data: data.data.toDate() } as Commission;
            });
            setCommissions(commissionsData);
            
            const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee);
            setEmployees(employeesData);

            const servicesData = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Service);
            setServices(servicesData);
            
            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id }) as Client);
            setClients(clientsData);


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
    
    const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.nome || 'Desconhecido';
    const getServiceDescription = (id: string) => services.find(s => s.id === id)?.descricao || 'Desconhecido';

    const handleSaveCommission = async (values: z.infer<typeof commissionSchema>) => {
        setIsLoading(true);
        try {
            const commissionData = { ...values };
            if (editingCommission) {
                const docRef = doc(db, 'comissoes', editingCommission.id);
                await setDoc(docRef, commissionData);
                toast({ title: "Sucesso!", description: "Comissão atualizada com sucesso." });
            } else {
                await addDoc(collection(db, 'comissoes'), commissionData);
                toast({ title: "Sucesso!", description: "Comissão adicionada com sucesso." });
            }
            form.reset();
            setEditingCommission(null);
            setIsDialogOpen(false);
            await fetchData();
        } catch (error) {
            console.error("Erro ao salvar comissão: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar a comissão." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteCommission = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'comissoes', id));
            toast({ title: "Sucesso!", description: "Comissão excluída com sucesso." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir comissão: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir a comissão." });
        }
    };

    const handleAddNewClick = () => {
        setEditingCommission(null);
        form.reset({
            funcionario_id: '',
            cliente_id: '',
            servico_id: '',
            valor: 0,
            status: 'pendente',
            data: new Date()
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (commission: Commission) => {
        const service = services.find(s => s.id === commission.servico_id);
        const clientId = service ? service.cliente_id : '';

        setEditingCommission(commission);
        form.reset({
            ...commission,
            cliente_id: clientId,
            data: commission.data instanceof Date ? commission.data : new Date(commission.data),
        });
        setIsDialogOpen(true);
    };
    
     const handleClearFilters = () => {
        setDateRange(undefined);
        setStatusFilter('');
    }

    const filteredCommissions = commissions
        .filter(commission => {
            return statusFilter ? commission.status === statusFilter : true;
        })
        .filter(commission => {
            if (!dateRange?.from) return true;
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            const commissionDate = commission.data;
            return commissionDate >= fromDate && commissionDate <= toDate;
        });
    
    const filteredTotal = filteredCommissions.reduce((acc, curr) => acc + curr.valor, 0);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary">Comissões</h1>
                <p className="text-muted-foreground">
                    Gerencie as comissões dos funcionários por serviço.
                </p>
            </div>
            
            <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                    <Button onClick={handleAddNewClick} variant="accent">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Lançar Comissão
                    </Button>
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
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Serviço Referente</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCommissions.length > 0 ? filteredCommissions.map((commission) => (
                            <TableRow key={commission.id}>
                                <TableCell className="font-medium">{getEmployeeName(commission.funcionario_id)}</TableCell>
                                <TableCell>{getServiceDescription(commission.servico_id)}</TableCell>
                                <TableCell>{format(commission.data, 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="text-right text-red-500">R$ {commission.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell>
                                    <Badge variant={commission.status === 'pendente' ? 'destructive' : 'secondary'}>
                                        {commission.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEditClick(commission)}>Editar</DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">Excluir</DropdownMenuItem></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCommission(commission.id)} variant="destructive">Excluir</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma comissão encontrada.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold">Total</TableCell>
                            <TableCell className="text-right font-bold text-red-500">
                               R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingCommission ? 'Editar' : 'Lançar'} Comissão</DialogTitle>
                        <DialogDescription>
                            Preencha os dados da comissão.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveCommission)} className="space-y-6">
                            <CommissionFormContent
                                form={form}
                                employees={employees}
                                clients={clients}
                                services={services}
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
        </div>
    );
}

    