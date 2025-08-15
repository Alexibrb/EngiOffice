
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
import type { Client } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast"


export default function RelatoriosPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const { toast } = useToast();

  const fetchClients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const clientsData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        codigo_cliente: doc.id,
      })) as Client[];
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
  }, []);

  const generatePdf = () => {
    if (clients.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum cliente",
        description: "Não há clientes para gerar o relatório.",
      });
      return;
    }

    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Relatório de Clientes - EngiFlow", 14, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['ID', 'Nome', 'CPF/CNPJ', 'Telefone', 'Cidade']],
      body: clients.map((client) => [
        client.codigo_cliente,
        client.nome_completo,
        client.cpf_cnpj || '-',
        client.telefone || '-',
        client.endereco_residencial?.city || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219] }, // #3498DB
    });

    doc.save('relatorio_clientes.pdf');
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios e documentos importantes.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Relatório de Clientes</CardTitle>
            <CardDescription>
              Visualize e exporte a lista de todos os clientes cadastrados.
            </CardDescription>
          </div>
          <Button onClick={generatePdf} variant="accent">
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length > 0 ? clients.map((client) => (
                  <TableRow key={client.codigo_cliente}>
                    <TableCell className="font-medium">{client.nome_completo}</TableCell>
                    <TableCell>{client.cpf_cnpj || '-'}</TableCell>
                    <TableCell>{client.telefone || '-'}</TableCell>
                    <TableCell>{client.endereco_residencial?.city || '-'}</TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum cliente encontrado.
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

    