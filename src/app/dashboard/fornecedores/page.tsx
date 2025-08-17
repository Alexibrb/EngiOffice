
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
import { Textarea } from '@/components/ui/textarea';
import type { Supplier } from '@/lib/types';
import { PlusCircle, Search, MoreHorizontal, Loader2, Trash, ChevronDown, ChevronRight } from 'lucide-react';
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
import { formatCPF_CNPJ, formatTelefone } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


const supplierSchema = z.object({
  razao_social: z.string().min(1, { message: 'Razão Social é obrigatória.' }),
  cnpj: z.string().optional().refine(val => !val || val.length === 18, {
    message: 'CNPJ inválido.',
  }),
  telefone: z.string().optional().refine(val => !val || val.length >= 14, {
    message: 'Telefone inválido.',
  }),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  endereco: z.string().optional(),
  produtos_servicos: z.string().optional(),
});

function SupplierTableRow({ supplier, onEdit, onDelete }: { supplier: Supplier, onEdit: (supplier: Supplier) => void, onDelete: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible asChild>
      <>
        <TableRow>
          <TableCell>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="sr-only">{isOpen ? 'Fechar' : 'Abrir'}</span>
              </Button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="font-medium">{supplier.razao_social}</TableCell>
          <TableCell>{supplier.cnpj}</TableCell>
          <TableCell>{supplier.telefone}</TableCell>
          <TableCell>{supplier.email}</TableCell>
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
                <DropdownMenuItem onClick={() => onEdit(supplier)}>
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
                        Essa ação não pode ser desfeita. Isso excluirá permanentemente o fornecedor.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(supplier.id)} variant="destructive">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow>
            <TableCell colSpan={6} className="p-0">
              <div className="p-6 bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Endereço</h4>
                    <p className="text-sm">{supplier.endereco || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Produtos/Serviços</h4>
                    {supplier.produtos_servicos && supplier.produtos_servicos.length > 0 ? (
                      <ul className="list-disc list-inside text-sm space-y-1">
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
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}


export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      razao_social: '',
      cnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      produtos_servicos: '',
    },
  });

  const fetchSuppliers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "fornecedores"));
      const suppliersData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Supplier[];
      suppliersData.sort((a, b) => a.razao_social.localeCompare(b.razao_social));
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Erro ao buscar fornecedores: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de fornecedores.",
      });
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSaveSupplier = async (values: z.infer<typeof supplierSchema>) => {
    setIsLoading(true);
    try {
      const supplierData = {
        ...values,
        produtos_servicos: values.produtos_servicos?.split('\n').filter(p => p.trim() !== '') || [],
      };

      if (editingSupplier) {
        const supplierDocRef = doc(db, 'fornecedores', editingSupplier.id);
        await setDoc(supplierDocRef, supplierData);
        toast({
          title: "Sucesso!",
          description: "Fornecedor atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, 'fornecedores'), supplierData);
         toast({
          title: "Sucesso!",
          description: "Fornecedor adicionado com sucesso.",
        });
      }
      
      form.reset();
      setEditingSupplier(null);
      setIsDialogOpen(false);
      await fetchSuppliers();

    } catch (error) {
      console.error("Erro ao salvar fornecedor: ", error);
       toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o fornecedor.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      await deleteDoc(doc(db, "fornecedores", supplierId));
      toast({
        title: "Sucesso!",
        description: "Fornecedor excluído com sucesso.",
      });
      await fetchSuppliers();
    } catch (error) {
      console.error("Erro ao excluir fornecedor: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao excluir o fornecedor.",
      });
    }
  };
  
  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
        const querySnapshot = await getDocs(collection(db, "fornecedores"));
        if (querySnapshot.empty) {
            toast({ title: 'Aviso', description: 'Não há fornecedores para excluir.' });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        toast({
            title: "Sucesso!",
            description: "Todos os fornecedores foram excluídos com sucesso.",
        });
        await fetchSuppliers();
    } catch (error) {
        console.error("Erro ao excluir todos os fornecedores: ", error);
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Ocorreu um erro ao excluir todos os fornecedores.",
        });
    } finally {
        setIsDeletingAll(false);
    }
};

  const handleAddNewClick = () => {
    form.reset();
    setEditingSupplier(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.reset({
        ...supplier,
        produtos_servicos: supplier.produtos_servicos.join('\n')
    });
    setIsDialogOpen(true);
  }

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.razao_social.toLowerCase().includes(search.toLowerCase()) ||
      (supplier.cnpj && supplier.cnpj.includes(search))
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Fornecedores</h1>
        <p className="text-muted-foreground">
          Gerencie os fornecedores do seu escritório.
        </p>
      </div>

       <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por Razão Social ou CNPJ..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={suppliers.length === 0}>
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir Tudo
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os {suppliers.length} fornecedores.
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
                        <Button onClick={handleAddNewClick} variant="accent">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Fornecedor
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                        <DialogTitle className="font-headline">{editingSupplier ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do fornecedor. Campos marcados com * são obrigatórios.
                        </DialogDescription>
                        </DialogHeader>
                        
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveSupplier)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                control={form.control}
                                name="razao_social"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Razão Social *</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="cnpj"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>CNPJ</FormLabel>
                                    <FormControl>
                                        <Input 
                                            {...field}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                field.onChange(formatCPF_CNPJ(value));
                                            }}
                                        />
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
                                        <Input 
                                            type="tel" 
                                            {...field}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                field.onChange(formatTelefone(value));
                                            }}
                                        />
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
                                name="endereco"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                    <FormLabel>Endereço</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="produtos_servicos"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                    <FormLabel>Produtos/Serviços (um por linha)</FormLabel>
                                    <FormControl>
                                        <Textarea rows={4} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            </div>
                            <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading} variant="accent">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingSupplier ? 'Salvar Alterações' : 'Salvar Fornecedor'}
                            </Button>
                            </DialogFooter>
                        </form>
                        </Form>
                    </DialogContent>
                    </Dialog>
                </div>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
                        <SupplierTableRow key={supplier.id} supplier={supplier} onEdit={handleEditClick} onDelete={handleDeleteSupplier} />
                    )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                        Nenhum fornecedor encontrado.
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
