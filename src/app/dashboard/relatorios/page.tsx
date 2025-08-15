
'use client';

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
import { mockClients } from '@/lib/data';
import type { Client } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';

export default function RelatoriosPage() {
  const generatePdf = () => {
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
      body: mockClients.map((client) => [
        client.codigo_cliente,
        client.nome_completo,
        client.cpf_cnpj,
        client.telefone,
        client.endereco_residencial.city,
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
                {mockClients.map((client) => (
                  <TableRow key={client.codigo_cliente}>
                    <TableCell className="font-medium">{client.nome_completo}</TableCell>
                    <TableCell>{client.cpf_cnpj}</TableCell>
                    <TableCell>{client.telefone}</TableCell>
                    <TableCell>{client.endereco_residencial.city}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
