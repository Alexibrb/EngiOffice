
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';
import { useSidebar } from './ui/sidebar';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import type { AuthorizedUser } from '@/lib/types';

const companySchema = z.object({
  logoUrl: z.string().url({ message: "Por favor, insira uma URL válida para o logo." }).optional().or(z.literal('')),
  companyName: z.string().min(1, { message: "Nome da empresa é obrigatório." }),
  slogan: z.string().optional(),
  cnpj: z.string().optional(),
  crea: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const profileSchema = z.object({
  displayName: z.string().min(1, "Nome é obrigatório."),
  photoURL: z.string().url("Por favor, insira uma URL válida para a foto.").optional().or(z.literal('')),
});


function CompanyDataDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      logoUrl: '',
      companyName: '',
      slogan: '',
      cnpj: '',
      crea: '',
      address: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      const fetchCompanyData = async () => {
        const companyDocRef = doc(db, 'empresa', 'dados');
        const docSnap = await getDoc(companyDocRef);
        if (docSnap.exists()) {
          form.reset(docSnap.data() as z.infer<typeof companySchema>);
        }
      };
      fetchCompanyData();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: z.infer<typeof companySchema>) => {
    setIsLoading(true);
    try {
      const companyDocRef = doc(db, 'empresa', 'dados');
      await setDoc(companyDocRef, values, { merge: true });
      toast({
        title: "Sucesso!",
        description: "Dados da empresa atualizados.",
      });
      onOpenChange(false);
      // Optional: force-reload to reflect changes immediately.
      window.location.reload();
    } catch (error) {
      console.error("Erro ao salvar dados da empresa:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar os dados da empresa.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dados da Empresa</DialogTitle>
          <DialogDescription>
            Gerencie as informações da sua empresa que aparecerão em relatórios e documentos.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="slogan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slogan</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>URL do Logo</FormLabel>
                    <FormControl><Input placeholder="https://exemplo.com/logo.png" {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="crea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CREA</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input type="tel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDataDialog({ user, isOpen, onOpenChange }: { user: User | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      photoURL: user?.photoURL || '',
    },
  });
  
  useEffect(() => {
    if(user){
      form.reset({
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
      })
    }
  }, [user, form])

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }
    setIsLoading(true);
    try {
      await updateProfile(user, {
        displayName: values.displayName,
        photoURL: values.photoURL,
      });

      toast({
        title: "Sucesso!",
        description: "Seu perfil foi atualizado.",
      });
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar seu perfil.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>
            Atualize suas informações de perfil.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photoURL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Foto do Perfil</FormLabel>
                  <FormControl><Input placeholder="https://exemplo.com/sua-foto.jpg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCompanyDataOpen, setIsCompanyDataOpen] = useState(false);
  const [isProfileDataOpen, setIsProfileDataOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { state: sidebarState } = useSidebar();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.email === 'alexandro.ibrb@gmail.com') {
          setIsAdmin(true);
        } else {
          const q = query(collection(db, "authorized_users"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as AuthorizedUser;
            setIsAdmin(userData.role === 'admin');
          } else {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };
  
  const handleChangePassword = async () => {
    if (user?.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível enviar o e-mail de redefinição de senha.",
        });
      }
    }
  };

  if (!user) {
    return null;
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn("w-full justify-start items-center gap-2 p-2", sidebarState === 'collapsed' && 'h-10 w-10 p-0 justify-center')}>
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.photoURL || `https://placehold.co/40x40.png`}
                alt={user.displayName || 'User Avatar'}
                data-ai-hint="user avatar"
              />
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div className={cn("flex flex-col items-start truncate", sidebarState === 'collapsed' && 'hidden')}>
               <span className="font-medium text-sm truncate">{user.displayName || 'Usuário'}</span>
               <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName || 'Usuário'}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
             <DropdownMenuItem onSelect={() => setIsProfileDataOpen(true)}>
              Meu Perfil
            </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => setIsCompanyDataOpen(true)}>
              Dados da Empresa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleChangePassword}>
              Trocar Senha
            </DropdownMenuItem>
            {isAdmin && (
                <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
                Configurações
                </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CompanyDataDialog isOpen={isCompanyDataOpen} onOpenChange={setIsCompanyDataOpen} />
      <ProfileDataDialog user={user} isOpen={isProfileDataOpen} onOpenChange={setIsProfileDataOpen} />
    </>
  );
}
