
'use client';

import { useState, useEffect } from 'react';
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
import type { Client, Address } from '@/lib/types';
import { PlusCircle, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"
import { Separator } from '@/components/ui/separator';


export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [resStreet, setResStreet] = useState('');
  const [resNumber, setResNumber] = useState('');
  const [resNeighborhood, setResNeighborhood] = useState('');
  const [workStreet, setWorkStreet] = useState('');
  const [workNumber, setWorkNumber] = useState('');
  const [workNeighborhood, setWorkNeighborhood] = useState('');
  const [workLat, setWorkLat] = useState('');
  const [workLng, setWorkLng] = useState('');


  const fetchClients = async () => {
    const querySnapshot = await getDocs(collection(db, "clientes"));
    const clientsData = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      codigo_cliente: doc.id,
    })) as Client[];
    setClients(clientsData);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const residentialAddress: Address = {
        street: resStreet,
        number: resNumber,
        neighborhood: resNeighborhood,
        city: '',
        state: '',
        zip: '',
      };

      const workAddress: Address = {
        street: workStreet,
        number: workNumber,
        neighborhood: workNeighborhood,
        city: '',
        state: '',
        zip: '',
      };

      await addDoc(collection(db, 'clientes'), {
        nome_completo: nomeCompleto,
        cpf_cnpj: cpfCnpj,
        telefone: telefone,
        endereco_residencial: residentialAddress,
        endereco_obra: workAddress,
        coordenadas: { lat: parseFloat(workLat) || 0, lng: parseFloat(workLng) || 0 },
        rg: '',
        numero_art: '',
        historico_servicos: [],
      });
      
      toast({
        title: "Sucesso!",
        description: "Cliente adicionado com sucesso.",
      })
      
      // Reset form and close dialog
      setNomeCompleto('');
      setCpfCnpj('');
      setTelefone('');
      setResStreet('');
      setResNumber('');
      setResNeighborhood('');
      setWorkStreet('');
      setWorkNumber('');
      setWorkNeighborhood('');
      setWorkLat('');
      setWorkLng('');
      setIsDialogOpen(false);

      // Refetch clients to update the list
      fetchClients();

    } catch (error) {
      console.error("Erro ao adicionar cliente: ", error);
       toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o cliente.",
      })
    }
  };


  const filteredClients = clients.filter(
    (client) =>
      client.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
      (client.cpf_cnpj && client.cpf_cnpj.includes(search))
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Clientes</h1>
        <p className="text-muted-foreground">
          Gerencie os clientes do seu escritório.
        </p>
      </div>

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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
           <form onSubmit={handleSaveClient}>
            <DialogHeader>
              <DialogTitle className="font-headline">Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo cliente. Campos marcados com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 flex flex-col gap-6">
                <div>
                    <h3 className="text-lg font-medium mb-4">Dados Pessoais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome Completo *</Label>
                            <Input id="name" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                            <Input id="cpfCnpj" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <h3 className="text-lg font-medium mb-4">Endereço Residencial</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="res-street">Rua</Label>
                            <Input id="res-street" value={resStreet} onChange={(e) => setResStreet(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="res-number">Número</Label>
                            <Input id="res-number" value={resNumber} onChange={(e) => setResNumber(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="res-neighborhood">Bairro</Label>
                            <Input id="res-neighborhood" value={resNeighborhood} onChange={(e) => setResNeighborhood(e.target.value)} />
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <h3 className="text-lg font-medium mb-4">Endereço da Obra e Coordenadas</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="work-street">Rua</Label>
                            <Input id="work-street" value={workStreet} onChange={(e) => setWorkStreet(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="work-number">Número</Label>
                            <Input id="work-number" value={workNumber} onChange={(e) => setWorkNumber(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="work-neighborhood">Bairro</Label>
                            <Input id="work-neighborhood" value={workNeighborhood} onChange={(e) => setWorkNeighborhood(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="work-lat">Latitude</Label>
                            <Input id="work-lat" type="number" step="any" value={workLat} onChange={(e) => setWorkLat(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="work-lng">Longitude</Label>
                            <Input id="work-lng" type="number" step="any" value={workLng} onChange={(e) => setWorkLng(e.target.value)} />
                        </div>
                    </div>
                </div>

            </div>

            <DialogFooter>
               <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
               <Button type="submit" variant="accent">Salvar Cliente</Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client) => (
              <TableRow key={client.codigo_cliente}>
                <TableCell className="font-medium">{client.nome_completo}</TableCell>
                <TableCell>{client.cpf_cnpj}</TableCell>
                <TableCell>{client.telefone}</TableCell>
                <TableCell>{client.endereco_residencial?.city}</TableCell>
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
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
