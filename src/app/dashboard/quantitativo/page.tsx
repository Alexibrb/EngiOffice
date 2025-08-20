
'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Settings2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const CALCULATOR_OPTIONS = {
  sapatas: 'Sapatas',
  vigamentos: 'Vigamentos',
  pilares: 'Pilares',
  lajes: 'Lajes e Contrapiso',
  alvenaria: 'Alvenaria',
  reboco: 'Reboco',
};

type CalculatorType = keyof typeof CALCULATOR_OPTIONS;


type SapataRow = {
  id: string;
  pav: string;
  tipo: string;
  quant: number;
  largura: number;
  comprimento: number;
  altura: number;
  elosHoriz: number;
  elosVert: number;
};

const initialSapataRow: Omit<SapataRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'S1',
  quant: 1,
  largura: 0,
  comprimento: 0,
  altura: 0,
  elosHoriz: 0,
  elosVert: 0,
};

const COMPRIMENTO_BARRA_FERRO = 12; // metros
const pavimentoOptions = ['Térreo', 'Pav1', 'Pav2', 'Pav3', 'Pav4', 'Pav5', 'Pav6', 'Pav7', 'Pav8', 'Pav9', 'Pav10'];


function SapataCalculator() {
  const [rows, setRows] = useState<SapataRow[]>([{ ...initialSapataRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialSapataRow, id: crypto.randomUUID(), tipo: `S${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof SapataRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'tipo')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const dobraCm = 7;
      // Convert cm to m for calculations
      const larguraM = row.largura / 100;
      const comprimentoM = row.comprimento / 100;
      const alturaM = row.altura / 100;
      
      const larguraComDobraM = (row.largura + dobraCm) / 100;
      const comprimentoComDobraM = (row.comprimento + dobraCm) / 100;
      const alturaComDobraM = (row.altura + dobraCm) / 100;
      
      const volumeUnitario = larguraM * comprimentoM * alturaM;
      const volumeTotal = volumeUnitario * row.quant;
      
      const totalLinearFerro = (((alturaComDobraM + larguraComDobraM) * 2 * row.elosVert) + ((comprimentoComDobraM + larguraComDobraM) * 2 * row.elosHoriz)) * row.quant;
      const totalBarrasFerro = totalLinearFerro / COMPRIMENTO_BARRA_FERRO;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalBarras: totalBarrasFerro,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.volume += row.volume;
      acc.totalLinear += row.totalLinear;
      acc.totalBarras += row.totalBarras;
      acc.cimento += row.cimento;
      acc.areia += row.areia;
      acc.brita += row.brita;
      return acc;
    }, { volume: 0, totalLinear: 0, totalBarras: 0, cimento: 0, areia: 0, brita: 0 });
  }, [calculatedRows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Sapatas</CardTitle>
        <CardDescription>
          Adicione as sapatas do seu projeto para calcular a quantidade de materiais necessários.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quant.</TableHead>
                <TableHead>Largura (cm)</TableHead>
                <TableHead>Compr. (cm)</TableHead>
                <TableHead>Altura (cm)</TableHead>
                <TableHead>Elos Horiz.</TableHead>
                <TableHead>Elos Vert.</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>Total Linear (m)</TableHead>
                <TableHead className="font-bold bg-primary/10">Barras de 12m</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Brita (m³)</TableHead>
                 <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                    <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.tipo} onChange={(e) => handleInputChange(row.id, 'tipo', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.quant} onChange={(e) => handleInputChange(row.id, 'quant', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.largura} onChange={(e) => handleInputChange(row.id, 'largura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.comprimento} onChange={(e) => handleInputChange(row.id, 'comprimento', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.altura} onChange={(e) => handleInputChange(row.id, 'altura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.elosHoriz} onChange={(e) => handleInputChange(row.id, 'elosHoriz', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.elosVert} onChange={(e) => handleInputChange(row.id, 'elosVert', e.target.value)} /></TableCell>
                  <TableCell>{row.volume.toFixed(3)}</TableCell>
                  <TableCell>{row.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.brita.toFixed(3)}</TableCell>
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
                  <TableCell colSpan={8} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold">{totals.volume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{totals.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.brita.toFixed(3)}</TableCell>
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
  );
}

type VigamentoRow = {
  id: string;
  pav: string;
  tipo: string;
  bitola: string;
  quant: number;
  comprimento: number; // m
  largura: number; // cm
  altura: number; // cm
  quantDeFerro: number;
};

const initialVigamentoRow: Omit<VigamentoRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'V1',
  bitola: '3/8',
  quant: 1,
  comprimento: 0,
  largura: 0,
  altura: 0,
  quantDeFerro: 0,
};


function VigamentoCalculator() {
  const [rows, setRows] = useState<VigamentoRow[]>([{ ...initialVigamentoRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialVigamentoRow, id: crypto.randomUUID(), tipo: `V${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof VigamentoRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'tipo' || field === 'bitola')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const larguraM = row.largura / 100;
      const alturaM = row.altura / 100;
      const comprimentoM = row.comprimento;
      
      const volumeUnitario = larguraM * alturaM * comprimentoM;
      const volumeTotal = volumeUnitario * row.quant;
      
      const totalLinearFerro = (comprimentoM + 0.5) * row.quantDeFerro * row.quant;
      const totalBarrasFerro = totalLinearFerro / COMPRIMENTO_BARRA_FERRO;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      const quantEstribosTotal = (comprimentoM > 0 ? comprimentoM / 0.15 : 0) * row.quant;
      const tamEstriboCm = ((row.largura - 3) + (row.altura - 3)) * 2 + 5;
      const tamEstriboM = tamEstriboCm / 100;
      const totalLinearEstribos = tamEstriboM * quantEstribosTotal;
      const totalBarrasEstribos = totalLinearEstribos > 0 ? totalLinearEstribos / COMPRIMENTO_BARRA_FERRO : 0;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalBarras: totalBarrasFerro,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
        quantFerro3_16: totalBarrasEstribos,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.volume += row.volume;
      acc.totalLinear += row.totalLinear;
      acc.totalBarras += row.totalBarras;
      acc.cimento += row.cimento;
      acc.areia += row.areia;
      acc.brita += row.brita;
      acc.quantFerro3_16 += row.quantFerro3_16;
      return acc;
    }, { volume: 0, totalLinear: 0, totalBarras: 0, cimento: 0, areia: 0, brita: 0, quantFerro3_16: 0 });
  }, [calculatedRows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Vigamentos</CardTitle>
        <CardDescription>
          Adicione os vigamentos do seu projeto para calcular a quantidade de materiais necessários.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bitola do ferro</TableHead>
                <TableHead>Quant.</TableHead>
                <TableHead>Compr. (m)</TableHead>
                <TableHead>Largura (cm)</TableHead>
                <TableHead>Altura (cm)</TableHead>
                <TableHead>Quant. de Ferro</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>Total Linear (m)</TableHead>
                <TableHead className="font-bold bg-primary/10">Barras de 12m</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Brita (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Ferro 3/16 (barras)</TableHead>
                 <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                    <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.tipo} onChange={(e) => handleInputChange(row.id, 'tipo', e.target.value)} /></TableCell>
                  <TableCell><Input value={row.bitola} onChange={(e) => handleInputChange(row.id, 'bitola', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.quant} onChange={(e) => handleInputChange(row.id, 'quant', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.comprimento} onChange={(e) => handleInputChange(row.id, 'comprimento', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.largura} onChange={(e) => handleInputChange(row.id, 'largura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.altura} onChange={(e) => handleInputChange(row.id, 'altura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.quantDeFerro} onChange={(e) => handleInputChange(row.id, 'quantDeFerro', e.target.value)} /></TableCell>
                  <TableCell>{row.volume.toFixed(3)}</TableCell>
                  <TableCell>{row.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.brita.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.quantFerro3_16.toFixed(2)}</TableCell>
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
                  <TableCell colSpan={8} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold">{totals.volume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{totals.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.brita.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.quantFerro3_16.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
          <Button onClick={handleAddRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Vigamento
          </Button>
      </CardFooter>
    </Card>
  );
}

type PilarRow = {
  id: string;
  pav: string;
  tipo: string;
  bitola: string;
  quant: number;
  comprimento: number; // m - altura do pilar
  largura: number; // cm
  altura: number; // cm - profundidade do pilar
  quantDeFerro: number;
};

const initialPilarRow: Omit<PilarRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'P1',
  bitola: '3/8',
  quant: 1,
  comprimento: 0,
  largura: 0,
  altura: 0,
  quantDeFerro: 0,
};


function PilarCalculator() {
  const [rows, setRows] = useState<PilarRow[]>([{ ...initialPilarRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialPilarRow, id: crypto.randomUUID(), tipo: `P${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof PilarRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'tipo' || field === 'bitola')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const larguraM = row.largura / 100;
      const alturaM = row.altura / 100;
      const comprimentoM = row.comprimento;
      
      const volumeUnitario = larguraM * alturaM * comprimentoM;
      const volumeTotal = volumeUnitario * row.quant;
      
      const totalLinearFerro = (comprimentoM + 0.5) * row.quantDeFerro * row.quant;
      const totalBarrasFerro = totalLinearFerro / COMPRIMENTO_BARRA_FERRO;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      const quantEstribosTotal = (comprimentoM > 0 ? comprimentoM / 0.15 : 0) * row.quant;
      const tamEstriboCm = ((row.largura - 3) + (row.altura - 3)) * 2 + 5;
      const tamEstriboM = tamEstriboCm / 100;
      const totalLinearEstribos = tamEstriboM * quantEstribosTotal;
      const totalBarrasEstribos = totalLinearEstribos > 0 ? totalLinearEstribos / COMPRIMENTO_BARRA_FERRO : 0;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalBarras: totalBarrasFerro,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
        quantFerro3_16: totalBarrasEstribos,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.volume += row.volume;
      acc.totalLinear += row.totalLinear;
      acc.totalBarras += row.totalBarras;
      acc.cimento += row.cimento;
      acc.areia += row.areia;
      acc.brita += row.brita;
      acc.quantFerro3_16 += row.quantFerro3_16;
      return acc;
    }, { volume: 0, totalLinear: 0, totalBarras: 0, cimento: 0, areia: 0, brita: 0, quantFerro3_16: 0 });
  }, [calculatedRows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Pilares</CardTitle>
        <CardDescription>
          Adicione os pilares do seu projeto para calcular a quantidade de materiais necessários.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bitola do ferro</TableHead>
                <TableHead>Quant.</TableHead>
                <TableHead>Altura (m)</TableHead>
                <TableHead>Largura (cm)</TableHead>
                <TableHead>Profundidade (cm)</TableHead>
                <TableHead>Quant. de Ferro</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>Total Linear (m)</TableHead>
                <TableHead className="font-bold bg-primary/10">Barras de 12m</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Brita (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Ferro 3/16 (barras)</TableHead>
                 <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                    <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.tipo} onChange={(e) => handleInputChange(row.id, 'tipo', e.target.value)} /></TableCell>
                  <TableCell><Input value={row.bitola} onChange={(e) => handleInputChange(row.id, 'bitola', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.quant} onChange={(e) => handleInputChange(row.id, 'quant', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.comprimento} onChange={(e) => handleInputChange(row.id, 'comprimento', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.largura} onChange={(e) => handleInputChange(row.id, 'largura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.altura} onChange={(e) => handleInputChange(row.id, 'altura', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={row.quantDeFerro} onChange={(e) => handleInputChange(row.id, 'quantDeFerro', e.target.value)} /></TableCell>
                  <TableCell>{row.volume.toFixed(3)}</TableCell>
                  <TableCell>{row.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.brita.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.quantFerro3_16.toFixed(2)}</TableCell>
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
                  <TableCell colSpan={8} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold">{totals.volume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{totals.totalLinear.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.totalBarras.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.brita.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.quantFerro3_16.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
          <Button onClick={handleAddRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Pilar
          </Button>
      </CardFooter>
    </Card>
  );
}

type LajeRow = {
  id: string;
  pav: string;
  descricao: string;
  espessuraConcreto: number; // cm
  area: number; // m²
};

const initialLajeRow: Omit<LajeRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Laje 1',
  espessuraConcreto: 0,
  area: 0,
};

function LajeCalculator() {
  const [rows, setRows] = useState<LajeRow[]>([{ ...initialLajeRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialLajeRow, id: crypto.randomUUID(), descricao: `Laje ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof LajeRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'descricao')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const espessuraM = row.espessuraConcreto / 100;
      const volumeTotal = row.area * espessuraM;
      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.14 : 0;
      const areiaM3 = cimentoSacos > 0 ? (cimentoSacos * 4 * 18) / 1000 : 0;
      const britaM3 = cimentoSacos > 0 ? (cimentoSacos * 5 * 18) / 1000 : 0;

      return {
        ...row,
        volume: volumeTotal,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.volume += row.volume;
      acc.cimento += row.cimento;
      acc.areia += row.areia;
      acc.brita += row.brita;
      return acc;
    }, { volume: 0, cimento: 0, areia: 0, brita: 0 });
  }, [calculatedRows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Lajes e Contrapiso</CardTitle>
        <CardDescription>
          Adicione as lajes ou áreas de contrapiso do seu projeto para calcular a quantidade de materiais necessários.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Espessura Concreto (cm)</TableHead>
                <TableHead>Área (m²)</TableHead>
                <TableHead className="font-bold bg-primary/10">Volume (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Brita (m³)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                    <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.descricao} onChange={(e) => handleInputChange(row.id, 'descricao', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.espessuraConcreto} onChange={(e) => handleInputChange(row.id, 'espessuraConcreto', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.area} onChange={(e) => handleInputChange(row.id, 'area', e.target.value)} /></TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.volume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.brita.toFixed(3)}</TableCell>
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
                  <TableCell colSpan={4} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.volume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.areia.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.brita.toFixed(3)}</TableCell>
                  <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
          <Button onClick={handleAddRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Item
          </Button>
      </CardFooter>
    </Card>
  );
}

type AlvenariaRow = {
  id: string;
  pav: string;
  descricao: string;
  area: number; // m²
  larguraBloco: number; // cm
  alturaBloco: number; // cm
  junta: number; // cm
};

const initialAlvenariaRow: Omit<AlvenariaRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Parede 1',
  area: 0,
  larguraBloco: 0,
  alturaBloco: 0,
  junta: 0,
};

function AlvenariaCalculator() {
  const [rows, setRows] = useState<AlvenariaRow[]>([{ ...initialAlvenariaRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialAlvenariaRow, id: crypto.randomUUID(), descricao: `Parede ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof AlvenariaRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'descricao' || field === 'pav')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const A = row.area;
      const L = row.larguraBloco / 100; // m
      const H = row.alturaBloco / 100; // m
      const j_cm = row.junta;
      const j_m = j_cm / 100;

      const Cc = 430; // kg/m³
      const Ca = 1.2; // m³/m³

      const areaBlocoComJunta = (L > 0 && H > 0) ? (L + j_m) * (H + j_m) : 0;
      const N_blocos = areaBlocoComJunta > 0 ? A / areaBlocoComJunta : 0;
      const N_final = N_blocos * (1 + 0.05); // 5% de perda
      
      const V_arg = A * (0.02 * j_cm); 
      const V_final = V_arg * (1 + 0.10); // 10% de perda
      
      const Q_cimento = V_final * Cc;
      const Sacos = Q_cimento > 0 ? Q_cimento / 50 : 0;
      const Q_areia = V_final * Ca;
      

      return {
        ...row,
        blocksNeeded: N_final,
        mortarVolume: V_final,
        cementSacks: Sacos,
        sandM3: Q_areia,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.blocksNeeded += row.blocksNeeded;
      acc.mortarVolume += row.mortarVolume;
      acc.cementSacks += row.cementSacks;
      acc.sandM3 += row.sandM3;
      return acc;
    }, { blocksNeeded: 0, mortarVolume: 0, cementSacks: 0, sandM3: 0 });
  }, [calculatedRows]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Alvenaria</CardTitle>
        <CardDescription>
          Calcule a quantidade de blocos e argamassa para as paredes do seu projeto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Descrição da Parede</TableHead>
                <TableHead>Área Parede (m²)</TableHead>
                <TableHead>Larg. Bloco (cm)</TableHead>
                <TableHead>Alt. Bloco (cm)</TableHead>
                <TableHead>Junta (cm)</TableHead>
                <TableHead className="font-bold bg-primary/10">Quant. Blocos (un)</TableHead>
                <TableHead className="font-bold bg-primary/10">Argamassa (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                    <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.descricao} onChange={(e) => handleInputChange(row.id, 'descricao', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.area} onChange={(e) => handleInputChange(row.id, 'area', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.larguraBloco} onChange={(e) => handleInputChange(row.id, 'larguraBloco', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="1" value={row.alturaBloco} onChange={(e) => handleInputChange(row.id, 'alturaBloco', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.junta} onChange={(e) => handleInputChange(row.id, 'junta', e.target.value)} /></TableCell>
                  <TableCell className="font-bold bg-primary/10">{Math.ceil(row.blocksNeeded)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.mortarVolume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cementSacks.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.sandM3.toFixed(3)}</TableCell>
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
                  <TableCell className="font-bold bg-primary/10">{Math.ceil(totals.blocksNeeded)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.mortarVolume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cementSacks.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.sandM3.toFixed(3)}</TableCell>
                  <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
          <Button onClick={handleAddRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Parede
          </Button>
      </CardFooter>
    </Card>
  )
}

type RebocoRow = {
  id: string;
  pav: string;
  descricao: string;
  area: number; // m²
  espessura: number; // cm
  lados: 1 | 2;
};

const initialRebocoRow: Omit<RebocoRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Parede 1',
  area: 0,
  espessura: 0,
  lados: 1,
};

function RebocoCalculator() {
  const [rows, setRows] = useState<RebocoRow[]>([{ ...initialRebocoRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialRebocoRow, id: crypto.randomUUID(), descricao: `Parede ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof RebocoRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'descricao' || field === 'pav')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      const A = row.area * row.lados;
      const e = row.espessura / 100; // m

      const Cc = 430;
      const Ca = 1.2;

      const V_arg = A * e; 
      const V_final = V_arg * (1 + 0.10); // 10% de perda
      
      const Q_cimento = V_final * Cc;
      const Sacos = Q_cimento > 0 ? Q_cimento / 50 : 0;
      const Q_areia = V_final * Ca;
      
      return {
        ...row,
        mortarVolume: V_final,
        cementSacks: Sacos,
        sandM3: Q_areia,
      };
    });
  }, [rows]);

  const totals = useMemo(() => {
    return calculatedRows.reduce((acc, row) => {
      acc.mortarVolume += row.mortarVolume;
      acc.cementSacks += row.cementSacks;
      acc.sandM3 += row.sandM3;
      return acc;
    }, { mortarVolume: 0, cementSacks: 0, sandM3: 0 });
  }, [calculatedRows]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos de Reboco</CardTitle>
        <CardDescription>
          Calcule a quantidade de argamassa para o reboco das paredes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Descrição da Parede</TableHead>
                <TableHead>Área Parede (m²)</TableHead>
                <TableHead>Espessura (cm)</TableHead>
                <TableHead>Lados</TableHead>
                <TableHead className="font-bold bg-primary/10">Argamassa (m³)</TableHead>
                <TableHead className="font-bold bg-primary/10">Cimento (sacos 50kg)</TableHead>
                <TableHead className="font-bold bg-primary/10">Areia (m³)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[150px]">
                     <Select value={row.pav} onValueChange={(value) => handleInputChange(row.id, 'pav', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={row.descricao} onChange={(e) => handleInputChange(row.id, 'descricao', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.area} onChange={(e) => handleInputChange(row.id, 'area', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.1" value={row.espessura} onChange={(e) => handleInputChange(row.id, 'espessura', e.target.value)} /></TableCell>
                  <TableCell>
                     <Select value={String(row.lados)} onValueChange={(value) => handleInputChange(row.id, 'lados', value)}>
                        <SelectTrigger className="w-[80px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.mortarVolume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cementSacks.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.sandM3.toFixed(3)}</TableCell>
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
                  <TableCell colSpan={5} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.mortarVolume.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.cementSacks.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{totals.sandM3.toFixed(3)}</TableCell>
                  <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
          <Button onClick={handleAddRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Parede
          </Button>
      </CardFooter>
    </Card>
  )
}

export default function QuantitativoPage() {
  const [visibleCalculators, setVisibleCalculators] = useState<Record<CalculatorType, boolean>>({
    sapatas: true,
    vigamentos: true,
    pilares: true,
    lajes: true,
    alvenaria: true,
    reboco: true,
  });

  const handleVisibilityChange = (key: CalculatorType, checked: boolean) => {
    setVisibleCalculators(prev => ({ ...prev, [key]: checked }));
  };
  
  const calculators: { key: CalculatorType; component: React.ComponentType }[] = [
    { key: 'sapatas', component: SapataCalculator },
    { key: 'vigamentos', component: VigamentoCalculator },
    { key: 'pilares', component: PilarCalculator },
    { key: 'lajes', component: LajeCalculator },
    { key: 'alvenaria', component: AlvenariaCalculator },
    { key: 'reboco', component: RebocoCalculator },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Quantitativo"
          description="Crie orçamentos detalhados para seus projetos."
        />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Exibir Calculadoras
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Selecione as calculadoras</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(CALCULATOR_OPTIONS).map(([key, label]) => (
                     <DropdownMenuCheckboxItem
                        key={key}
                        checked={visibleCalculators[key as CalculatorType]}
                        onCheckedChange={(checked) => handleVisibilityChange(key as CalculatorType, !!checked)}
                     >
                        {label}
                     </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {calculators.map(({ key, component: Component }) =>
        visibleCalculators[key] ? <Component key={key} /> : null
      )}
    </div>
  );
}
