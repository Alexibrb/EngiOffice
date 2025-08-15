
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
import type { Employee } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
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

const employeeSchema = z.object({
  nome: z.string().min(1, { message: 'Nome é obrigatório.' }),
  cpf: z.string().optional(),
  cargo: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  status: z.enum(['ativo', 'inativo']),
  tipo_contratacao: z.enum(['salario_fixo', 'comissao'], { required_error: 'Tipo de contratação é obrigatório.'}),
  salario: z.coerce.number().optional(),
}).refine(data => {
    if (data.tipo_contratacao === 'salario_fixo') {
        return data.salario !== undefined && data.salario > 0;
    }
    return true;
}, {
    message: 'Salário é obrigatório para contratação de tipo salário fixo.',
    path: ['salario'],
});


export default function FuncionariosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
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
      tipo_contratacao: 'comissao',
    },
  });
  
  const tipoContratacao = useWatch({
      control: form.control,
      name: 'tipo_contratacao',
  });

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
  }, []);

  const handleSaveEmployee = async (values: z.infer<typeof employeeSchema>) => {
    setIsLoading(true);
    try {
      const employeeData = {
          ...values,
          salario: values.tipo_contratacao === 'salario_fixo' ? values.salario : 0,
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

  const handleAddNewClick = () => {
    form.reset({
      nome: '',
      cpf: '',
      cargo: '',
      telefone: '',
      email: '',
      status: 'ativo',
      tipo_contratacao: 'comissao',
      salario: 0,
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
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Funcionários</h1>
        <p className="text-muted-foreground">
          Gerencie os funcionários e colaboradores do seu escritório.
        </p>
      </div>
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por Nome ou CPF..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick} variant="accent">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Funcionário
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                    <DialogTitle className="font-headline">{editingEmployee ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}</DialogTitle>
                    <DialogDescription>
                        Preencha os dados do funcionário.
                    </DialogDescription>
                    </DialogHeader>
                    
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveEmployee)} className="space-y-6">
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
                                    <SelectItem value="comissao">Comissão</SelectItem>
                                    <SelectItem value="salario_fixo">Salário Fixo</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                           {tipoContratacao === 'salario_fixo' && (
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
                            )}
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Contratação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.nome}</TableCell>
                        <TableCell>{employee.cargo}</TableCell>
                        <TableCell>{employee.tipo_contratacao === 'salario_fixo' ? 'Salário Fixo' : 'Comissão'}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEditClick(employee)}>
                                Editar
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
                                    <AlertDialogAction onClick={() => handleDeleteEmployee(employee.id)} variant="destructive">
                                        Excluir
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    )) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
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
