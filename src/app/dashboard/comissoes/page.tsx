
'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from "@/hooks/use-toast"
import { collection, getDocs, doc, writeBatch, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlusCircle, MoreHorizontal, Loader2, Calendar as CalendarIcon, XCircle, Trash, User, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Commission, Employee, Service, Client, Account } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/page-header';

export default function ComissoesPage() {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isDistributionListOpen, setIsDistributionListOpen] = useState(false);
    const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
    const [distributingService, setDistributingService] = useState<Service | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const { toast } = useToast();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [financials, setFinancials] = useState({
      balance: 0,
      commissionableEmployees: [] as Employee[],
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [commissionsSnapshot, employeesSnapshot, servicesSnapshot, clientsSnapshot, accountsPayableSnap] = await Promise.all([
                getDocs(collection(db, "comissoes")),
                getDocs(collection(db, "funcionarios")),
                getDocs(collection(db, "servicos")),
                getDocs(collection(db, "clientes")),
                getDocs(collection(db, "contas_a_pagar")),
            ]);

            const commissionsData = commissionsSnapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, data: data.data.toDate() } as Commission;
            });
            setCommissions(commissionsData);
            
            const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee);
            setEmployees(employeesData);

            const servicesData = servicesSnapshot.docs.map(doc => {
                const data = doc.data();
                 return {
                  ...data,
                  id: doc.id,
                  data_cadastro: data.data_cadastro instanceof Timestamp ? data.data_cadastro.toDate() : new Date(data.data_cadastro),
                } as Service
            });
            setServices(servicesData);
            
            const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id }) as Client);
            setClients(clientsData);

            // Fetch financials for distribution dialog
            const allServices = servicesData;
            const totalRevenue = allServices
                .reduce((sum, s) => sum + (s.valor_pago || 0), 0);

            const allAccountsPayable = accountsPayableSnap.docs.map(doc => doc.data() as Account);
            const totalExpenses = allAccountsPayable
                .filter(acc => acc.status === 'pago')
                .reduce((sum, currentAccount) => sum + currentAccount.valor, 0);
            
            const totalCommissionsPaid = commissionsData
                .filter(c => c.status === 'pago')
                .reduce((sum, c) => sum + c.valor, 0);
            
            const commissionableEmployees = employeesData.filter(e => e.tipo_contratacao === 'comissao' && e.status === 'ativo');

             setFinancials({
                balance: totalRevenue - totalExpenses - totalCommissionsPaid,
                commissionableEmployees,
            });


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
    const getService = (id: string) => services.find(s => s.id === id);
    const getClient = (id: string) => clients.find(c => c.codigo_cliente === id);
    
    const handleDeleteCommission = async (id: string) => {
        try {
            const commissionDocRef = doc(db, 'comissoes', id);
            await deleteDoc(commissionDocRef);
            toast({ title: "Sucesso!", description: "Comissão excluída com sucesso." });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir comissão: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao excluir a comissão." });
        }
    };

    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        try {
            const querySnapshot = await getDocs(collection(db, "comissoes"));
            if (querySnapshot.empty) {
                toast({ title: 'Aviso', description: 'Não há comissões para excluir.' });
                return;
            }
            const batch = writeBatch(db);
            querySnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            toast({
                title: "Sucesso!",
                description: "Todas as comissões foram excluídas com sucesso.",
            });
            await fetchData();
        } catch (error) {
            console.error("Erro ao excluir todas as comissões: ", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao excluir todas as comissões.",
            });
        } finally {
            setIsDeletingAll(false);
        }
    };

    const handleDistributeClick = (service: Service) => {
        setDistributingService(service);
        setIsDistributionListOpen(false); // Close the list
        setIsDistributionDialogOpen(true); // Open the distribution dialog
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
    
    const commissionBasedEmployees = employees.filter(emp => emp.tipo_contratacao === 'comissao');
    const employeeCommissionTotals = commissionBasedEmployees.map(employee => {
        const total = commissions
            .filter(c => c.funcionario_id === employee.id && c.status === 'pago')
            .reduce((sum, c) => sum + c.valor, 0);
        return { employeeName: employee.nome, total };
    });

    const filteredEmployeeTotals = commissionBasedEmployees.map(employee => {
        const total = filteredCommissions
            .filter(c => c.funcionario_id === employee.id)
            .reduce((sum, c) => sum + c.valor, 0);
        return { employeeName: employee.nome, total };
    });
    
    const servicesWithPendingDistribution = services.filter(s => {
      const isEligible = (s.valor_pago || 0) > 0 && s.status !== 'cancelado' && !s.lucro_distribuido;
      return isEligible;
    });
    
    const getDistributionStatus = (service: Service) => {
        const isDistributable = service.status !== 'cancelado' && (service.valor_pago || 0) > 0;
        
        if (!isDistributable) {
            return <Badge variant="outline">Aguardando</Badge>
        }
        
        if (service.lucro_distribuido) {
            return <Badge variant="secondary">Realizada</Badge>;
        }
        
        return <Badge variant="destructive">Pendente</Badge>;
    }


    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
              title="Comissões"
              description="Gerencie as comissões dos funcionários por serviço."
            />
            
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {employeeCommissionTotals.map(({ employeeName, total }) => (
                    <Card key={employeeName}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{employeeName}</CardTitle>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-500">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            <p className="text-xs text-muted-foreground">
                                Saldo de comissão recebido
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex justify-end gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={commissions.length === 0}>
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir Tudo
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso excluirá permanentemente todas as {commissions.length} comissões.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll}>
                                  {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Sim, excluir tudo
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={() => setIsDistributionListOpen(true)} variant="accent">
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
                            <TableHead>Cliente</TableHead>
                            <TableHead>Serviço Referente / Endereço</TableHead>
                            <TableHead className="text-right">Valor da Comissão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCommissions.length > 0 ? filteredCommissions.map((commission) => {
                            const service = getService(commission.servico_id);
                            const client = service ? getClient(service.cliente_id) : null;
                            const address = client?.endereco_obra;
                            const formattedAddress = address ? `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}` : '';

                            return (
                            <TableRow key={commission.id}>
                                <TableCell className="font-medium">{getEmployeeName(commission.funcionario_id)}</TableCell>
                                <TableCell>{client?.nome_completo || 'Desconhecido'}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{service?.descricao || 'Desconhecido'}</div>
                                    <div className="text-xs text-muted-foreground">{formattedAddress}</div>
                                </TableCell>
                                <TableCell className="text-right text-green-500">R$ {commission.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
                        )}) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma comissão encontrada.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold">Total Geral</TableCell>
                            <TableCell className="text-right font-bold text-green-500">
                               R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                        </TableRow>
                        {filteredEmployeeTotals.map((item, index) => (
                           item.total > 0 && (
                            <TableRow key={index}>
                                <TableCell colSpan={3} className="font-medium text-muted-foreground pl-6">{`Total ${item.employeeName}`}</TableCell>
                                <TableCell className="text-right font-medium text-muted-foreground">
                                    R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                           )
                        ))}
                    </TableFooter>
                </Table>
            </div>

            <Dialog open={isDistributionListOpen} onOpenChange={setIsDistributionListOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Distribuir Lucro de Serviços</DialogTitle>
                        <DialogDescription>
                            Selecione um serviço para calcular e distribuir as comissões. Apenas serviços com pagamentos recebidos e distribuição pendente são listados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-lg mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Descrição / Endereço</TableHead>
                                    <TableHead>Valor do Serviço</TableHead>
                                    <TableHead>Saldo Devedor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Distribuição</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {servicesWithPendingDistribution.length > 0 ? servicesWithPendingDistribution.map(service => {
                                    const client = getClient(service.cliente_id);
                                    const address = client?.endereco_obra;
                                    const formattedAddress = address ? `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}` : 'N/A';
                                    return (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">{client?.nome_completo || 'Desconhecido'}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{service.descricao}</div>
                                                <div className="text-xs text-muted-foreground">{formattedAddress}</div>
                                            </TableCell>
                                            <TableCell>R$ {(service.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-red-500">R$ {(service.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    service.status === 'concluído' ? 'secondary' :
                                                    service.status === 'cancelado' ? 'destructive' :
                                                    'default'
                                                }>
                                                    {service.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{getDistributionStatus(service)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="accent" size="sm" onClick={() => handleDistributeClick(service)}>
                                                    <Users className="mr-2 h-4 w-4" />
                                                    Distribuir
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">Nenhum serviço com distribuição pendente.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
            {distributingService && (
                <ProfitDistributionDialog
                    isOpen={isDistributionDialogOpen}
                    setIsOpen={setIsDistributionDialogOpen}
                    service={distributingService}
                    financials={financials}
                    toast={toast}
                    onDistributionComplete={fetchData}
                />
            )}
        </div>
    );
}


function ProfitDistributionDialog({ isOpen, setIsOpen, service, financials, toast, onDistributionComplete }: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    service: Service;
    financials: { balance: number; commissionableEmployees: Employee[] };
    toast: any;
    onDistributionComplete: () => void;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [serviceCosts, setServiceCosts] = useState(0);
    const [profitMargin, setProfitMargin] = useState(0);

    const amountPaidSoFar = service.valor_pago || 0;

    useEffect(() => {
        const fetchCostsAndCalculateMargin = async () => {
            if (!service || !isOpen) return;
            
            setIsLoading(true);
            try {
                // This is a simplified cost calculation. A real scenario might be more complex.
                const accountsPayableSnap = await getDocs(collection(db, 'contas_a_pagar'));
                const accountsPayable = accountsPayableSnap.docs.map(doc => doc.data() as Account);
                const relatedExpenses = accountsPayable
                    .filter(acc => acc.servico_id === service.id)
                    .reduce((sum, acc) => sum + acc.valor, 0);
                
                const totalCosts = relatedExpenses;
                setServiceCosts(totalCosts);

                if (service.valor_total > 0) {
                    const margin = (service.valor_total - totalCosts) / service.valor_total;
                    setProfitMargin(margin);
                } else {
                    setProfitMargin(0);
                }

            } catch (error) {
                console.error("Erro ao buscar custos do serviço:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível calcular os custos do serviço.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCostsAndCalculateMargin();
    }, [isOpen, service, toast]);

    const profitFromPayment = amountPaidSoFar * profitMargin;
    const cashBalanceBeforeThisPayment = financials.balance - amountPaidSoFar;

    let amountToDistribute = profitFromPayment;
    let deficitCoverage = 0;

    if (cashBalanceBeforeThisPayment < 0) {
        deficitCoverage = Math.min(profitFromPayment, Math.abs(cashBalanceBeforeThisPayment));
        amountToDistribute -= deficitCoverage;
    }
    
    amountToDistribute = Math.max(0, amountToDistribute);

    const handleConfirmDistribution = async () => {
        if (financials.commissionableEmployees.length === 0) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum funcionário comissionado ativo encontrado.' });
            return;
        }
        
        setIsLoading(true);
        try {
            const batch = writeBatch(db);

            financials.commissionableEmployees.forEach(employee => {
                const commissionRate = (employee.taxa_comissao || 0) / 100;
                const individualCommission = amountToDistribute * commissionRate;

                if (individualCommission > 0) {
                    const commissionData = {
                        funcionario_id: employee.id,
                        servico_id: service.id,
                        cliente_id: service.cliente_id,
                        valor: individualCommission,
                        data: Timestamp.now(),
                        status: 'pago', // Assuming direct payment
                    };
                    const commissionDocRef = doc(collection(db, 'comissoes'));
                    batch.set(commissionDocRef, commissionData);
                }
            });
            
            const serviceDocRef = doc(db, 'servicos', service.id);
            batch.update(serviceDocRef, { lucro_distribuido: true });

            await batch.commit();

            toast({ title: 'Sucesso!', description: 'Comissões distribuídas e lançadas com sucesso!' });
            setIsOpen(false);
            onDistributionComplete();
        } catch (error) {
            console.error('Erro ao distribuir lucro:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar as comissões.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Distribuir Lucro do Serviço</DialogTitle>
                    <DialogDescription>
                       Revisão da distribuição do lucro total já pago para "{service.descricao}".
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="p-4 border rounded-lg space-y-2 bg-muted/50">
                        <h4 className="font-semibold text-center mb-2">Resumo da Distribuição</h4>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Valor Total Pago:</span>
                            <span className="font-medium text-green-600">{amountPaidSoFar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Margem de Lucro do Serviço:</span>
                            <span className="font-medium">{profitMargin.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Lucro deste Montante:</span>
                            <span className="font-medium text-green-600">{profitFromPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Saldo de Caixa (antes do valor):</span>
                            <span className={cn("font-medium", cashBalanceBeforeThisPayment < 0 ? 'text-red-600' : 'text-green-600')}>{cashBalanceBeforeThisPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                         {cashBalanceBeforeThisPayment < 0 && (
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Cobertura de Déficit:</span>
                                <span className="font-medium text-orange-500">-{deficitCoverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                         )}
                        <div className="flex justify-between items-center text-lg border-t pt-2 mt-2">
                            <span className="font-bold">Valor Base para Comissões:</span>
                            <span className="font-bold text-primary">{amountToDistribute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                     <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-semibold text-center mb-2">Comissão por Funcionário</h4>
                        {financials.commissionableEmployees.length > 0 ? (
                            financials.commissionableEmployees.map(emp => {
                                const commissionRate = (emp.taxa_comissao || 0) / 100;
                                const individualCommission = amountToDistribute * commissionRate;
                                return (
                                    <div key={emp.id} className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{emp.nome} ({emp.taxa_comissao}%)</span>
                                        <span className="font-medium text-green-600">{individualCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-center text-sm text-red-500">Nenhum funcionário comissionado ativo encontrado.</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Fechar</Button>
                    <Button variant="accent" onClick={handleConfirmDistribution} disabled={isLoading || amountToDistribute <= 0}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar e Lançar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
