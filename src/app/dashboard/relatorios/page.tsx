

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
import type { Client, Supplier, Service, Account, Employee, CompanyData, Commission } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Search, XCircle, Calendar as CalendarIcon, ChevronDown, ChevronRight, Link as LinkIcon } from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
import { PageHeader } from '@/components/page-header';
import { useCompanyData } from '../layout';

type ReportType = 'clients' | 'suppliers' | 'services' | 'accountsPayable' | 'commissions';

function ClientReportRow({ client }: { client: Client }) {
  const [isOpen, setIsOpen] = useState(false);
  const residencial = client.endereco_residencial;

  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="sm" className="w-9 p-0" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="sr-only">{isOpen ? 'Fechar' : 'Abrir'}</span>
          </Button>
        </TableCell>
        <TableCell className="font-medium">{client.nome_completo}</TableCell>
        <TableCell>{client.cpf_cnpj || '-'}</TableCell>
        <TableCell>{client.telefone || '-'}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={4} className="p-0">
            <div className="p-6 bg-muted/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Dados Pessoais</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium text-muted-foreground">RG:</span> {client.rg || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Endereço Residencial</h4>
                  {residencial ? (
                    <div className="text-sm space-y-1">
                      <p>{residencial.street}, {residencial.number}</p>
                      <p>{residencial.neighborhood}, {residencial.city} - {residencial.state}</p>
                      <p>CEP: {residencial.zip}</p>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">N/A</p>}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function SupplierReportRow({ supplier }: { supplier: Supplier }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="sm" className="w-9 p-0" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="sr-only">{isOpen ? 'Fechar' : 'Abrir'}</span>
          </Button>
        </TableCell>
        <TableCell className="font-medium">{supplier.razao_social}</TableCell>
        <TableCell>{supplier.cnpj || '-'}</TableCell>
        <TableCell>{supplier.telefone || '-'}</TableCell>
        <TableCell>{supplier.email || '-'}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <div className="p-6 bg-muted/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Endereço</h4>
                  <p className="text-sm">{supplier.endereco || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Produtos/Serviços</h4>
                  {supplier.produtos_servicos && supplier.produtos_servicos.length > 0 ? (
                    <ul className="list-disc list-inside text-sm">
                      {supplier.produtos_servicos.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">N/A</p>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}


export default function RelatoriosPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const companyData = useCompanyData();
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
  
  const getClient = (clientId: string) => clients.find(c => c.codigo_cliente === clientId);
  const getEmployeeName = (employeeId: string) => employees.find(e => e.id === employeeId)?.nome || 'Desconhecido';
  const getService = (serviceId: string) => services.find(s => s.id === serviceId);

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
                .filter(s => s.descricao.toLowerCase().includes(searchLower) || (getClient(s.cliente_id)?.nome_completo.toLowerCase() || '').includes(searchLower))
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
                .filter(c => {
                    const service = getService(c.servico_id);
                    if (!service) return false;
                    const client = getClient(service.cliente_id);
                    return getEmployeeName(c.funcionario_id).toLowerCase().includes(searchLower) || 
                           service.descricao.toLowerCase().includes(searchLower) ||
                           (client && client.nome_completo.toLowerCase().includes(searchLower));
                })
                .filter(c => {
                    if (!dateRange?.from) return true;
                    const from = startOfDay(dateRange.from);
                    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                    return c.data >= from && c.data <= to;
                });
            break;
    }
    return data;
  }, [selectedReport, clients, suppliers, services, accountsPayable, commissions, searchFilter, statusFilter, dateRange]);

 const totals = useMemo(() => {
    if (!filteredData) return {};
    switch(selectedReport) {
        case 'services':
            return {
                valor_total: filteredData.reduce((sum, item) => sum + (item.valor_total || 0), 0),
                saldo_devedor: filteredData.reduce((sum, item) => sum + (item.saldo_devedor || 0), 0)
            };
        case 'accountsPayable':
            return {
                valor: filteredData.reduce((sum, item) => sum + (item.valor || 0), 0)
            };
        case 'commissions':
            return {
                valor: filteredData.reduce((sum, item) => sum + (item.valor || 0), 0)
            };
        default:
            return {};
    }
  }, [filteredData, selectedReport]);

  const getDistributionStatus = (service: Service) => {
    const isDistributable = service.status !== 'cancelado' && (service.valor_pago || 0) > 0;
    
    if (!isDistributable) {
        return { text: 'Aguardando', variant: 'outline' as const };
    }
    
    if (service.lucro_distribuido) {
        return { text: 'Realizada', variant: 'secondary' as const };
    }
    
    return { text: 'Pendente', variant: 'destructive' as const };
  }


  const generatePdf = () => {
    const data = filteredData;
    let head: any[];
    let body: any[][];
    let foot: any[][] | undefined = undefined;
    let fileName = '';
    let reportTitle = '';

    if (data.length === 0) {
      toast({ variant: "destructive", title: "Nenhum dado", description: `Não há dados para gerar o relatório com os filtros atuais.` });
      return;
    }

    switch (selectedReport) {
      case 'clients':
        reportTitle = 'Relatório de Clientes';
        head = [['Dados Pessoais', 'Endereço Residencial']];
        body = data.map((item: Client) => {
            const residencial = item.endereco_residencial;
            return [
                `${item.nome_completo}\nRG: ${item.rg || '-'}\nCPF/CNPJ: ${item.cpf_cnpj || '-'}`,
                residencial ? `${residencial.street}, ${residencial.number}\n${residencial.neighborhood}, ${residencial.city} - ${residencial.state}\nCEP: ${residencial.zip}` : 'N/A',
            ];
        });
        fileName = 'relatorio_clientes.pdf';
        break;
      case 'suppliers':
        reportTitle = 'Relatório de Fornecedores';
        head = [['Fornecedor', 'Contato', 'Endereço', 'Produtos/Serviços']];
        body = data.map((item: Supplier) => {
            return [
                { content: `${item.razao_social}\nCNPJ: ${item.cnpj || '-'}`, styles: { fontStyle: 'bold' } },
                `${item.telefone || '-'}\n${item.email || ''}`,
                item.endereco || 'N/A',
                item.produtos_servicos?.join(', ') || 'N/A'
            ];
        });
        fileName = 'relatorio_fornecedores.pdf';
        break;
      case 'services':
        reportTitle = 'Relatório de Serviços';
        head = [['Cliente / Obra', 'Detalhes do Serviço', 'Valores']];
        body = data.map((item: Service) => {
            const client = getClient(item.cliente_id);
            const obra = item.endereco_obra;
            const formattedObra = obra && obra.street ? `Endereço da Obra:\n${obra.street}, ${obra.number}\n${obra.neighborhood}, ${obra.city}` : 'Endereço da obra não informado';
            
            const clientInfo = `${client?.nome_completo || 'Desconhecido'}\nRG: ${client?.rg || '-'}\nCPF/CNPJ: ${client?.cpf_cnpj || '-'}\nTelefone: ${client?.telefone || '-'}\n\n${formattedObra}`;

            const m2 = item.quantidade_m2 ? `\nQuantidade (m²): ${item.quantidade_m2}` : '';
            const anexos = item.anexos && item.anexos.length > 0 ? `\nAnexos: ${item.anexos.join(', ')}` : '';

            const valores = `Total: R$ ${item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nSaldo: R$ ${item.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            
            return [
                clientInfo, 
                `${item.descricao}${m2}${anexos}`,
                valores
            ];
        });
        foot = [['Total Geral', '', `Total: R$ ${(totals.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nSaldo: R$ ${(totals.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]];
        fileName = 'relatorio_servicos.pdf';
        break;
      case 'accountsPayable':
        reportTitle = 'Relatório de Contas a Pagar';
        head = [['Descrição', 'Favorecido', 'Vencimento', 'Valor', 'Status']];
        body = data.map((item: Account) => [item.descricao, getPayeeName(item), item.vencimento ? format(item.vencimento, "dd/MM/yyyy") : '-', `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, item.status]);
        foot = [['Total', '', '', `R$ ${(totals.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_contas_a_pagar.pdf';
        break;
       case 'commissions':
        reportTitle = 'Relatório de Comissões';
        head = [['Funcionário', 'Cliente', 'Serviço Referente', 'Data', 'Valor da Comissão', 'Status']];
        body = data.map((item: Commission) => {
            const service = getService(item.servico_id);
            const client = service ? getClient(service.cliente_id) : undefined;
            const address = service?.endereco_obra;
            const formattedAddress = address ? `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}` : '';

            return [
                getEmployeeName(item.funcionario_id), 
                client?.nome_completo || 'Desconhecido',
                `${service?.descricao || 'Desconhecido'}\n${formattedAddress}`,
                item.data ? format(item.data, "dd/MM/yyyy") : '-',
                `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
                item.status
            ];
        });
        foot = [['Total', '', '', '',`R$ ${(totals.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_comissoes.pdf';
        break;
      default: return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 15;

    // Cabeçalho da Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    if (companyData?.companyName) {
        doc.text(companyData.companyName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (companyData?.slogan) {
        doc.text(companyData.slogan, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }
    if (companyData?.address) {
        doc.text(companyData.address, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }
    const contactInfo = [
        companyData?.phone,
        companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : '',
        companyData?.crea ? `CREA: ${companyData.crea}` : ''
    ].filter(Boolean).join(' | ');
    if (contactInfo) {
        doc.text(contactInfo, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;
    }
    
    // Título do Relatório
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;


    autoTable(doc, {
      startY: currentY,
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
        commissions: "Buscar por funcionário, serviço ou cliente...",
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
                  <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Nome</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Telefone</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((client: Client) => (
                      <ClientReportRow key={client.codigo_cliente} client={client} />
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
                  <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Razão Social</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((supplier: Supplier) => (
                      <SupplierReportRow key={supplier.id} supplier={supplier} />
                    )) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum fornecedor encontrado.</TableCell></TableRow>)}
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
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Detalhes do Serviço</TableHead>
                            <TableHead>Valores</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((s: Service) => {
                         const client = getClient(s.cliente_id);
                         const obra = s.endereco_obra;
                         const formattedObra = (obra && obra.street) ? `Obra: ${obra.street}, ${obra.number} - ${obra.neighborhood}, ${obra.city}` : '';
                         
                         const distributionStatus = getDistributionStatus(s);

                         return (
                            <TableRow key={s.id}>
                                <TableCell className="align-top">
                                    <div className="font-bold">{client?.nome_completo || 'Desconhecido'}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="font-medium">{s.descricao}</div>
                                  <div className="text-xs text-muted-foreground">{formattedObra}</div>
                                  {(s.coordenadas?.lat && s.coordenadas?.lng) && (
                                    <div className="text-xs text-muted-foreground">
                                        Coords: {s.coordenadas.lat}, {s.coordenadas.lng}
                                    </div>
                                  )}
                                   {(s.anexos && s.anexos.length > 0) && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                            {s.anexos.map((anexo, index) => (
                                                <a key={index} href={anexo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline truncate">
                                                    <LinkIcon className="h-3 w-3 shrink-0"/>
                                                    <span className="truncate">{anexo}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="font-medium">Total: R$ {(s.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className="text-sm text-red-500">Saldo: R$ {(s.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    {s.quantidade_m2 ? <div className="text-xs text-muted-foreground">Área: {s.quantidade_m2} m²</div> : null}
                                </TableCell>
                                <TableCell className="align-top space-y-1">
                                    <Badge variant={s.status === 'concluído' ? 'secondary' : s.status === 'cancelado' ? 'destructive' : 'default'}>{s.status}</Badge>
                                    <Badge variant={distributionStatus.variant}>{distributionStatus.text}</Badge>
                                </TableCell>
                            </TableRow>
                         )
                    }) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>)}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">Total</TableCell>
                      <TableCell className="font-bold">
                        <div>Total: R$ {(totals.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-red-500">Saldo: R$ {(totals.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </TableCell>
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
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((acc: Account) => (
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
                  <TableHeader>
                    <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço Referente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor da Comissão</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 10).map((comm: Commission) => {
                        const service = getService(comm.servico_id);
                        const client = service ? getClient(service.cliente_id) : undefined;
                        const address = service?.endereco_obra;
                        const formattedAddress = address ? `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}` : '';
                        return (
                            <TableRow key={comm.id}>
                                <TableCell className="font-medium">{getEmployeeName(comm.funcionario_id)}</TableCell>
                                <TableCell>{client?.nome_completo || 'Desconhecido'}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{service?.descricao || 'Desconhecido'}</div>
                                    <div className="text-xs text-muted-foreground">{formattedAddress}</div>
                                </TableCell>
                                <TableCell>{comm.data ? format(comm.data, "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell className="text-right text-green-500">R$ {comm.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell><Badge variant={comm.status === 'pago' ? 'secondary' : 'destructive'}>{comm.status}</Badge></TableCell>
                            </TableRow>
                        )
                    }) : (<TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma comissão encontrada.</TableCell></TableRow>)}
                  </TableBody>
                   <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">Total</TableCell>
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
      <PageHeader 
        title="Relatórios"
        description="Gere relatórios e documentos importantes do seu negócio."
      />

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
