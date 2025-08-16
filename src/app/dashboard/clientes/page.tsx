
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
import { Label } from '@/components/ui/label';
import type { Client, City } from '@/lib/types';
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
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCPF_CNPJ, formatTelefone, formatCEP } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/app/dashboard/layout';

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

const clientSchema = z.object({
  nome_completo: z.string().min(1, { message: 'Nome completo é obrigatório.' }),
  rg: z.string().optional(),
  cpf_cnpj: z.string().optional().refine(val => !val || val.length === 14 || val.length === 18, {
    message: 'CPF/CNPJ inválido.',
  }),
  telefone: z.string().optional().refine(val => !val || val.length >= 14, {
    message: 'Telefone inválido.',
  }),
  endereco_residencial: addressSchema.optional(),
  endereco_obra: addressSchema.optional(),
  coordenadas: z.object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
  }).optional(),
});

const citySchema = z.object({
  nome_cidade: z.string().min(1, { message: 'Nome da cidade é obrigatório.' }),
  estado: z.string().min(2, { message: 'Estado é obrigatório (UF com 2 letras).' }).max(2),
});

function AddCityDialog({ isOpen, setIsOpen, onCityAdded }: {
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void,
  onCityAdded: () => Promise<void>
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof citySchema>>({
    resolver: zodResolver(citySchema),
    defaultValues: { nome_cidade: '', estado: '' },
  });

  const handleSaveCity = async (values: z.infer<typeof citySchema>) => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'cidades'), values);
      toast({ title: 'Sucesso!', description: 'Cidade adicionada com sucesso.' });
      form.reset();
      setIsOpen(false);
      await onCityAdded();
    } catch (error) {
      console.error("Erro ao salvar cidade: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar a cidade.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Cidade</DialogTitle>
          <DialogDescription>Preencha os dados da nova cidade.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveCity)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_cidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Cidade *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado (UF) *</FormLabel>
                  <FormControl><Input {...field} maxLength={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Cidade
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function ClientTableRow({ client, onEdit, onDelete }: { client: Client, onEdit: (client: Client) => void, onDelete: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const residencial = client.endereco_residencial;
  const obra = client.endereco_obra;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Collapsible asChild>
      <>
        <TableRow>
          <TableCell>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="sr-only">{isOpen ? 'Fechar' : 'Abrir'}</span>
              </Button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="font-medium">{client.nome_completo}</TableCell>
          <TableCell>{client.cpf_cnpj}</TableCell>
          <TableCell>{client.telefone}</TableCell>
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
                  <DropdownMenuItem onClick={() => onEdit(client)}>
                  Editar
                  </DropdownMenuItem>
                  <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600" disabled={!isAdmin}>
                          Excluir
                      </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                          Essa ação não pode ser desfeita. Isso excluirá permanentemente o cliente.
                      </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(client.codigo_cliente)} variant="destructive">
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
                <TableCell colSpan={5} className="p-0">
                    <div className="p-6 bg-muted/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                         <div>
                          <h4 className="font-semibold mb-2">Endereço da Obra e Coordenadas</h4>
                          {obra ? (
                             <div className="text-sm space-y-1">
                              <p>{obra.street}, {obra.number}</p>
                              <p>{obra.neighborhood}, {obra.city} - {obra.state}</p>
                              <p>CEP: {obra.zip}</p>
                              <p className="pt-2"><span className="font-medium text-muted-foreground">Lat:</span> {client.coordenadas?.lat || 'N/A'}, <span className="font-medium text-muted-foreground">Lng:</span> {client.coordenadas?.lng || 'N/A'}</p>
                            </div>
                          ) : <p className="text-sm text-muted-foreground">N/A</p>}
                        </div>
                      </div>
                    </div>
                </TableCell>
            </TableRow>
        </CollapsibleContent>
         <TableRow className="border-b">
            <TableCell colSpan={5} className="p-0 h-0"></TableCell>
        </TableRow>
      </>
    </Collapsible>
  );
}


export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nome_completo: '',
      rg: '',
      cpf_cnpj: '',
      telefone: '',
      endereco_residencial: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
      endereco_obra: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
      coordenadas: { lat: 0, lng: 0 },
    },
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
      toast({
        variant: "destructive",
        title: "Erro ao buscar cidades",
        description: "Não foi possível carregar a lista de cidades.",
      });
    }
  };

  const fetchClients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const clientsData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        codigo_cliente: doc.id,
      })) as Client[];
      clientsData.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      setClients(clientsData);
    } catch (error) {
      console.error("Erro ao buscar clientes: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de clientes.",
      });
    }
  };

  useEffect(() => {
    fetchClients();
    fetchCities();
  }, []);

  const handleSaveClient = async (values: z.infer<typeof clientSchema>) => {
    setIsLoading(true);
    try {
      const clientData = {
        ...values,
        coordenadas: {
          lat: values.coordenadas?.lat || 0,
          lng: values.coordenadas?.lng || 0,
        },
        numero_art: editingClient?.numero_art || '',
        historico_servicos: editingClient?.historico_servicos || [],
        endereco_residencial: {
            street: values.endereco_residencial?.street || '',
            number: values.endereco_residencial?.number || '',
            neighborhood: values.endereco_residencial?.neighborhood || '',
            city: values.endereco_residencial?.city || '',
            state: values.endereco_residencial?.state || '',
            zip: values.endereco_residencial?.zip || '',
        },
         endereco_obra: {
            street: values.endereco_obra?.street || '',
            number: values.endereco_obra?.number || '',
            neighborhood: values.endereco_obra?.neighborhood || '',
            city: values.endereco_obra?.city || '',
            state: values.endereco_obra?.state || '',
            zip: values.endereco_obra?.zip || '',
        }
      };

      if (editingClient) {
        const clientDocRef = doc(db, 'clientes', editingClient.codigo_cliente);
        await setDoc(clientDocRef, clientData);
        toast({
          title: "Sucesso!",
          description: "Cliente atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, 'clientes'), clientData);
         toast({
          title: "Sucesso!",
          description: "Cliente adicionado com sucesso.",
        });
      }
      
      form.reset();
      setEditingClient(null);
      setIsDialogOpen(false);
      await fetchClients();

    } catch (error) {
      console.error("Erro ao salvar cliente: ", error);
       toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o cliente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteDoc(doc(db, "clientes", clientId));
      toast({
        title: "Sucesso!",
        description: "Cliente excluído com sucesso.",
      });
      await fetchClients();
    } catch (error) {
      console.error("Erro ao excluir cliente: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao excluir o cliente.",
      });
    }
  };
  
  const handleDeleteAllClients = async () => {
    setIsDeletingAll(true);
    try {
        const querySnapshot = await getDocs(collection(db, "clientes"));
        if (querySnapshot.empty) {
            toast({ title: 'Aviso', description: 'Não há clientes para excluir.' });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        toast({
            title: "Sucesso!",
            description: "Todos os clientes foram excluídos com sucesso.",
        });
        await fetchClients(); // Refresh the list
    } catch (error) {
        console.error("Erro ao excluir todos os clientes: ", error);
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Ocorreu um erro ao excluir todos os clientes.",
        });
    } finally {
        setIsDeletingAll(false);
    }
};


  const handleAddNewClick = () => {
    form.reset();
    setEditingClient(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    form.reset(client);
    setIsDialogOpen(true);
  }

  const filteredClients = clients.filter(
    (client) =>
      client.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
      (client.cpf_cnpj && client.cpf_cnpj.includes(search))
  );

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold font-headline text-primary">Clientes</h1>
            <p className="text-muted-foreground">
            Gerencie os clientes do seu escritório.
            </p>
        </div>

        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Buscar por nome ou CPF/CNPJ..."
                          className="pl-10"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={clients.length === 0 || !isAdmin}>
                              <Trash className="mr-2 h-4 w-4" />
                              Excluir Tudo
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os {clients.length} clientes.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAllClients} disabled={isDeletingAll}>
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
                        Adicionar Cliente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                        <DialogTitle className="font-headline">{editingClient ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do cliente. Campos marcados com * são obrigatórios.
                        </DialogDescription>
                        </DialogHeader>
                        
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveClient)} className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium mb-4">Dados Pessoais</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="nome_completo"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Nome Completo *</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="rg"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>RG</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="cpf_cnpj"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>CPF/CNPJ</FormLabel>
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
                                            <div className="flex items-center gap-2">
                                            <Select onValueChange={(value) => {
                                                const selectedCity = cities.find(c => c.nome_cidade === value);
                                                field.onChange(value);
                                                form.setValue('endereco_residencial.state', selectedCity?.estado || '');
                                            }} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione a Cidade" /></SelectTrigger></FormControl>
                                                <SelectContent><>
                                                {cities.map(city => (<SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>))}
                                                </></SelectContent>
                                            </Select>
                                            <Button type="button" variant="outline" size="icon" onClick={() => setIsCityDialogOpen(true)}><PlusCircle className="h-4 w-4" /></Button>
                                            </div>
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

                            <Separator />

                            <div>
                                <h3 className="text-lg font-medium mb-4">Endereço da Obra e Coordenadas</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.street"
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
                                    name="endereco_obra.number"
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
                                    name="endereco_obra.neighborhood"
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
                                        name="endereco_obra.city"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <div className="flex items-center gap-2">
                                            <Select onValueChange={(value) => {
                                                const selectedCity = cities.find(c => c.nome_cidade === value);
                                                field.onChange(value);
                                                form.setValue('endereco_obra.state', selectedCity?.estado || '');
                                            }} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione a Cidade" /></SelectTrigger></FormControl>
                                                <SelectContent><>
                                                {cities.map(city => (<SelectItem key={city.id} value={city.nome_cidade}>{city.nome_cidade}</SelectItem>))}
                                                </></SelectContent>
                                            </Select>
                                            <Button type="button" variant="outline" size="icon" onClick={() => setIsCityDialogOpen(true)}><PlusCircle className="h-4 w-4" /></Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="endereco_obra.state"
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
                                    name="endereco_obra.zip"
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
                                    <FormField
                                    control={form.control}
                                    name="coordenadas.lat"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Latitude</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="coordenadas.lng"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Longitude</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" variant="accent" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingClient ? 'Salvar Alterações' : 'Salvar Cliente'}
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
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF/CNPJ</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.length > 0 ? filteredClients.map((client) => (
                           <ClientTableRow key={client.codigo_cliente} client={client} onEdit={handleEditClick} onDelete={handleDeleteClient} />
                        )) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                            Nenhum cliente encontrado.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
      </Card>
      <AddCityDialog isOpen={isCityDialogOpen} setIsOpen={setIsCityDialogOpen} onCityAdded={fetchCities} />
    </div>
  );
}
