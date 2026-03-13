
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Employee, City } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, XCircle, Trash, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Separator } from '@/components/ui/separator';
import { formatCEP } from '@/lib/utils';
import { useCompanyData } from '../layout';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional().refine(val => !val || val.length === 9, {
    message: 'CEP deve ter 8 dígitos.',
  }),
});

const employeeSchema = z.object({
  nome: z.string().min(1, { message: 'Nome é obrigatório.' }),
  cpf: z.string().optional(),
  cargo: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  status: z.enum(['ativo', 'inativo']),
  tipo_contratacao: z.enum(['salario_fixo', 'salario_variavel', 'comissao'], { required_error: 'Tipo de contratação é obrigatório.'}),
  salario: z.coerce.number().optional(),
  dia_pagamento: z.coerce.number().optional(),
  taxa_comissao: z.coerce.number().optional(),
  endereco_residencial: addressSchema.optional(),
});

function EmployeeTableRow({ 
    employee, 
    cities, 
    onEdit, 
    onDelete, 
    onGenerateLetter 
}: { 
    employee: Employee, 
    cities: City[], 
    onEdit: (employee: Employee) => void, 
    onDelete: (id: string) => void,
    onGenerateLetter: (employee: Employee) => void
}) {
  const [isOpen, setIsOpen] = useState(false);
  const residencial = employee.endereco_residencial;

  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="sm" className="w-9 p-0" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="sr-only">{isOpen ? 'Fechar' : 'Abrir'}</span>
          </Button>
        </TableCell>
        <TableCell className="font-medium">{employee.nome}</TableCell>
        <TableCell>{employee.cargo}</TableCell>
        <TableCell>{employee.tipo_contratacao === 'salario_fixo' ? `Salário Fixo (Dia ${employee.dia_pagamento || 'N/A'})` : employee.tipo_contratacao === 'comissao' ? 'Comissionado' : 'Salário Variável'}</TableCell>
        <TableCell>
          <Badge variant={employee.status === 'ativo' ? 'secondary' : 'destructive'}>
            {employee.status}
          </Badge>
        </TableCell>
        <TableCell>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(employee)}>
                Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGenerateLetter(employee)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Carta de Recomendação
                </DropdownMenuItem>
                <AlertDialog>
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                        Excluir
                    </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso excluirá permanentemente o funcionário.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(employee.id)} variant="destructive">
                        Excluir
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
            </DropdownMenu>
        </TableCell>
      </TableRow>
      {isOpen && (
          <TableRow>
              <TableCell colSpan={6} className="p-0">
                  <div className="p-6 bg-muted/50 border-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Dados de Contato</h4>
                        <div className="text-sm space-y-1">
                            <p><span className="font-medium text-muted-foreground">CPF:</span> {employee.cpf || 'N/A'}</p>
                            <p><span className="font-medium text-muted-foreground">Email:</span> {employee.email || 'N/A'}</p>
                            <p><span className="font-medium text-muted-foreground">Telefone:</span> {employee.telefone || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Endereço Residencial</h4>
                        {residencial && residencial.street ? (
                           <div className="text-sm space-y-1">
                            <p>{residencial.street}, {residencial.number}</p>
                            <p>{residencial.neighborhood}, {residencial.city} - {residencial.state}</p>
                            <p>CEP: {residencial.zip}</p>
                          </div>
                        ) : <p className="text-sm text-muted-foreground">Endereço não cadastrado.</p>}
                      </div>
                    </div>
                  </div>
              </TableCell>
          </TableRow>
      )}
    </>
  );
}


export default function FuncionariosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();
  const companyData = useCompanyData();
  
  const [statusFilter, setStatusFilter] = useState<string>('');

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      cargo: '',
      telefone: '',
      email: '',
      status: 'ativo',
      tipo_contratacao: 'salario_fixo',
      endereco_residencial: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
    },
  });
  
  const tipoContratacao = useWatch({
      control: form.control,
      name: 'tipo_contratacao',
  });

  const fetchCities = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "cidades"));
      const citiesData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as City[];
      citiesData.sort((a, b) => a.nome_cidade.localeCompare(b.nome_cidade));
      setCities(citiesData);
    } catch (error) {
      console.error("Erro ao buscar cidades: ", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "funcionarios"));
      const employeesData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Employee[];
      employeesData.sort((a, b) => a.nome.localeCompare(b.nome));
      setEmployees(employeesData);
    } catch (error) {
      console.error("Erro ao buscar funcionários: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de funcionários.",
      });
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchCities();
  }, []);

  const handleSaveEmployee = async (values: z.infer<typeof employeeSchema>) => {
    setIsLoading(true);
    try {
      const employeeData = {
          ...values,
          salario: values.tipo_contratacao === 'salario_fixo' ? values.salario : 0,
          dia_pagamento: values.tipo_contratacao === 'salario_fixo' ? values.dia_pagamento : 0,
          taxa_comissao: values.tipo_contratacao === 'comissao' ? values.taxa_comissao : 0,
      }
      if (editingEmployee) {
        const employeeDocRef = doc(db, 'funcionarios', editingEmployee.id);
        await setDoc(employeeDocRef, employeeData);
        toast({
          title: "Sucesso!",
          description: "Funcionário atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, 'funcionarios'), employeeData);
         toast({
          title: "Sucesso!",
          description: "Funcionário adicionado com sucesso.",
        });
      }
      
      form.reset();
      setEditingEmployee(null);
      setIsDialogOpen(false);
      await fetchEmployees();

    } catch (error) {
      console.error("Erro ao salvar funcionário: ", error);
       toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o funcionário.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      await deleteDoc(doc(db, "funcionarios", employeeId));
      toast({
        title: "Sucesso!",
        description: "Funcionário excluído com sucesso.",
      });
      await fetchEmployees();
    } catch (error) {
      console.error("Erro ao excluir funcionário: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao excluir o funcionário.",
      });
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
        const querySnapshot = await getDocs(collection(db, "funcionarios"));
        if (querySnapshot.empty) {
            toast({ title: 'Aviso', description: 'Não há funcionários para excluir.' });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        toast({
            title: "Sucesso!",
            description: "Todos os funcionários foram excluídos com sucesso.",
        });
        await fetchEmployees();
    } catch (error) {
        console.error("Erro ao excluir todos os funcionários: ", error);
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Ocorreu um erro ao excluir todos os funcionários.",
        });
    } finally {
        setIsDeletingAll(false);
    }
};

  const handleAddNewClick = () => {
    form.reset({
      nome: '',
      cpf: '',
      cargo: '',
      telefone: '',
      email: '',
      status: 'ativo',
      tipo_contratacao: 'salario_fixo',
      salario: 0,
      dia_pagamento: 5,
      endereco_residencial: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
    });
    setEditingEmployee(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset(employee);
    setIsDialogOpen(true);
  }
  
  const handleClearFilters = () => {
    setStatusFilter('');
    setSearch('');
  }

  const generateRecommendationLetter = (employee: Employee) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // Cabeçalho da Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companyData?.slogan) {
        doc.text(companyData.slogan, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }
    
    const contactInfo = [
        companyData?.cnpj ? `CNPJ: ${companyData.cnpj}` : '',
        companyData?.crea ? `CREA: ${companyData.crea}` : '',
        companyData?.phone ? `Tel: ${companyData.phone}` : ''
    ].filter(Boolean).join(' | ');
    
    if (contactInfo) {
        doc.text(contactInfo, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
    }

    doc.setLineWidth(0.3);
    doc.line(20, currentY, pageWidth - 20, currentY);
    currentY += 20;

    // Título do Documento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CARTA DE RECOMENDAÇÃO', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // Corpo da Carta
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    const text = `A empresa ${companyData?.companyName || '[Nome da Empresa]'}, inscrita no CNPJ ${companyData?.cnpj || '[CNPJ]'}, vem por meio desta recomendar o(a) Sr(a). ${employee.nome}, portador(a) do CPF ${employee.cpf || '[CPF]'}, que exerceu o cargo de ${employee.cargo || '[Cargo]'} em nossa organização.\n\nDurante o período em que esteve conosco, demonstrou ser um profissional comprometido, ético e com ótimas habilidades técnicas, contribuindo positivamente para o crescimento de nossa equipe.\n\nSendo assim, recomendamos seus serviços para futuras oportunidades profissionais, certos de que desempenhará suas funções com a mesma excelência demonstrada aqui.\n\nFicamos à disposição para quaisquer esclarecimentos adicionais.`;

    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, currentY);
    
    currentY = (doc as any).lastAutoTable?.finalY || (currentY + 80);
    currentY += 40;

    // Local e Data
    const city = companyData?.address?.split(',').pop()?.trim() || 'Cidade';
    doc.text(`${city}, ${today}.`, 20, currentY);
    
    currentY += 30;
    doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
    doc.text(companyData?.companyName || 'Diretoria / Responsável', pageWidth / 2, currentY + 5, { align: 'center' });

    doc.save(`carta_recomendacao_${employee.nome.replace(/\s/g, '_')}.pdf`);
    toast({ title: "Sucesso!", description: "Carta de recomendação gerada." });
  };

  const filteredEmployees = employees
    .filter(employee => {
      const searchTermLower = search.toLowerCase();
      return (
        employee.nome.toLowerCase().includes(searchTermLower) ||
        (employee.cpf && employee.cpf.includes(searchTermLower))
      );
    })
    .filter(employee => {
        return statusFilter ? employee.status === statusFilter : true;
    });


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Funcionários"
        description="Gerencie os funcionários e colaboradores do seu escritório."
      />
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por Nome ou CPF..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={employees.length === 0} className="flex-1 md:flex-none">
                                <Trash className="mr-2 h-4 w-4" />
                                Excluir Tudo
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os {employees.length} funcionários.
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
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddNewClick} variant="accent" className="flex-1 md:flex-none">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Funcionário
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                        <DialogTitle className="font-headline">{editingEmployee ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do funcionário.
                        </DialogDescription>
                        </DialogHeader>
                        
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveEmployee)} className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium mb-4">Dados Pessoais</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="nome"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Nome *</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="cpf"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>CPF</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="cargo"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Cargo</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="telefone"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Telefone</FormLabel>
                                        <FormControl>
                                            <Input type="tel" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input type="email" {...field} />
                                        </FormControl>
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
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o status" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            <SelectItem value="ativo">Ativo</SelectItem>
                                            <SelectItem value="inativo">Inativo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-lg font-medium mb-4">Contratação e Remuneração</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="tipo_contratacao"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Tipo de Contratação *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            <SelectItem value="salario_fixo">Salário Fixo</SelectItem>
                                            <SelectItem value="salario_variavel">Salário Variável</SelectItem>
                                            <SelectItem value="comissao">Comissão</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    {tipoContratacao === 'salario_fixo' && (
                                        <>
                                        <FormField
                                        control={form.control}
                                        name="salario"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Salário (R$) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="dia_pagamento"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Dia do Pagamento *</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="1" max="31" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        </>
                                    )}
                                    {tipoContratacao === 'comissao' && (
                                        <FormField
                                        control={form.control}
                                        name="taxa_comissao"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Taxa de Comissão (%) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-lg font-medium mb-4">Endereço Residencial</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="endereco_residencial.street"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Rua</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_residencial.number"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Número</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_residencial.neighborhood"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                        <FormLabel>Bairro</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="endereco_residencial.city"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <Select onValueChange={(value) => {
                                                const selectedCity = cities.find(c => c.nome_cidade === value);
                                                field.onChange(value);
                                                form.setValue('endereco_residencial.state', selectedCity?.estado || '');
                                            }} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione a Cidade" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                {cities.map(city => (<SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_residencial.state"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Estado</FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_residencial.zip"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>CEP</FormLabel>
                                        <FormControl>
                                            <Input 
                                            {...field}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                field.onChange(formatCEP(value));
                                            }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading} variant="accent">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingEmployee ? 'Salvar Alterações' : 'Salvar Funcionário'}
                            </Button>
                            </DialogFooter>
                        </form>
                        </Form>
                    </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrar status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
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
            <div className="border rounded-lg">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Contratação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
                        <EmployeeTableRow 
                            key={employee.id} 
                            employee={employee} 
                            cities={cities}
                            onEdit={handleEditClick} 
                            onDelete={handleDeleteEmployee} 
                            onGenerateLetter={generateRecommendationLetter}
                        />
                    )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                        Nenhum funcionário encontrado.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
