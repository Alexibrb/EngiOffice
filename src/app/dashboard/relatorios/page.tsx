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
} from '@/components/ui/table';
import type { Client, Supplier, Service, Account, Employee, AuthorizedUser, City } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Search, XCircle, Calendar as CalendarIcon, ChevronDown, ChevronRight, Link as LinkIcon, ExternalLink, ClipboardCopy } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
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
import { onAuthStateChanged } from 'firebase/auth';

type ReportType = 'clients' | 'suppliers' | 'services' | 'accountsPayable';

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
        <TableCell>{residencial?.city || '-'}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
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
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Endereço</h4>
                  <p className="text-sm">{supplier.endereco || 'N/A'}</p>
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
  const [cities, setCities] = useState<City[]>([]);
  const companyData = useCompanyData();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState<ReportType>('clients');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  

  const { toast } = useToast();

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clientsSnapshot, suppliersSnapshot, servicesSnapshot, accountsPayableSnapshot, employeesSnapshot, citiesSnapshot] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "fornecedores")),
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "contas_a_pagar")),
        getDocs(collection(db, "funcionarios")),
        getDocs(collection(db, "cidades")),
      ]);

      setClients(clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[]);
      setSuppliers(suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[]);
      setServices(servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, data_cadastro: doc.data().data_cadastro.toDate() })) as Service[]);
      setAccountsPayable(accountsPayableSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, vencimento: doc.data().vencimento.toDate() })) as Account[]);
      setEmployees(employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[]);
      setCities(citiesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as City[]);

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

  const getPayeeName = (account: Account) => {
      if (account.tipo_referencia === 'funcionario') return employees.find(e => e.id === account.referencia_id)?.nome || 'Funcionário não encontrado';
      return suppliers.find(s => s.id === account.referencia_id)?.razao_social || 'Fornecedor não encontrado';
  };

  const clearFilters = () => {
      setSearchFilter('');
      setStatusFilter('');
      setSelectedCityFilter('');
      setDateRange(undefined);
  };
  
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Sucesso!",
      description: "Link copiado para a área de transferência.",
    });
  };

  const getExecutionStatusBadge = (status: Service['status_execucao']) => {
    switch (status) {
        case 'não iniciado': return 'secondary';
        case 'em andamento': return 'default';
        case 'paralisado': return 'destructive';
        case 'fiscalizado': return 'outline';
        case 'finalizado': return 'accent';
        default: return 'default';
    }
  };

  const filteredData = useMemo(() => {
    let data: any[] = [];
    const searchLower = searchFilter.toLowerCase();
    
    switch (selectedReport) {
        case 'clients':
            data = clients
                .filter(c => c.nome_completo.toLowerCase().includes(searchLower) || c.cpf_cnpj?.includes(searchFilter))
                .filter(c => selectedCityFilter ? c.endereco_residencial?.city === selectedCityFilter : true);
            break;
        case 'suppliers':
            data = suppliers.filter(s => s.razao_social.toLowerCase().includes(searchLower) || s.cnpj?.includes(searchFilter));
            break;
        case 'services':
            data = services
                .filter(s => statusFilter ? s.status_execucao === statusFilter : true)
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
    }
    return data;
  }, [selectedReport, clients, suppliers, services, accountsPayable, searchFilter, statusFilter, selectedCityFilter, dateRange]);

 const totals = useMemo(() => {
    if (!filteredData) return {};
    switch(selectedReport) {
        case 'services':
            return {
                count: filteredData.length,
                valor_total: filteredData.reduce((sum, item) => sum + (item.valor_total || 0), 0),
                valor_pago: filteredData.reduce((sum, item) => sum + (item.valor_pago || 0), 0),
                saldo_devedor: filteredData.reduce((sum, item) => sum + (item.saldo_devedor || 0), 0)
            };
        case 'accountsPayable':
            const pago = filteredData.filter(a => a.status === 'pago').reduce((sum, item) => sum + (item.valor || 0), 0);
            const pendente = filteredData.filter(a => a.status === 'pendente').reduce((sum, item) => sum + (item.valor || 0), 0);
            return {
                count: filteredData.length,
                pago,
                pendente,
                valor: pago + pendente
            };
        default:
            return { count: filteredData.length };
    }
  }, [filteredData, selectedReport]);

  const getFinancialStatus = (service: Service) => {
      if (service.status_financeiro === 'cancelado') return { text: 'Cancelado', variant: 'destructive' as const };
      if (service.saldo_devedor <= 0.01) return { text: 'Pago', variant: 'secondary' as const };
      return { text: 'Pendente', variant: 'destructive' as const };
  }


  const generatePdf = () => {
    const data = filteredData;
    let head: any[];
    let body: any[][];
    let foot: any[][] | undefined = undefined;
    let fileName = '';
    let reportTitle = '';
    let doc: jsPDF;

    if (data.length === 0) {
      toast({ variant: "destructive", title: "Nenhum dado", description: `Não há dados para gerar o relatório com os filtros atuais.` });
      return;
    }

    switch (selectedReport) {
      case 'clients':
        doc = new jsPDF();
        reportTitle = 'Relatório de Clientes';
        head = [['Dados Pessoais', 'Endereço Residencial']];
        body = data.map((item: Client) => {
            const residencial = item.endereco_residencial;
            const dadosPessoais = `${item.nome_completo}\nRG: ${item.rg || '-'}\nCPF/CNPJ: ${item.cpf_cnpj || '-'}\nTel: ${item.telefone || '-'}`;
            const endereco = residencial ? `${residencial.street}, ${residencial.number}\n${residencial.neighborhood}, ${residencial.city} - ${residencial.state}\nCEP: ${residencial.zip}` : 'N/A';
            return [dadosPessoais, endereco];
        });
        fileName = 'relatorio_clientes.pdf';
        break;
      case 'suppliers':
        doc = new jsPDF();
        reportTitle = 'Relatório de Fornecedores';
        head = [['Fornecedor', 'Contato', 'Endereço']];
        body = data.map((item: Supplier) => {
            return [
                { content: `${item.razao_social}\nCNPJ: ${item.cnpj || '-'}`, styles: { fontStyle: 'bold' } },
                `${item.telefone || '-'}\n${item.email || ''}`,
                item.endereco || 'N/A'
            ];
        });
        fileName = 'relatorio_fornecedores.pdf';
        break;
      case 'services':
        doc = new jsPDF({ orientation: 'landscape' });
        reportTitle = 'Relatório de Serviços';
        head = [['Cliente\nDescrição\nEndereço da Obra', 'Data', 'Área (m²)', 'Valor Total', 'Saldo Devedor', 'Status Execução']];
        body = data.map((item: Service) => {
            const client = getClient(item.cliente_id);
            const obra = item.endereco_obra;
            let formattedObra = obra && obra.street ? `${obra.street}, ${obra.number} - ${obra.neighborhood}, ${obra.city} - ${obra.state}` : 'Endereço da obra não informado';
            if (item.coordenadas?.lat && item.coordenadas?.lng) {
                formattedObra += `\nCoords.: ${item.coordenadas.lat}, ${item.coordenadas.lng}`;
            }
             if (item.anexos && item.anexos.length > 0) {
              formattedObra += `\nAnexos: ${item.anexos.join(', ')}`;
            }

            const description = `${item.descricao}`;
            const clientAndDesc = `${client?.nome_completo || 'Desconhecido'}\n${description}\n${formattedObra}`;

            return [
                clientAndDesc,
                item.data_cadastro ? format(item.data_cadastro, "dd/MM/yyyy") : '-',
                item.quantidade_m2 ? item.quantidade_m2.toLocaleString('pt-BR') : '0',
                `R$ ${item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${item.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                item.status_execucao,
            ];
        });

        foot = [['Total Geral', '', '', `R$ ${(totals.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${(totals.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_servicos.pdf';
        break;
      case 'accountsPayable':
        doc = new jsPDF();
        reportTitle = 'Relatório de Contas a Pagar';
        head = [['Descrição', 'Favorecido', 'Vencimento', 'Valor', 'Status']];
        body = data.map((item: Account) => [item.descricao, getPayeeName(item), item.vencimento ? format(item.vencimento, "dd/MM/yyyy") : '-', `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, item.status]);
        foot = [['Total', '', '', `R$ ${(totals.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']];
        fileName = 'relatorio_contas_a_pagar.pdf';
        break;
      default: return;
    }

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
    const isClients = selectedReport === 'clients';
    const hasStatus = ['services', 'accountsPayable'].includes(selectedReport);
    const hasDate = ['services', 'accountsPayable'].includes(selectedReport);
    const searchPlaceholder = {
        clients: "Buscar por nome ou CPF/CNPJ...",
        suppliers: "Buscar por razão social ou CNPJ...",
        services: "Buscar por descrição ou cliente...",
        accountsPayable: "Buscar por descrição ou favorecido...",
    }[selectedReport];

    const statusOptions = {
        services: [{value: 'não iniciado', label: 'Não iniciado'}, {value: 'em andamento', label: 'Em andamento'}, {value: 'paralisado', label: 'Paralisado'}, {value: 'fiscalizado', label: 'Fiscalizado'}, {value: 'finalizado', label: 'Finalizado'}],
        accountsPayable: [{value: 'pendente', label: 'Pendente'}, {value: 'pago', label: 'Pago'}],
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
            {isClients && (
                <Select value={selectedCityFilter} onValueChange={setSelectedCityFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrar por cidade..." />
                    </SelectTrigger>
                    <SelectContent>
                        {cities.map(city => (
                            <SelectItem key={city.id} value={city.nome_cidade}>
                                {city.nome_cidade}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
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

  const renderTotalsBar = () => {
    switch (selectedReport) {
        case 'clients':
        case 'suppliers':
            return (
                <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                    <div className="font-bold text-lg pl-2">Cadastros Encontrados</div>
                    <div className="flex flex-row gap-12 pr-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-blue-400">Total:</div>
                            <div className="text-lg font-bold text-blue-300">{totals.count}</div>
                        </div>
                    </div>
                </div>
            );
        case 'services':
            return (
                <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                    <div className="font-bold text-lg pl-2">Totais Filtrados</div>
                    <div className="flex flex-row gap-12 pr-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-green-500">Recebido: R$ {totals.valor_pago?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            <div className="text-sm font-bold text-red-500">Saldo: R$ {totals.saldo_devedor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-blue-400">Total Contratos: R$</div>
                            <div className="text-lg font-bold text-blue-300">{totals.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            );
        case 'accountsPayable':
            return (
                <div className="bg-slate-900 text-white p-4 rounded-t-lg flex flex-row justify-between items-center border-x border-t">
                    <div className="font-bold text-lg pl-2">Totais Filtrados</div>
                    <div className="flex flex-row gap-12 pr-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-green-500">Pago: R$ {totals.pago?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            <div className="text-sm font-bold text-red-500">Pendente: R$ {totals.pendente?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-blue-400">Total Geral: R$</div>
                            <div className="text-lg font-bold text-blue-300">{totals.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            );
        default: return null;
    }
  }
  
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
              {renderTotalsBar()}
              <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 50).map((client: Client) => (
                      <ClientReportRow key={client.codigo_cliente} client={client} />
                    )) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum cliente encontrado.</TableCell></TableRow>)}
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
              {renderTotalsBar()}
              <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Razão Social</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 50).map((supplier: Supplier) => (
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
              {renderTotalsBar()}
              <div className="border border-t-0 rounded-b-lg overflow-hidden">
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
                    {filteredData.length > 0 ? filteredData.slice(0, 50).map((s: Service) => {
                         const client = getClient(s.cliente_id);
                         const obra = s.endereco_obra;
                         const formattedObra = (obra && obra.street) ? `Obra: ${obra.street}, ${obra.number} - ${obra.neighborhood}, ${obra.city}` : '';
                         
                         const financialStatus = getFinancialStatus(s);

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
                                            {s.anexos.map((anexo, index) => {
                                                 const isWebUrl = anexo.startsWith('http://') || anexo.startsWith('https://');
                                                 return (
                                                    <div key={index} className="flex items-center gap-1 group">
                                                        <LinkIcon className="h-3 w-3 shrink-0 text-primary" />
                                                        <span className="truncate flex-1">{anexo}</span>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 group-hover:opacity-100" onClick={() => handleCopyLink(anexo)}>
                                                            <ClipboardCopy className="h-3 w-3" />
                                                        </Button>
                                                        {isWebUrl && (
                                                        <a href={anexo} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 group-hover:opacity-100">
                                                                <ExternalLink className="h-3 w-3" />
                                                            </Button>
                                                        </a>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="font-medium">Total: R$ {(s.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className={cn("text-sm font-medium", s.saldo_devedor > 0.01 ? "text-red-500" : "text-muted-foreground")}>Saldo: R$ {(s.saldo_devedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    {s.quantidade_m2 ? <div className="text-xs text-muted-foreground">Área: {s.quantidade_m2} m²</div> : null}
                                </TableCell>
                                <TableCell className="align-top space-y-1">
                                    <Badge variant={getExecutionStatusBadge(s.status_execucao)} className="block w-fit">{s.status_execucao}</Badge>
                                    <Badge variant={financialStatus.variant}>{financialStatus.text}</Badge>
                                </TableCell>
                            </TableRow>
                         )
                    }) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>)}
                  </TableBody>
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
              {renderTotalsBar()}
              <div className="border border-t-0 rounded-b-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Favorecido</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? filteredData.slice(0, 50).map((acc: Account) => (
                      <TableRow key={acc.id}><TableCell className="font-medium">{acc.descricao}</TableCell><TableCell>{getPayeeName(acc)}</TableCell><TableCell>{acc.vencimento ? format(acc.vencimento, "dd/MM/yyyy") : '-'}</TableCell><TableCell className="text-right text-red-500">R$ {acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell><Badge variant={acc.status === 'pago' ? 'secondary' : 'destructive'}>{acc.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhuma conta a pagar encontrada.</TableCell></TableRow>)}
                  </TableBody>
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
            </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {renderReportCard()}
      </div>

    </div>
  );
}
