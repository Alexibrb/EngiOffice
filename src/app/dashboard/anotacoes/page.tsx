
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/page-header';
import { useToast } from "@/hooks/use-toast"
import { Loader2, Pin, Trash2, XCircle, ChevronsUpDown, Plus } from 'lucide-react';
import type { Client, Service, Note } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

const noteSchema = z.object({
  clientId: z.string().optional(),
  serviceId: z.string().optional(),
  content: z.string().min(1, 'O conteúdo da anotação não pode estar vazio.'),
});

const postItColors = [
    'bg-yellow-200 dark:bg-yellow-800/40 border-yellow-300 dark:border-yellow-700/60',
    'bg-green-200 dark:bg-green-800/40 border-green-300 dark:border-green-700/60',
    'bg-blue-200 dark:bg-blue-800/40 border-blue-300 dark:border-blue-700/60',
    'bg-pink-200 dark:bg-pink-800/40 border-pink-300 dark:border-pink-700/60',
    'bg-purple-200 dark:bg-purple-800/40 border-purple-300 dark:border-purple-700/60',
];


export default function AnotacoesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      clientId: '',
      serviceId: '',
      content: '',
    },
  });

  const selectedClientId = form.watch('clientId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsSnapshot, servicesSnapshot, notesSnapshot] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "servicos")),
          getDocs(query(collection(db, "anotacoes"), orderBy("createdAt", "desc"))),
        ]);

        const clientsData = clientsSnapshot.docs.map(doc => ({ ...doc.data(), codigo_cliente: doc.id })) as Client[];
        setClients(clientsData.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)));
        
        const servicesData = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Service[];
        setServices(servicesData.sort((a,b) => a.descricao.localeCompare(b.descricao)));

        const notesData = notesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: doc.data().createdAt.toDate() })) as Note[];
        setNotes(notesData);

      } catch (error) {
        console.error("Erro ao buscar dados: ", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
      }
    };
    fetchData();
  }, [toast]);
  
  useEffect(() => {
    if (selectedClientId && selectedClientId !== 'none') {
        const relatedServices = services.filter(s => s.cliente_id === selectedClientId);
        setFilteredServices(relatedServices);
        // Reset serviceId if the selected client doesn't have the previously selected service
        const currentServiceId = form.getValues('serviceId');
        if (currentServiceId && !relatedServices.some(s => s.id === currentServiceId)) {
            form.setValue('serviceId', '');
        }
    } else {
        setFilteredServices(services); // Show all services if no client is selected
    }
  }, [selectedClientId, services, form]);

  const handleSaveNote = async (values: z.infer<typeof noteSchema>) => {
    setIsLoading(true);
    try {
      const dataToSave = {
        ...values,
        clientId: values.clientId === 'none' ? '' : values.clientId,
        serviceId: values.serviceId === 'none' ? '' : values.serviceId,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'anotacoes'), dataToSave);
      toast({ title: 'Sucesso!', description: 'Anotação salva com sucesso.' });
      form.reset();
      
      const notesSnapshot = await getDocs(query(collection(db, "anotacoes"), orderBy("createdAt", "desc")));
      const notesData = notesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: doc.data().createdAt.toDate() })) as Note[];
      setNotes(notesData);

    } catch (error) {
      console.error("Erro ao salvar anotação: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar a anotação.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'anotacoes', id));
      setNotes(notes.filter(note => note.id !== id));
      toast({ title: 'Sucesso!', description: 'Anotação excluída.' });
    } catch(error) {
       console.error("Erro ao excluir anotação: ", error);
       toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir a anotação.' });
    }
  };
  
  const getClientName = (id: string) => clients.find(c => c.codigo_cliente === id)?.nome_completo || 'Cliente não encontrado';
  const getServiceAddress = (id: string) => {
    const service = services.find(s => s.id === id);
    if (!service?.endereco_obra) return 'Serviço sem endereço';
    const { street, number, city } = service.endereco_obra;
    if (!street) return 'Endereço da obra não preenchido';
    return `${street}, ${number} - ${city}`;
  };


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Anotações"
        description="Registre observações importantes sobre seus clientes e serviços."
      />

      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <CollapsibleContent>
            <Card className="mb-6">
                <CardHeader>
                <CardTitle>Nova Anotação</CardTitle>
                <CardDescription>
                    Selecione um cliente e/ou serviço para vincular a anotação, ou deixe em branco para uma nota geral.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveNote)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Cliente (Opcional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um cliente" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {clients.map(client => (
                                    <SelectItem key={client.codigo_cliente} value={client.codigo_cliente}>
                                    {client.nome_completo}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="serviceId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Serviço (Opcional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={filteredServices.length === 0 && !!selectedClientId && selectedClientId !== 'none'}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={selectedClientId && selectedClientId !== 'none' ? "Selecione um serviço do cliente" : "Selecione um serviço"} />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {filteredServices.map(service => (
                                    <SelectItem key={service.id} value={service.id}>
                                    {service.descricao} ({getServiceAddress(service.id)})
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Anotação</FormLabel>
                            <FormControl>
                            <Textarea placeholder="Digite sua anotação aqui..." rows={5} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="submit" variant="accent" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Anotação
                    </Button>
                    </form>
                </Form>
                </CardContent>
            </Card>
        </CollapsibleContent>
      
        <div className="mt-2">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold font-headline tracking-tight">Anotações Salvas</h2>
                 <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                        <ChevronsUpDown className="h-4 w-4 mr-2" />
                        {isFormOpen ? 'Fechar Formulário' : 'Adicionar Anotação'}
                    </Button>
                </CollapsibleTrigger>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {notes.length > 0 ? (
                    notes.map((note, index) => (
                        <Card key={note.id} className={cn(
                            "shadow-lg transform rotate-[-2deg] hover:rotate-0 hover:scale-105 transition-transform duration-200 ease-in-out h-72 flex flex-col",
                            postItColors[index % postItColors.length]
                        )}>
                        <CardHeader className="flex-row items-center justify-between pb-2">
                            <div className="flex items-center gap-2">
                            <Pin className="h-5 w-5 text-slate-600 dark:text-yellow-500" />
                            <CardTitle className="text-sm font-bold text-slate-700 dark:text-yellow-400">
                                {note.clientId ? getClientName(note.clientId) : 'Anotação Geral'}
                            </CardTitle>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-black/10 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir esta anotação?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Essa ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                           <ScrollArea className="h-full pr-4">
                                <p className="text-slate-800 dark:text-yellow-200/90 whitespace-pre-wrap font-serif">
                                    {note.content}
                                </p>
                           </ScrollArea>
                        </CardContent>
                        <CardFooter className="flex-col items-start text-xs text-slate-600 dark:text-yellow-600 pt-4 mt-auto">
                            {note.serviceId && (
                            <p className="font-semibold mb-1">Obra: {getServiceAddress(note.serviceId)}</p>
                            )}
                            <p>{format(note.createdAt, "d 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        <p>Nenhuma anotação encontrada.</p>
                    </div>
                )}
            </div>
        </div>
      </Collapsible>
    </div>
  );
}
