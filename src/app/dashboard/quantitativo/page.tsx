
'use client';

import { useState, useMemo, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Settings2, Download, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCompanyData } from '../layout';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client } from '@/lib/types';


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
  bitola: string;
  quant: string;
  largura: string;
  comprimento: string;
  altura: string;
  elosHoriz: string;
  elosVert: string;
};

const initialSapataRow: Omit<SapataRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'S1',
  bitola: '3/8',
  quant: '1',
  largura: '',
  comprimento: '',
  altura: '',
  elosHoriz: '',
  elosVert: '',
};

const COMPRIMENTO_BARRA_FERRO = 12; // metros
const pavimentoOptions = ['Térreo', 'Pav1', 'Pav2', 'Pav3', 'Pav4', 'Pav5', 'Pav6', 'Pav7', 'Pav8', 'Pav9', 'Pav10'];
const bitolaOptions = ['1/4', '5/16', '3/8', '1/2', '5/8'];

type Totals = {
    [key: string]: number | Record<string, number> | any[];
};


type CalculatorProps = {
    pavimentoFilter: string;
};

export type CalculatorRef = {
    getTotals: () => Totals;
};

function usePersistentState<T>(key: string, initialState: T): [T, (value: T) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            if (typeof window !== 'undefined') {
                const item = window.localStorage.getItem(key);
                return item ? JSON.parse(item) : initialState;
            }
        } catch (error) {
            console.error(error);
        }
        return initialState;
    });

    const setPersistentState = (value: T) => {
        try {
            if (typeof window !== 'undefined') {
                const valueToStore = value instanceof Function ? value(state) : value;
                setState(valueToStore);
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return [state, setPersistentState];
}


const SapataCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<SapataRow[]>('sapatasData', [{ ...initialSapataRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialSapataRow, id: crypto.randomUUID(), tipo: `S${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof SapataRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
      const quant = parseFloat(row.quant) || 0;
      const largura = parseFloat(row.largura) || 0;
      const comprimento = parseFloat(row.comprimento) || 0;
      const altura = parseFloat(row.altura) || 0;
      const elosHoriz = parseFloat(row.elosHoriz) || 0;
      const elosVert = parseFloat(row.elosVert) || 0;

      const folgaCm = 20;

      const larguraM = largura / 100;
      const comprimentoM = comprimento / 100;
      const alturaM = altura / 100;

      const comprimentoBarraVerticalM = (comprimento > folgaCm) ? (comprimento - folgaCm) / 100 : 0;
      const comprimentoBarraHorizontalM = (largura > folgaCm) ? (largura - folgaCm) / 100 : 0;

      const volumeUnitario = larguraM * comprimentoM * alturaM;
      const volumeTotal = volumeUnitario * quant;
      
      const totalLinearFerro = ((comprimentoBarraHorizontalM * elosHoriz) + (comprimentoBarraVerticalM * elosVert)) * quant;
      const totalBarrasFerro = totalLinearFerro > 0 ? totalLinearFerro / COMPRIMENTO_BARRA_FERRO : 0;

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
  }, [filteredRows]);

  const getTotals = useCallback(() => {
    const totals: Totals = {
        volume: 0,
        totalLinear: 0,
        cimento: 0,
        areia: 0,
        brita: 0,
        ferro: {}
    };
    calculatedRows.forEach(row => {
        (totals.volume as number) += row.volume;
        (totals.totalLinear as number) += row.totalLinear;
        (totals.cimento as number) += row.cimento;
        (totals.areia as number) += row.areia;
        (totals.brita as number) += row.brita;

        const ferroTotals = totals.ferro as Record<string, number>;
        ferroTotals[row.bitola] = (ferroTotals[row.bitola] || 0) + row.totalBarras;
    });
    return totals;
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));
  
  const displayTotals = useMemo(() => getTotals(), [getTotals]);


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Sapatas</CardTitle>
            <CardDescription>
              Adicione as sapatas do seu projeto para calcular a quantidade de materiais necessários.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialSapataRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
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
                <TableHead>Largura (cm)</TableHead>
                <TableHead>Compr. (cm)</TableHead>
                <TableHead>Altura (cm)</TableHead>
                <TableHead>Barras Horiz.</TableHead>
                <TableHead>Barras Vert.</TableHead>
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
                  <TableCell className="min-w-[150px]">
                     <Select value={row.bitola} onValueChange={(value) => handleInputChange(row.id, 'bitola', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {bitolaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell colSpan={9} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold">{(displayTotals.volume as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{(displayTotals.totalLinear as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{Object.values(displayTotals.ferro as Record<string, number>).reduce((a, b) => a + b, 0).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.brita as number).toFixed(3)}</TableCell>
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
});
SapataCalculator.displayName = "SapataCalculator";

type VigamentoRow = {
  id: string;
  pav: string;
  tipo: string;
  bitola: string;
  quant: string;
  comprimento: string; // m
  largura: string; // cm
  altura: string; // cm
  quantDeFerro: string;
};

const initialVigamentoRow: Omit<VigamentoRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'V1',
  bitola: '3/8',
  quant: '1',
  comprimento: '',
  largura: '',
  altura: '',
  quantDeFerro: '',
};

const VigamentoCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<VigamentoRow[]>('vigamentosData', [{ ...initialVigamentoRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialVigamentoRow, id: crypto.randomUUID(), tipo: `V${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof VigamentoRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
      const quant = parseFloat(row.quant) || 0;
      const comprimento = parseFloat(row.comprimento) || 0;
      const largura = parseFloat(row.largura) || 0;
      const altura = parseFloat(row.altura) || 0;
      const quantDeFerro = parseFloat(row.quantDeFerro) || 0;

      const larguraM = largura / 100;
      const alturaM = altura / 100;
      const comprimentoM = comprimento;
      
      const volumeUnitario = larguraM * alturaM * comprimentoM;
      const volumeTotal = volumeUnitario * quant;
      
      const totalLinearFerro = (comprimentoM > 0 ? (comprimentoM + 0.5) : 0) * quantDeFerro * quant;
      const totalBarrasFerro = totalLinearFerro > 0 ? totalLinearFerro / COMPRIMENTO_BARRA_FERRO : 0;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      const totalBarrasEstribos = (comprimentoM > 0 && COMPRIMENTO_BARRA_FERRO > 0) 
        ? ((comprimentoM / 0.15) * (((largura + altura + 4) * 2) / 100) * quant) / COMPRIMENTO_BARRA_FERRO
        : 0;

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
  }, [filteredRows]);

 const getTotals = useCallback(() => {
    const totals: Totals = {
        volume: 0,
        totalLinear: 0,
        cimento: 0,
        areia: 0,
        brita: 0,
        quantFerro3_16: 0,
        ferro: {}
    };
    calculatedRows.forEach(row => {
        (totals.volume as number) += row.volume;
        (totals.totalLinear as number) += row.totalLinear;
        (totals.cimento as number) += row.cimento;
        (totals.areia as number) += row.areia;
        (totals.brita as number) += row.brita;
        (totals.quantFerro3_16 as number) += row.quantFerro3_16;

        const ferroTotals = totals.ferro as Record<string, number>;
        ferroTotals[row.bitola] = (ferroTotals[row.bitola] || 0) + row.totalBarras;
    });
    return totals;
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));

  const displayTotals = useMemo(() => getTotals(), [getTotals]);
  

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Vigamentos</CardTitle>
            <CardDescription>
              Adicione os vigamentos do seu projeto para calcular a quantidade de materiais necessários.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialVigamentoRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
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
                  <TableCell className="min-w-[150px]">
                     <Select value={row.bitola} onValueChange={(value) => handleInputChange(row.id, 'bitola', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {bitolaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell className="font-bold">{(displayTotals.volume as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{(displayTotals.totalLinear as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{Object.values(displayTotals.ferro as Record<string, number>).reduce((a, b) => a + b, 0).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.brita as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.quantFerro3_16 as number).toFixed(2)}</TableCell>
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
});
VigamentoCalculator.displayName = "VigamentoCalculator";

type PilarRow = {
  id: string;
  pav: string;
  tipo: string;
  bitola: string;
  quant: string;
  comprimento: string; // m - altura do pilar
  largura: string; // cm
  altura: string; // cm - profundidade do pilar
  quantDeFerro: string;
};

const initialPilarRow: Omit<PilarRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'P1',
  bitola: '3/8',
  quant: '1',
  comprimento: '',
  largura: '',
  altura: '',
  quantDeFerro: '',
};

const PilarCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<PilarRow[]>('pilaresData', [{ ...initialPilarRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialPilarRow, id: crypto.randomUUID(), tipo: `P${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof PilarRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
        const quant = parseFloat(row.quant) || 0;
        const comprimento = parseFloat(row.comprimento) || 0;
        const largura = parseFloat(row.largura) || 0;
        const altura = parseFloat(row.altura) || 0;
        const quantDeFerro = parseFloat(row.quantDeFerro) || 0;

        const larguraM = largura / 100;
        const alturaM = altura / 100;
        const comprimentoM = comprimento;
      
        const volumeUnitario = larguraM * alturaM * comprimentoM;
        const volumeTotal = volumeUnitario * quant;
      
        const totalLinearFerro = (comprimentoM > 0 ? (comprimentoM + 0.5) : 0) * quantDeFerro * quant;
        const totalBarrasFerro = totalLinearFerro > 0 ? totalLinearFerro / COMPRIMENTO_BARRA_FERRO : 0;

        const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
        const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
        const britaM3 = (cimentoSacos * 6 * 18) / 1000;

        const totalBarrasEstribos = (comprimentoM > 0 && COMPRIMENTO_BARRA_FERRO > 0) 
          ? ((comprimentoM / 0.15) * (((largura + altura + 4) * 2) / 100) * quant) / COMPRIMENTO_BARRA_FERRO
          : 0;

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
  }, [filteredRows]);

  const getTotals = useCallback(() => {
    const totals: Totals = {
        volume: 0,
        totalLinear: 0,
        cimento: 0,
        areia: 0,
        brita: 0,
        quantFerro3_16: 0,
        ferro: {}
    };
    calculatedRows.forEach(row => {
        (totals.volume as number) += row.volume;
        (totals.totalLinear as number) += row.totalLinear;
        (totals.cimento as number) += row.cimento;
        (totals.areia as number) += row.areia;
        (totals.brita as number) += row.brita;
        (totals.quantFerro3_16 as number) += row.quantFerro3_16;

        const ferroTotals = totals.ferro as Record<string, number>;
        ferroTotals[row.bitola] = (ferroTotals[row.bitola] || 0) + row.totalBarras;
    });
    return totals;
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));
  
  const displayTotals = useMemo(() => getTotals(), [getTotals]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Pilares</CardTitle>
            <CardDescription>
              Adicione os pilares do seu projeto para calcular a quantidade de materiais necessários.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialPilarRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
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
                  <TableCell className="min-w-[150px]">
                     <Select value={row.bitola} onValueChange={(value) => handleInputChange(row.id, 'bitola', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {bitolaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell className="font-bold">{(displayTotals.volume as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{(displayTotals.totalLinear as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{Object.values(displayTotals.ferro as Record<string, number>).reduce((a, b) => a + b, 0).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.brita as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.quantFerro3_16 as number).toFixed(2)}</TableCell>
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
});
PilarCalculator.displayName = "PilarCalculator";

type LajeRow = {
  id: string;
  pav: string;
  descricao: string;
  tipo: 'Laje' | 'Contrapiso';
  espessuraConcreto: string; // cm
  area: string; // m²
};

const initialLajeRow: Omit<LajeRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Laje 1',
  tipo: 'Laje',
  espessuraConcreto: '',
  area: '',
};

const LajeCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<LajeRow[]>('lajesData', [{ ...initialLajeRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialLajeRow, id: crypto.randomUUID(), descricao: `Item ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof LajeRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
      const espessuraConcreto = parseFloat(row.espessuraConcreto) || 0;
      const area = parseFloat(row.area) || 0;

      const espessuraM = espessuraConcreto / 100;
      const volumeTotal = area * espessuraM;
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
  }, [filteredRows]);

  const getTotals = useCallback(() => {
    const totals: Totals = {
        volume: 0,
        cimento: 0,
        areia: 0,
        brita: 0,
        area: 0,
        items: [] as any
    };

    calculatedRows.forEach(row => {
        const area = parseFloat(row.area) || 0;
        (totals.volume as number) += row.volume;
        (totals.cimento as number) += row.cimento;
        (totals.areia as number) += row.areia;
        (totals.brita as number) += row.brita;
        if (row.tipo === 'Laje') {
            (totals.area as number) += area;
        }
    });

    (totals.items as any[]) = calculatedRows.map(row => ({
        descricao: row.descricao,
        tipo: row.tipo,
        volume: row.volume,
        cimento: row.cimento,
        areia: row.areia,
        brita: row.brita,
        area: parseFloat(row.area) || 0,
    }));

    return totals;
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));

  const displayTotals = useMemo(() => getTotals(), [getTotals]);


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Lajes e Contrapiso</CardTitle>
            <CardDescription>
              Adicione as lajes ou áreas de contrapiso para calcular os materiais.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialLajeRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pav.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
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
                  <TableCell className="min-w-[150px]">
                    <Select value={row.tipo} onValueChange={(value) => handleInputChange(row.id, 'tipo', value as 'Laje' | 'Contrapiso')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Laje">Laje</SelectItem>
                            <SelectItem value="Contrapiso">Contrapiso</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell colSpan={5} className="font-bold text-right">Totais</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.volume as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.brita as number).toFixed(3)}</TableCell>
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
});
LajeCalculator.displayName = "LajeCalculator";


type AlvenariaRow = {
  id: string;
  pav: string;
  descricao: string;
  area: string; // m²
  larguraBloco: string; // cm
  alturaBloco: string; // cm
  junta: string; // cm
};

const initialAlvenariaRow: Omit<AlvenariaRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Parede 1',
  area: '',
  larguraBloco: '',
  alturaBloco: '',
  junta: '1.5',
};

const AlvenariaCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<AlvenariaRow[]>('alvenariaData', [{ ...initialAlvenariaRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialAlvenariaRow, id: crypto.randomUUID(), descricao: `Parede ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof AlvenariaRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);
  
  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
        const area = parseFloat(row.area) || 0;
        const larguraBloco = parseFloat(row.larguraBloco) || 0;
        const alturaBloco = parseFloat(row.alturaBloco) || 0;
        const junta = parseFloat(row.junta) || 0;

        const A = area;
        const L = larguraBloco / 100; // m
        const H = alturaBloco / 100; // m
        const j_m = junta / 100; // m
      
        const areaBlocoComJunta = (L > 0 && H > 0) ? (L + j_m) * (H + j_m) : 0;
        const N_blocos = areaBlocoComJunta > 0 ? A / areaBlocoComJunta : 0;
        const N_final = N_blocos * (1 + 0.05); // 5% de perda
      
        // Traço 1:8 (cimento:areia) com consumo de cimento de 216 kg/m³ de argamassa
        const Cc_alvenaria = 216; // kg/m³
        const Ca_alvenaria = 1.08; // m³/m³
        
        const V_arg = A * j_m; 
        const V_final = V_arg * (1 + 0.10); // 10% de perda
      
        const Q_cimento = V_final * Cc_alvenaria;
        const Sacos = Q_cimento > 0 ? Q_cimento / 50 : 0;
        const Q_areia = V_final * Ca_alvenaria;

        return {
            ...row,
            blocos: N_final,
            argamassa: V_final,
            cimento: Sacos,
            areia: Q_areia,
        };
    });
  }, [filteredRows]);

  const getTotals = useCallback(() => {
    return calculatedRows.reduce((acc: Totals, row) => {
      (acc.blocos as number) = (acc.blocos as number || 0) + row.blocos;
      (acc.argamassa as number) = (acc.argamassa as number || 0) + row.argamassa;
      (acc.cimento as number) = (acc.cimento as number || 0) + row.cimento;
      (acc.areia as number) = (acc.areia as number || 0) + row.areia;
      return acc;
    }, { blocos: 0, argamassa: 0, cimento: 0, areia: 0 });
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));
  
  const displayTotals = useMemo(() => getTotals(), [getTotals]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Alvenaria</CardTitle>
            <CardDescription>
              Calcule a quantidade de blocos e argamassa para as paredes do seu projeto.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialAlvenariaRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
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
                  <TableCell className="font-bold bg-primary/10">{Math.ceil(row.blocos)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.argamassa.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
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
                  <TableCell className="font-bold bg-primary/10">{Math.ceil(displayTotals.blocos as number)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.argamassa as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
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
});
AlvenariaCalculator.displayName = "AlvenariaCalculator";


type RebocoRow = {
  id: string;
  pav: string;
  descricao: string;
  area: string; // m²
  espessura: string; // cm
  lados: '1' | '2';
};

const initialRebocoRow: Omit<RebocoRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Parede 1',
  area: '',
  espessura: '',
  lados: '1',
};

const RebocoCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<RebocoRow[]>('rebocoData', [{ ...initialRebocoRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialRebocoRow, id: crypto.randomUUID(), descricao: `Parede ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof RebocoRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(newRows);
  };
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);
  
  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
      const area = parseFloat(row.area) || 0;
      const espessura = parseFloat(row.espessura) || 0;
      const lados = parseFloat(row.lados) || 1;

      const A = area * lados;
      const e = espessura / 100; // m

      // Traço 1:4 (cimento:areia) com consumo de cimento de 324 kg/m³ de argamassa
      const Cc_reboco = 324;
      const Ca_reboco = 1.3;

      const V_arg = A * e; 
      const V_final = V_arg * (1 + 0.10); // 10% de perda
      
      const Q_cimento = V_final * Cc_reboco;
      const Sacos = Q_cimento > 0 ? Q_cimento / 50 : 0;
      const Q_areia = V_final * Ca_reboco;
      
      return {
        ...row,
        argamassa: V_final,
        cimento: Sacos,
        areia: Q_areia,
      };
    });
  }, [filteredRows]);

  const getTotals = useCallback(() => {
    return calculatedRows.reduce((acc: Totals, row) => {
      (acc.argamassa as number) = (acc.argamassa as number || 0) + row.argamassa;
      (acc.cimento as number) = (acc.cimento as number || 0) + row.cimento;
      (acc.areia as number) = (acc.areia as number || 0) + row.areia;
      return acc;
    }, { argamassa: 0, cimento: 0, areia: 0 });
  }, [calculatedRows]);

  useImperativeHandle(ref, () => ({
    getTotals,
  }));

  const displayTotals = useMemo(() => getTotals(), [getTotals]);


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Calculadora de Quantitativos de Reboco</CardTitle>
            <CardDescription>
              Calcule a quantidade de argamassa para o reboco das paredes.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([{ ...initialRebocoRow, id: crypto.randomUUID() }])}><RotateCcw className="mr-2 h-4 w-4"/>Limpar</Button>
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
                     <Select value={String(row.lados)} onValueChange={(value) => handleInputChange(row.id, 'lados', value as '1' | '2')}>
                        <SelectTrigger className="w-[80px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.argamassa.toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.cimento.toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{row.areia.toFixed(3)}</TableCell>
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
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.argamassa as number).toFixed(3)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.cimento as number).toFixed(2)}</TableCell>
                  <TableCell className="font-bold bg-primary/10">{(displayTotals.areia as number).toFixed(3)}</TableCell>
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
});
RebocoCalculator.displayName = "RebocoCalculator";

export default function QuantitativoPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [visibleCalculators, setVisibleCalculators] = useState<Record<CalculatorType, boolean>>({
    sapatas: true,
    vigamentos: false,
    pilares: false,
    lajes: false,
    alvenaria: false,
    reboco: false,
  });
  
  const [pavimentoFilter, setPavimentoFilter] = useState<string>('todos');
  const companyData = useCompanyData();

  useEffect(() => {
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
        // Optionally, show a toast message here
      }
    };
    fetchClients();
  }, []);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.codigo_cliente === selectedClientId);
  }, [clients, selectedClientId]);

  const calculatorRefs = {
    sapatas: useRef<CalculatorRef>(null),
    vigamentos: useRef<CalculatorRef>(null),
    pilares: useRef<CalculatorRef>(null),
    lajes: useRef<CalculatorRef>(null),
    alvenaria: useRef<CalculatorRef>(null),
    reboco: useRef<CalculatorRef>(null),
  };
  
  const handleResetAll = () => {
    Object.keys(CALCULATOR_OPTIONS).forEach(key => {
      localStorage.removeItem(`${key}Data`);
    });
    window.location.reload(); 
  };


  const handleVisibilityChange = (key: CalculatorType, checked: boolean) => {
    setVisibleCalculators(prev => ({ ...prev, [key]: checked }));
  };
  
  const calculators: { key: CalculatorType; component: React.ComponentType<any> }[] = [
    { key: 'sapatas', component: SapataCalculator },
    { key: 'vigamentos', component: VigamentoCalculator },
    { key: 'pilares', component: PilarCalculator },
    { key: 'lajes', component: LajeCalculator },
    { key: 'alvenaria', component: AlvenariaCalculator },
    { key: 'reboco', component: RebocoCalculator },
  ];

  const generatePdf = () => {
        const doc = new jsPDF();

        const addHeader = (doc: jsPDF, pageNumber: number) => {
            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 15;

            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(companyData?.companyName || 'EngiOffice', pageWidth / 2, currentY, { align: 'center' });
            currentY += 8;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text(pageNumber === 1 ? 'Relatório de Quantitativos' : 'Resumo Geral de Materiais', pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            if (selectedClient) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('Cliente:', 14, currentY);
                doc.setFont('helvetica', 'normal');
                doc.text(selectedClient.nome_completo, 30, currentY);
                currentY += 5;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.text('Filtro de Pavimento Aplicado:', 14, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(pavimentoFilter === 'todos' ? 'Todos' : pavimentoFilter, 65, currentY);

            return currentY + 10;
        };
        
        let currentY = addHeader(doc, 1);
        
        const consolidatedTotals: Record<string, { value: number; unit: string }> = {};

        const allTotals: Record<string, Totals> = {};
        Object.entries(calculatorRefs).forEach(([key, ref]) => {
            if (visibleCalculators[key as CalculatorType] && ref.current) {
                allTotals[key] = ref.current.getTotals();
            }
        });


        // Seção Detalhada por Calculadora
        Object.entries(allTotals).forEach(([key, totals]) => {
            if (Object.keys(totals).length === 0) return;
            
            const body: (string | number)[][] = [];
            const ferroTotals = totals.ferro as Record<string, number> | undefined;

            if ((totals.cimento as number) > 0) {
                const value = totals.cimento as number;
                body.push(['Cimento (sacos 50kg)', value.toFixed(2)]);
                consolidatedTotals['Cimento (sacos 50kg)'] = { value: (consolidatedTotals['Cimento (sacos 50kg)']?.value || 0) + value, unit: 'sacos' };
            }
            
            if ((totals.areia as number) > 0) {
                 const value = totals.areia as number;
                body.push(['Areia (m³)', value.toFixed(3)]);
                consolidatedTotals['Areia (m³)'] = { value: (consolidatedTotals['Areia (m³)']?.value || 0) + value, unit: 'm³' };
            }
            
            if ((totals.brita as number) > 0) {
                 const value = totals.brita as number;
                body.push(['Brita (m³)', value.toFixed(3)]);
                consolidatedTotals['Brita (m³)'] = { value: (consolidatedTotals['Brita (m³)']?.value || 0) + value, unit: 'm³' };
            }

            if(ferroTotals && Object.keys(ferroTotals).length > 0) {
              Object.entries(ferroTotals).forEach(([bitola, value]) => {
                  const itemName = `Ferro ${bitola} (barras)`;
                  body.push([itemName, value.toFixed(2)]);
                  consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'un' };
              })
            }

            if ((totals.quantFerro3_16 as number) > 0) {
                 const value = totals.quantFerro3_16 as number;
                 const itemName = `Ferro 3/16 (barras)`;
                body.push([itemName, value.toFixed(2)]);
                consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'un' };
            }

             if ((totals.blocos as number) > 0) {
                 const value = totals.blocos as number;
                 const itemName = 'Blocos (un)';
                body.push([itemName, Math.ceil(value)]);
                consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'un' };
            }

            if ((totals.argamassa as number) > 0) {
                 const value = totals.argamassa as number;
                 body.push(['Argamassa (m³)', value.toFixed(3)]);
            }

            if (key === 'lajes' && Array.isArray((totals as any).items)) {
                (totals as any).items.forEach((item: any) => {
                     body.push([`  - ${item.descricao} (${item.tipo})`, `${item.area.toFixed(2)} m²`]);
                });
            }

            if (body.length > 0) {
                 autoTable(doc, {
                    startY: currentY,
                    head: [[CALCULATOR_OPTIONS[key as CalculatorType], 'Total']],
                    body: body,
                    theme: 'striped',
                    headStyles: { fillColor: [34, 139, 34] },
                });
                currentY = (doc as any).lastAutoTable.finalY + 10;
            }
        });

        if (allTotals.lajes && (allTotals.lajes.area as number) > 0) {
             const value = allTotals.lajes.area as number;
             const itemName = 'Área de Laje (m²)';
             consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'm²' };
        }
        
        doc.addPage();
        currentY = addHeader(doc, 2);
        
        if (Object.keys(consolidatedTotals).length > 0) {
            const summaryBody = Object.entries(consolidatedTotals).map(([item, data]) => {
                const formattedValue = item.includes('Blocos') || item.includes('barras') ? Math.ceil(data.value) : data.value.toFixed(2);
                return [item, `${formattedValue} ${data.unit}`];
            });

             autoTable(doc, {
                startY: currentY,
                head: [['Resumo Geral de Materiais', 'Quantidade Total']],
                body: summaryBody,
                theme: 'grid',
                headStyles: { fillColor: [22, 163, 74] },
            });
        }


        doc.save('relatorio_quantitativo.pdf');
    };

    const handleToggleAll = () => {
        const allVisible = Object.values(visibleCalculators).every(Boolean);
        const newVisibility: Record<CalculatorType, boolean> = {} as any;
        Object.keys(CALCULATOR_OPTIONS).forEach(key => {
            newVisibility[key as CalculatorType] = !allVisible;
        });
        setVisibleCalculators(newVisibility);
    };

    const renderFilterControls = () => {
        const allVisible = Object.values(visibleCalculators).every(Boolean);

        return (
            <div className="flex flex-wrap items-center gap-2">
                <Select value={pavimentoFilter} onValueChange={setPavimentoFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] bg-accent text-black border-accent-foreground/50">
                        <SelectValue placeholder="Filtrar por Pavimento" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos os Pavimentos</SelectItem>
                        {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="bg-[#FF9800] text-black hover:bg-[#FF9800]/90"><RotateCcw className="mr-2 h-4 w-4"/>Limpar Tudo</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Limpar todos os dados?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Todos os dados inseridos em todas as calculadoras serão permanentemente apagados.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetAll}>Sim, limpar tudo</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button onClick={generatePdf} className="bg-[#FFC107] text-black hover:bg-[#FFC107]/90">
                    <Download className="mr-2 h-4 w-4"/>
                    Exportar PDF
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="destructive">
                            <Settings2 className="mr-2 h-4 w-4" />
                            Exibir Calculadoras
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Selecione as calculadoras</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleToggleAll}>
                           {allVisible ? 'Limpar seleção' : 'Selecionar todas'}
                        </DropdownMenuItem>
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
        );
    }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Quantitativo"
          description="Crie orçamentos detalhados para seus projetos."
        />
        {renderFilterControls()}
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Identificação do Projeto</CardTitle>
          <CardDescription>
            Selecione um cliente para associar este orçamento. Esta informação será usada no PDF exportado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-select">Cliente</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select">
                    <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                    {clients.map(client => (
                        <SelectItem key={client.codigo_cliente} value={client.codigo_cliente}>
                            {client.nome_completo}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>


      {calculators.map(({ key, component: Component }) =>
        visibleCalculators[key] ? <Component key={key} pavimentoFilter={pavimentoFilter} ref={calculatorRefs[key]} /> : null
      )}

      {Object.values(visibleCalculators).some(v => v) && (
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mt-4">
            {renderFilterControls()}
        </div>
      )}
    </div>
  );
}
