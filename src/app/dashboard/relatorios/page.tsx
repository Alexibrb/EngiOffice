
'use client';

import { useState, useEffect } from 'react';
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
import type { Client, Supplier, Service, Account, Employee } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type ReportType = 'clients' | 'suppliers' | 'services' | 'accountsPayable';


export default function RelatoriosPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
   const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('clients');
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clientsSnapshot, suppliersSnapshot, servicesSnapshot, accountsPayableSnapshot, employeesSnapshot] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "fornecedores")),
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "contas_a_pagar")),
        getDocs(collection(db, "funcionarios")),
      ]);

      const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
      setClients(clientsData);

      const suppliersData = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Supplier[];
      setSuppliers(suppliersData);

      const servicesData = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, data_cadastro: data.data_cadastro.toDate() } as Service;
      });
      setServices(servicesData);
      
      const accountsPayableData = accountsPayableSnapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, vencimento: data.vencimento.toDate() } as Account;
      });
      setAccountsPayable(accountsPayableData);

      const employeesData = employeesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Employee[];
      setEmployees(employeesData);

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
  
  const getClientName = (clientId: string) => {
    return clients.find(c => c.codigo_cliente === clientId)?.nome_completo || 'Desconhecido';
  }
  
  const getPayeeName = (account: Account) => {
      if (account.tipo_referencia === 'funcionario') {
          return employees.find(e => e.id === account.referencia_id)?.nome || 'Funcionário não encontrado';
      }
      return suppliers.find(s => s.id === account.referencia_id)?.razao_social || 'Fornecedor não encontrado';
  };


  const generatePdf = (type: ReportType) => {
    let data;
    let head: string[][];
    let body: any[][];
    let fileName = '';
    let title = '';

    switch (type) {
      case 'clients':
        data = clients;
        title = 'Relatório de Clientes';
        head = [['Nome', 'CPF/CNPJ', 'Telefone', 'Cidade']];
        body = data.map((item) => [
            item.nome_completo,
            item.cpf_cnpj || '-',
            item.telefone || '-',
            item.endereco_residencial?.city || '-',
        ]);
        fileName = 'relatorio_clientes.pdf';
        break;
      case 'suppliers':
        data = suppliers;
        title = 'Relatório de Fornecedores';
        head = [['Razão Social', 'CNPJ', 'Telefone', 'Email']];
        body = data.map((item) => [
            item.razao_social,
            item.cnpj || '-',
            item.telefone || '-',
            item.email || '-',
        ]);
        fileName = 'relatorio_fornecedores.pdf';
        break;
      case 'services':
        data = services;
        title = 'Relatório de Serviços';
        head = [['Descrição', 'Cliente', 'Data de Cadastro', 'Valor', 'Status']];
        body = data.map((item) => [
            item.descricao,
            getClientName(item.cliente_id),
            item.data_cadastro ? format(item.data_cadastro, "dd/MM/yyyy") : '-',
            `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            item.status,
        ]);
        fileName = 'relatorio_servicos.pdf';
        break;
      case 'accountsPayable':
        data = accountsPayable;
        title = 'Relatório de Contas a Pagar';
        head = [['Descrição', 'Favorecido', 'Vencimento', 'Valor', 'Status']];
        body = data.map((item) => [
            item.descricao,
            getPayeeName(item),
            item.vencimento ? format(item.vencimento, "dd/MM/yyyy") : '-',
            `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            item.status,
        ]);
        fileName = 'relatorio_contas_a_pagar.pdf';
        break;
      default:
        return;
    }

    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum dado",
        description: `Não há dados para gerar o relatório de ${type}.`,
      });
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
      theme: 'striped',
      headStyles: { fillColor: [34, 139, 34] },
    });
    doc.save(fileName);
  };
  
  const renderReportCard = () => {
    switch (selectedReport) {
      case 'clients':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Clientes</CardTitle>
                <CardDescription>Visualize e exporte a lista de todos os clientes cadastrados.</CardDescription>
              </div>
              <Button onClick={() => generatePdf('clients')} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Cidade</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {clients.length > 0 ? clients.slice(0, 10).map((client) => (
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Fornecedores</CardTitle>
                <CardDescription>Exporte a lista completa de fornecedores.</CardDescription>
              </div>
              <Button onClick={() => generatePdf('suppliers')} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Razão Social</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {suppliers.length > 0 ? suppliers.slice(0, 10).map((s) => (
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Serviços</CardTitle>
                <CardDescription>Exporte a lista de todos os serviços prestados.</CardDescription>
              </div>
              <Button onClick={() => generatePdf('services')} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Data de Cadastro</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {services.length > 0 ? services.slice(0, 10).map((s) => (
                      <TableRow key={s.id}><TableCell className="font-medium">{s.descricao}</TableCell><TableCell>{getClientName(s.cliente_id)}</TableCell><TableCell>{s.data_cadastro ? format(s.data_cadastro, "dd/MM/yyyy") : '-'}</TableCell><TableCell><Badge variant={s.status === 'concluído' ? 'secondary' : s.status === 'cancelado' ? 'destructive' : 'default'}>{s.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum serviço encontrado.</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case 'accountsPayable':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Contas a Pagar</CardTitle>
                <CardDescription>Exporte o histórico de contas a pagar.</CardDescription>
              </div>
              <Button onClick={() => generatePdf('accountsPayable')} variant="accent"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Favorecido</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {accountsPayable.length > 0 ? accountsPayable.slice(0, 10).map((acc) => (
                      <TableRow key={acc.id}><TableCell className="font-medium">{acc.descricao}</TableCell><TableCell>{getPayeeName(acc)}</TableCell><TableCell>{acc.vencimento ? format(acc.vencimento, "dd/MM/yyyy") : '-'}</TableCell><TableCell><Badge variant={acc.status === 'pago' ? 'secondary' : 'destructive'}>{acc.status}</Badge></TableCell></TableRow>
                    )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhuma conta a pagar encontrada.</TableCell></TableRow>)}
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
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios e documentos importantes do seu negócio.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <Label htmlFor="report-type">Selecione o tipo de relatório</Label>
        <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as ReportType)}>
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

    

    