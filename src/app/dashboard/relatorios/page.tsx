
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import type { Client, Supplier, Service, Account, Employee, Commission } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Search, XCircle, Calendar as CalendarIcon } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type ReportType = 'clients' | 'suppliers' | 'services' | 'accountsPayable' | 'commissions';


export default function RelatoriosPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedReport, setSelectedReport] = useState<ReportType>('clients');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clientsSnapshot, suppliersSnapshot, servicesSnapshot, accountsPayableSnapshot, employeesSnapshot, commissionsSnapshot] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "fornecedores")),
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "contas_a_pagar")),
        getDocs(collection(db, "funcionarios")),
        getDocs(collection(db, "comissoes")),
      ]);

      setClients(clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[]);
      setSuppliers(suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[]);
      setServices(servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, data_cadastro: doc.data().data_cadastro.toDate() })) as Service[]);
      setAccountsPayable(accountsPayableSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, vencimento: doc.data().vencimento.toDate() })) as Account[]);
      setEmployees(employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[]);
      setCommissions(commissionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, data: doc.data().data.toDate() })) as Commission[]);

    } catch (error) {
      console.error("Erro ao buscar dados: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os dados para os relatórios.",
      });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const getClientName = (clientId: string) => clients.find(c => c.codigo_cliente === clientId)?.nome_completo || 'Desconhecido';
  const getEmployeeName = (employeeId: string) => employees.find(e => e.id === employeeId)?.nome || 'Desconhecido';
  const getServiceDescription = (serviceId: string) => services.find(s => s.id === serviceId)?.descricao || 'Desconhecido';
  const getPayeeName = (account: Account) => {
      if (account.tipo_referencia === 'funcionario') return employees.find(e => e.id === account.referencia_id)?.nome || 'Funcionário não encontrado';
      return suppliers.find(s => s.id === account.referencia_id)?.razao_social || 'Fornecedor não encontrado';
  };

  const clearFilters = () => {
      setSearchFilter('');
      setStatusFilter('');
      setDateRange(undefined);
  };

  const filteredData = useMemo(() => {
    let data: any[] = [];
    const searchLower = searchFilter.toLowerCase();
    
    switch (selectedReport) {
        case 'clients':
            data = clients.filter(c => c.nome_completo.toLowerCase().includes(searchLower) || c.cpf_cnpj?.includes(searchFilter));
            break;
        case 'suppliers':
            data = suppliers.filter(s => s.razao_social.toLowerCase().includes(searchLower) || s.cnpj?.includes(searchFilter));
            break;
        case 'services':
            data = services
                .filter(s => statusFilter ? s.status === statusFilter : true)
                .filter(s => s.descricao.toLowerCase().includes(searchLower) || getClientName(s.cliente_id).toLowerCase().includes(searchLower))
                .filter(s => {
                    if (!dateRange?.from) return true;
                    const from = startOfDay(dateRange.from);
                    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                    return s.data_cadastro >= from && s.data_cadastro <= to;
                });
            break;
        case 'accountsPayable':
             data = accountsPayable
                .filter(a => statusFilter ? a.status === statusFilter : true)
                .filter(a => a.descricao.toLowerCase().includes(searchLower) || getPayeeName(a).toLowerCase().includes(searchLower))
                .filter(a => {
                    if (!dateRange?.from) return true;
                    const from = startOfDay(dateRange.from);
                    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                    return a.vencimento >= from && a.vencimento <= to;
                });
            break;
        case 'commissions':
             data = commissions
                .filter(c => statusFilter ? c.status === statusFilter : true)
                .filter(c => getEmployeeName(c.funcionario_id).toLowerCase().includes(searchLower) || getServiceDescription(c.servico_id).toLowerCase().includes(searchLower))
                .filter(c => {
                    if (!dateRange?.from) return true;
                    const from = startOfDay(dateRange.from);
                    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                    return c.data >= from && c.data <= to;
                });
            break;
    }
    return data;
  }, [selectedReport, clients, suppliers, services, accountsPayable, commissions, searchFilter, statusFilter, dateRange, getClientName, getPayeeName, getEmployeeName, getServiceDescription]);

  const generatePdf = () => {
    let data = filteredData;
    let head: string[][];
    let body: any[][];
    let foot: any[][] | undefined = undefined;
    let fileName = '';
    let title = '';

    switch (selectedReport) {
      case 'clients':
        title = 'Relatório de Clientes';
        head = [['Nome', 'CPF/CNPJ', 'Telefone', 'Cidade']];
        body = data.map((item) => [item.nome_completo, item.cpf_cnpj || '-', item.telefone || '-', item.endereco_residencial?.city || '-']);
        fileName = 'relatorio_clientes.pdf';
        break;
      case 'suppliers':
        title = 'Relatório de Fornecedores';
        head = [['Razão Social', 'CNPJ', 'Telefone', 'Email']];
        body = data.map((item) => [item.razao_social, item.cnpj || '-', item.telefone || '-', item.email || '-']);
        fileName = 'relatorio_fornecedores.pdf';
        break;
      case 'services':
        title = 'Relatório de Serviços';
        head = [['Descrição', 'Cliente', 'Data', 'Valor Total', 'Saldo Devedor', 'Status']];
        body = data.map((item: Service) => [item.descricao, getClientName(item.cliente_id), item.data_cadastro ? format(item.data_cadastro, "dd/MM/yyyy") : '-', `R$ ${item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${item.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, item.status]);
        const totalValorServicos = data.reduce((sum, item) => sum + item.valor_total, 0);
        const totalSaldoServicos = data.reduce((sum, item) => sum + item.saldo_devedor, 0);
        foot = [['Total', '', '', `R$ ${totalValorServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${totalSaldoServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_servicos.pdf';
        break;
      case 'accountsPayable':
        title = 'Relatório de Contas a Pagar';
        head = [['Descrição', 'Favorecido', 'Vencimento', 'Valor', 'Status']];
        body = data.map((item: Account) => [item.descricao, getPayeeName(item), item.vencimento ? format(item.vencimento, "dd/MM/yyyy") : '-', `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, item.status]);
        const totalContasPagar = data.reduce((sum, item) => sum + item.valor, 0);
        foot = [['Total', '', '', `R$ ${totalContasPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_contas_a_pagar.pdf';
        break;
       case 'commissions':
        title = 'Relatório de Comissões';
        head = [['Funcionário', 'Serviço', 'Data', 'Valor', 'Status']];
        body = data.map((item: Commission) => [getEmployeeName(item.funcionario_id), getServiceDescription(item.servico_id), item.data ? format(item.data, "dd/MM/yyyy") : '-', `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, item.status]);
        const totalComissoes = data.reduce((sum, item) => sum + item.valor, 0);
        foot = [['Total', '', '', `R$ ${totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_comissoes.pdf';
        break;
      default: return;
    }

    if (data.length === 0) {
      toast({ variant: "destructive", title: "Nenhum dado", description: `Não há dados para gerar o relatório com os filtros atuais.` });
      return;
    }

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${title} - EngiFlow`, 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: head,
      body: body,
      foot: foot,
      theme: 'striped',
      headStyles: { fillColor: [34, 139, 34] },
      footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    doc.save(fileName);
  };
  
  const renderFilterControls = () => {
    const hasStatus = ['services', 'accountsPayable', 'commissions'].includes(selectedReport);
    const hasDate = ['services', 'accountsPayable', 'commissions'].includes(selectedReport);
    const searchPlaceholder = {
        clients: "Buscar por nome ou CPF/CNPJ...",
        suppliers: "Buscar por razão social ou CNPJ...",
        services: "Buscar por descrição ou cliente...",
        accountsPayable: "Buscar por descrição ou favorecido...",
        commissions: "Buscar por funcionário ou serviço...",
    }[selectedReport];

    const statusOptions = {
        services: [{value: 'em andamento', label: 'Em andamento'}, {value: 'concluído', label: 'Concluído'}, {value: 'cancelado', label: 'Cancelado'}],
        accountsPayable: [{value: 'pendente', label: 'Pendente'}, {value: 'pago', label: 'Pago'}],
        commissions: [{value: 'pendente', label: 'Pendente'}, {value: 'pago', label: 'Pago'}],
    }[selectedReport] || [];

    return (
        <div className="flex flex-wrap items-center gap-4 p-4 mt-4 bg-muted rounded-lg">
            <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={searchPlaceholder}
                    className="pl-10"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                />
            </div>
            {hasDate && (
                <Popover>
                    <PopoverTrigger asChild>
                    <Button id="date" variant={"outline"} className={cn( "w-full sm:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Filtrar por data...</span>)}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                    </PopoverContent>
                </Popover>
            )}
            {hasStatus && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                <XCircle className="mr-2 h-4 w-4"/>
                Limpar Filtros
            </Button>
        </div>
    );
  };
  
  const renderReportCard = () => {
    
    const totals = useMemo(() => {
        if (!filteredData) return {};
        switch(selectedReport) {
            case 'services':
                return {
                    valor_total: filteredData.reduce((sum, item) => sum + item.valor_total, 0),
                    saldo_devedor: filteredData.reduce((sum, item) => sum + item.saldo_devedor, 0)
                };
            case 'accountsPayable':
                return {
                    valor: filteredData.reduce((sum, item) => sum + item.valor, 0)
                };
            case 'commissions':
                return {
                    valor: filteredData.reduce((sum, item) => sum + item.valor, 0)
                };
            default:
                return {};
        }
    }, [filteredData, selectedReport]);

    switch (selectedReport) {
      case 'clients':
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Relatório de Clientes</CardTitle>
                  <CardDescription>Visualize e exporte a lista de todos os clientes cadastrados.</CardDescription>
                </div>
                <Button onClick={generatePdf} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
              </div>
              {renderFilterControls()}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Cidade</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((client) => (
                      <TableRow key={client.codigo_cliente}><TableCell className="font-medium">{client.nome_completo}</TableCell><TableCell>{client.cpf_cnpj || '-'}</TableCell><TableCell>{client.telefone || '-'}</TableCell><TableCell>{client.endereco_residencial?.city || '-'}</TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum cliente encontrado.</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case 'suppliers':
        return (
          <Card>
            <CardHeader>
               <div className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Relatório de Fornecedores</CardTitle>
                    <CardDescription>Exporte a lista completa de fornecedores.</CardDescription>
                </div>
                <Button onClick={generatePdf} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
               </div>
                {renderFilterControls()}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Razão Social</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((s) => (
                      <TableRow key={s.id}><TableCell className="font-medium">{s.razao_social}</TableCell><TableCell>{s.cnpj || '-'}</TableCell><TableCell>{s.telefone || '-'}</TableCell><TableCell>{s.email || '-'}</TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum fornecedor encontrado.</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case 'services':
        return (
          <Card>
            <CardHeader>
               <div className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Relatório de Serviços</CardTitle>
                        <CardDescription>Exporte a lista de todos os serviços prestados.</CardDescription>
                    </div>
                    <Button onClick={generatePdf} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
               </div>
                {renderFilterControls()}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Data</TableHead><TableHead>Valor Total</TableHead><TableHead>Saldo Devedor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((s) => (
                      <TableRow key={s.id}><TableCell className="font-medium">{s.descricao}</TableCell><TableCell>{getClientName(s.cliente_id)}</TableCell><TableCell>{s.data_cadastro ? format(s.data_cadastro, "dd/MM/yyyy") : '-'}</TableCell><TableCell className="text-green-500">R$ {s.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell className="text-red-500">R$ {s.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell><Badge variant={s.status === 'concluído' ? 'secondary' : s.status === 'cancelado' ? 'destructive' : 'default'}>{s.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>)}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-green-500">R$ {(totals.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold text-red-500">R$ {(totals.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case 'accountsPayable':
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Relatório de Contas a Pagar</CardTitle>
                    <CardDescription>Exporte o histórico de contas a pagar.</CardDescription>
                </div>
                <Button onClick={generatePdf} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
              </div>
                {renderFilterControls()}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Favorecido</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((acc) => (
                      <TableRow key={acc.id}><TableCell className="font-medium">{acc.descricao}</TableCell><TableCell>{getPayeeName(acc)}</TableCell><TableCell>{acc.vencimento ? format(acc.vencimento, "dd/MM/yyyy") : '-'}</TableCell><TableCell className="text-right text-red-500">R$ {acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell><Badge variant={acc.status === 'pago' ? 'secondary' : 'destructive'}>{acc.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhuma conta a pagar encontrada.</TableCell></TableRow>)}
                  </TableBody>
                   <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-red-500">R$ {(totals.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
       case 'commissions':
        return (
          <Card>
            <CardHeader>
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Relatório de Comissões</CardTitle>
                        <CardDescription>Exporte o histórico de comissões pagas e pendentes.</CardDescription>
                    </div>
                    <Button onClick={generatePdf} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
                </div>
                {renderFilterControls()}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Serviço</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((comm) => (
                      <TableRow key={comm.id}><TableCell className="font-medium">{getEmployeeName(comm.funcionario_id)}</TableCell><TableCell>{getServiceDescription(comm.servico_id)}</TableCell><TableCell>{comm.data ? format(comm.data, "dd/MM/yyyy") : '-'}</TableCell><TableCell className="text-right text-green-500">R$ {comm.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell><Badge variant={comm.status === 'pago' ? 'secondary' : 'destructive'}>{comm.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhuma comissão encontrada.</TableCell></TableRow>)}
                  </TableBody>
                   <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-green-500">R$ {(totals.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  }


  if (isLoading) {
      return <div className="flex justify-center items-center h-full">Carregando dados...</div>
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios e documentos importantes do seu negócio.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <Label htmlFor="report-type">Selecione o tipo de relatório</Label>
        <Select value={selectedReport} onValueChange={(value) => {
            setSelectedReport(value as ReportType);
            clearFilters();
        }}>
            <SelectTrigger id="report-type">
                <SelectValue placeholder="Selecione um relatório" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="clients">Clientes</SelectItem>
                <SelectItem value="suppliers">Fornecedores</SelectItem>
                <SelectItem value="services">Serviços</SelectItem>
                <SelectItem value="accountsPayable">Contas a Pagar</SelectItem>
                <SelectItem value="commissions">Comissões</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {renderReportCard()}
      </div>

    </div>
  );
}
