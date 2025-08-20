
'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';

type SapataRow = {
  id: string;
  pav: string;
  tipo: string;
  quant: number;
  largura: number;
  comprimento: number;
  altura: number;
  elos: number;
};

const initialRow: Omit<SapataRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'S1',
  quant: 1,
  largura: 0.8,
  comprimento: 0.8,
  altura: 0.3,
  elos: 5,
};

// Constantes para cálculo de materiais (pode ser ajustado)
const CIMENTO_POR_M3 = 350; // kg/m³ (aprox. 7 sacos/m³)
const PROPORCAO_AREIA = 0.52; // m³ de areia por m³ de concreto
const PROPORCAO_BRITA = 0.83; // m³ de brita por m³ de concreto
const PESO_FERRO_POR_METRO = 0.617; // kg/m para barra de 10mm (exemplo)


export default function QuantitativoPage() {
  const [rows, setRows] = useState<SapataRow[]>([{ ...initialRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialRow, id: crypto.randomUUID(), tipo: `S${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof SapataRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = field === 'pav' || field === 'tipo' ? value : parseFloat(value) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const volumeUnitario = row.largura * row.comprimento * row.altura;
      const volumeTotal = volumeUnitario * row.quant;
      const perimetro = 2 * (row.largura + row.comprimento);
      const totalLinearFerro = perimetro * row.elos * row.quant;
      const totalPesoFerro = totalLinearFerro * PESO_FERRO_POR_METRO;
      const cimentoKg = volumeTotal * CIMENTO_POR_M3;
      const areiaM3 = volumeTotal * PROPORCAO_AREIA;
      const britaM3 = volumeTotal * PROPORCAO_BRITA;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalFerro: totalPesoFerro,
        cimento: cimentoKg,
        areia: areiaM3,
        brita: britaM3,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.volume += row.volume;
      acc.totalLinear += row.totalLinear;
      acc.totalFerro += row.totalFerro;
      acc.cimento += row.cimento;
      acc.areia += row.areia;
      acc.brita += row.brita;
      return acc;
    }, { volume: 0, totalLinear: 0, totalFerro: 0, cimento: 0, areia: 0, brita: 0 });
  }, [calculatedRows]);


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Quantitativo"
        description="Crie orçamentos detalhados para seus projetos."
      />
      <Card>
        <CardHeader>
          <CardTitle>Calculadora de Quantitativos de Sapatas</CardTitle>
          <CardDescription>
            Adicione as sapatas do seu projeto para calcular a quantidade de materiais necessários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Pav.</TableHead>
                  <TableHead className="w-[80px]">Tipo</TableHead>
                  <TableHead className="w-[80px]">Quant.</TableHead>
                  <TableHead className="w-[100px]">Largura (m)</TableHead>
                  <TableHead className="w-[100px]">Compr. (m)</TableHead>
                  <TableHead className="w-[100px]">Altura (m)</TableHead>
                  <TableHead className="w-[120px]">Volume (m³)</TableHead>
                  <TableHead className="w-[80px]">Elos</TableHead>
                  <TableHead className="w-[120px]">Total Linear (m)</TableHead>
                  <TableHead className="w-[120px]">Total de Ferros (kg)</TableHead>
                  <TableHead className="w-[120px]">Cimento (kg)</TableHead>
                  <TableHead className="w-[120px]">Areia (m³)</TableHead>
                  <TableHead className="w-[120px]">Brita (m³)</TableHead>
                   <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><Input value={row.pav} onChange={(e) => handleInputChange(row.id, 'pav', e.target.value)} /></TableCell>
                    <TableCell><Input value={row.tipo} onChange={(e) => handleInputChange(row.id, 'tipo', e.target.value)} /></TableCell>
                    <TableCell><Input type="number" value={row.quant} onChange={(e) => handleInputChange(row.id, 'quant', e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={row.largura} onChange={(e) => handleInputChange(row.id, 'largura', e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={row.comprimento} onChange={(e) => handleInputChange(row.id, 'comprimento', e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={row.altura} onChange={(e) => handleInputChange(row.id, 'altura', e.target.value)} /></TableCell>
                    <TableCell>{row.volume.toFixed(3)}</TableCell>
                    <TableCell><Input type="number" value={row.elos} onChange={(e) => handleInputChange(row.id, 'elos', e.target.value)} /></TableCell>
                    <TableCell>{row.totalLinear.toFixed(2)}</TableCell>
                    <TableCell>{row.totalFerro.toFixed(2)}</TableCell>
                    <TableCell>{row.cimento.toFixed(2)}</TableCell>
                    <TableCell>{row.areia.toFixed(3)}</TableCell>
                    <TableCell>{row.brita.toFixed(3)}</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} disabled={rows.length <= 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                    <TableCell colSpan={6} className="font-bold text-right">Totais</TableCell>
                    <TableCell className="font-bold">{totals.volume.toFixed(3)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-bold">{totals.totalLinear.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">{totals.totalFerro.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">{totals.cimento.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">{totals.areia.toFixed(3)}</TableCell>
                    <TableCell className="font-bold">{totals.brita.toFixed(3)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
        <CardFooter>
            <Button onClick={handleAddRow} variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Sapata
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
