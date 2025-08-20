
'use client';

import { useState, useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCompanyData } from '../layout';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';


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
  bitola: '3/8',
  quant: 1,
  largura: 0,
  comprimento: 0,
  altura: 0,
  elosHoriz: 0,
  elosVert: 0,
};

const COMPRIMENTO_BARRA_FERRO = 12; // metros
const pavimentoOptions = ['Térreo', 'Pav1', 'Pav2', 'Pav3', 'Pav4', 'Pav5', 'Pav6', 'Pav7', 'Pav8', 'Pav9', 'Pav10'];
const bitolaOptions = ['1/4', '5/16', '3/8', '1/2', '5/8'];

type Totals = {
    [key: string]: number | Record<string, number>;
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

  const handleInputChange = (id: string, field: keyof SapataRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'tipo' || field === 'bitola')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
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
      const dobraCm = 7;
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

const VigamentoCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<VigamentoRow[]>('vigamentosData', [{ ...initialVigamentoRow, id: crypto.randomUUID() }]);

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
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
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

const PilarCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<PilarRow[]>('pilaresData', [{ ...initialPilarRow, id: crypto.randomUUID() }]);

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
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);

  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
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
  espessuraConcreto: number; // cm
  area: number; // m²
};

const initialLajeRow: Omit<LajeRow, 'id'> = {
  pav: 'Térreo',
  descricao: 'Laje 1',
  tipo: 'Laje',
  espessuraConcreto: 0,
  area: 0,
};

const LajeCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<LajeRow[]>('lajesData', [{ ...initialLajeRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialLajeRow, id: crypto.randomUUID(), descricao: `Item ${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof LajeRow, value: string | number) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = (typeof value === 'string' && (field === 'pav' || field === 'descricao' || field === 'tipo')) ? value : parseFloat(String(value)) || 0;
        return { ...row, [field]: parsedValue };
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
        (totals.volume as number) += row.volume;
        (totals.cimento as number) += row.cimento;
        (totals.areia as number) += row.areia;
        (totals.brita as number) += row.brita;
        if (row.tipo === 'Laje') {
            (totals.area as number) += row.area;
        }
    });

    (totals.items as any[]) = calculatedRows.map(row => ({
        descricao: row.descricao,
        tipo: row.tipo,
        volume: row.volume,
        cimento: row.cimento,
        areia: row.areia,
        brita: row.brita,
        area: row.area
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
                    <Select value={row.tipo} onValueChange={(value) => handleInputChange(row.id, 'tipo', value)}>
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
  junta: 1.5,
};

const AlvenariaCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<AlvenariaRow[]>('alvenariaData', [{ ...initialAlvenariaRow, id: crypto.randomUUID() }]);

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
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);
  
  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
      const A = row.area;
      const L = row.larguraBloco / 100; // m
      const H = row.alturaBloco / 100; // m
      const j_cm = row.junta;
      
      const areaBlocoComJunta = (L > 0 && H > 0) ? (L + (j_cm / 100)) * (H + (j_cm / 100)) : 0;
      const N_blocos = areaBlocoComJunta > 0 ? A / areaBlocoComJunta : 0;
      const N_final = N_blocos * (1 + 0.05); // 5% de perda
      
      const V_arg = A * (0.02 * j_cm); 
      const V_final = V_arg * (1 + 0.10); // 10% de perda
      
      const Cc = 430; // kg/m³
      const Ca = 1.2; // m³/m³
      
      const Q_cimento = V_final * Cc;
      const Sacos = Q_cimento > 0 ? Q_cimento / 50 : 0;
      const Q_areia = V_final * Ca;
      

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

const RebocoCalculator = forwardRef<CalculatorRef, CalculatorProps>(({ pavimentoFilter }, ref) => {
  const [rows, setRows] = usePersistentState<RebocoRow[]>('rebocoData', [{ ...initialRebocoRow, id: crypto.randomUUID() }]);

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
  
  const filteredRows = useMemo(() => {
    if (!pavimentoFilter || pavimentoFilter === 'todos') return rows;
    return rows.filter(row => row.pav === pavimentoFilter);
  }, [rows, pavimentoFilter]);
  
  const calculatedRows = useMemo(() => {
    return filteredRows.map(row => {
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

  const calculatorRefs = {
    sapatas: useRef<CalculatorRef>(null),
    vigamentos: useRef<CalculatorRef>(null),
    pilares: useRef<CalculatorRef>(null),
    lajes: useRef<CalculatorRef>(null),
    alvenaria: useRef<CalculatorRef>(null),
    reboco: useRef<CalculatorRef>(null),
  };
  
  const [resetCounters, setResetCounters] = useState<Record<CalculatorType, number>>({
    sapatas: 0,
    vigamentos: 0,
    pilares: 0,
    lajes: 0,
    alvenaria: 0,
    reboco: 0,
  });

  const handleResetAll = () => {
    Object.keys(CALCULATOR_OPTIONS).forEach(key => {
      localStorage.removeItem(`${key}Data`);
    });
    const newCounters = { ...resetCounters };
    (Object.keys(newCounters) as CalculatorType[]).forEach(key => {
        newCounters[key]++;
    });
    setResetCounters(newCounters);
    // We need to trigger a re-render of the children for the localStorage removal to take effect.
    // This is a bit of a hack, but it works with the current structure.
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
        const pageWidth = doc.internal.pageSize.getWidth();
        let currentY = 20;

        // Cabeçalho
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Quantitativos', pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyData?.companyName) {
            doc.text(`Empresa: ${companyData.companyName}`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 5;
        }
        doc.text(`Filtro de Pavimento Aplicado: ${pavimentoFilter === 'todos' ? 'Todos' : pavimentoFilter}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;
        
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

            if (totals.cimento > 0) {
                const value = totals.cimento as number;
                body.push(['Cimento (sacos 50kg)', value.toFixed(2)]);
                consolidatedTotals['Cimento (sacos 50kg)'] = { value: (consolidatedTotals['Cimento (sacos 50kg)']?.value || 0) + value, unit: 'sacos' };
            }
            
            if (totals.areia > 0) {
                 const value = totals.areia as number;
                body.push(['Areia (m³)', value.toFixed(3)]);
                consolidatedTotals['Areia (m³)'] = { value: (consolidatedTotals['Areia (m³)']?.value || 0) + value, unit: 'm³' };
            }
            
            if (totals.brita > 0) {
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

            if (totals.quantFerro3_16 > 0) {
                 const value = totals.quantFerro3_16 as number;
                 const itemName = `Ferro 3/16 (barras)`;
                body.push([itemName, value.toFixed(2)]);
                consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'un' };
            }

             if (totals.blocos > 0) {
                 const value = totals.blocos as number;
                 const itemName = 'Blocos (un)';
                body.push([itemName, Math.ceil(value)]);
                consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'un' };
            }

            if (totals.argamassa > 0) {
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

        if (allTotals.lajes && allTotals.lajes.area > 0) {
             const value = allTotals.lajes.area as number;
             const itemName = 'Área de Laje (m²)';
             consolidatedTotals[itemName] = { value: (consolidatedTotals[itemName]?.value || 0) + value, unit: 'm²' };
        }

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

    const renderFilterControls = () => (
        <div className="flex items-center gap-2">
            <Select value={pavimentoFilter} onValueChange={setPavimentoFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filtrar por Pavimento" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="todos">Todos os Pavimentos</SelectItem>
                    {pavimentoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
            </Select>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline"><RotateCcw className="mr-2 h-4 w-4"/>Limpar Tudo</Button>
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
                        <AlertDialogAction onClick={handleResetAll} variant="destructive">Sim, limpar tudo</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button onClick={generatePdf} variant="outline">
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Quantitativo"
          description="Crie orçamentos detalhados para seus projetos."
        />
        {renderFilterControls()}
      </div>

      {calculators.map(({ key, component: Component }) =>
        visibleCalculators[key] ? <Component key={`${key}-${resetCounters[key]}`} pavimentoFilter={pavimentoFilter} ref={calculatorRefs[key]} /> : null
      )}

      {Object.values(visibleCalculators).some(v => v) && (
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mt-4">
            {renderFilterControls()}
        </div>
      )}
    </div>
  );
}
