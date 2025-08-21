
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Trash2 } from 'lucide-react';
import type { AuthorizedUser } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const authUserSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
});

export default function SettingsPage() {
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof authUserSchema>>({
    resolver: zodResolver(authUserSchema),
    defaultValues: {
      email: '',
    },
  });

  const fetchAuthorizedUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "authorized_users"));
      const usersData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as AuthorizedUser[];
      setAuthorizedUsers(usersData);
    } catch (error) {
      console.error("Erro ao buscar usuários autorizados: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorizedUsers();
  }, []);

  const handleAddUser = async (values: z.infer<typeof authUserSchema>) => {
    setIsSubmitting(true);
    try {
      const q = query(collection(db, "authorized_users"), where("email", "==", values.email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast({
            variant: "destructive",
            title: "Email já existe",
            description: "Este email já está na lista de autorizados.",
        });
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'authorized_users'), { email: values.email, role: 'user' });
      toast({ title: 'Sucesso!', description: 'Usuário autorizado com sucesso.' });
      form.reset();
      await fetchAuthorizedUsers();
    } catch (error) {
      console.error("Erro ao adicionar usuário: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao autorizar o usuário.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, "authorized_users", userId));
      toast({
        title: "Sucesso!",
        description: "Usuário removido da lista de autorização.",
      });
      await fetchAuthorizedUsers();
    } catch (error) {
      console.error("Erro ao remover autorização: ", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao remover a autorização do usuário.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações gerais e de segurança do seu aplicativo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Autorização de Usuários</CardTitle>
          <CardDescription>
            Adicione ou remova e-mails que podem se cadastrar e acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddUser)} className="flex items-start gap-4 mb-8">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="sr-only">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" variant="accent" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Autorizar
              </Button>
            </form>
          </Form>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email Autorizado</TableHead>
                  <TableHead className="w-[100px] text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : authorizedUsers.length > 0 ? (
                  authorizedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-right">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Remover autorização?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta ação removerá a permissão para o usuário <strong>{user.email}</strong> acessar o sistema. O usuário existente não será removido, mas não poderá mais logar.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} variant="destructive">
                                        Remover
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                      Nenhum usuário autorizado encontrado.
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
