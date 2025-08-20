
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
  elosHoriz: number;
  elosVert: number;
};

const initialSapataRow: Omit<SapataRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'S1',
  quant: 1,
  largura: 80,
  comprimento: 80,
  altura: 30,
  elosHoriz: 4,
  elosVert: 4,
};

const COMPRIMENTO_BARRA_FERRO = 12; // metros

function SapataCalculator() {
  const [rows, setRows] = useState<SapataRow[]>([{ ...initialSapataRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialSapataRow, id: crypto.randomUUID(), tipo: `S${rows.length + 1}` }]);
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
      const totalBarrasFerro = (totalLinearFerro / COMPRIMENTO_BARRA_FERRO) * 1.1;

      const cimentoSacos = volumeTotal / 0.16;
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
                  <TableCell><Input value={row.pav} onChange={(e) => handleInputChange(row.id, 'pav', e.target.value)} /></TableCell>
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
  comprimento: 5,
  largura: 20,
  altura: 40,
  quantDeFerro: 4,
};


function VigamentoCalculator() {
  const [rows, setRows] = useState<VigamentoRow[]>([{ ...initialVigamentoRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialVigamentoRow, id: crypto.randomUUID(), tipo: `V${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof VigamentoRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = field === 'pav' || field === 'tipo' || field === 'bitola' ? value : parseFloat(value) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      // Convert cm to m for calculations
      const larguraM = row.largura / 100;
      const alturaM = row.altura / 100;
      const comprimentoM = row.comprimento; // Already in meters
      
      const volumeUnitario = larguraM * alturaM * comprimentoM;
      const volumeTotal = volumeUnitario * row.quant;
      
      const totalLinearFerro = (comprimentoM + 0.5) * row.quantDeFerro * row.quant;
      const totalBarrasFerro = totalLinearFerro / COMPRIMENTO_BARRA_FERRO;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      const quantEstribos = (comprimentoM > 0 ? comprimentoM / 0.15 : 0) * row.quant;
      const tamEstriboCm = ((row.largura - 3) + (row.altura - 3)) * 2 + 5;
      const tamEstriboM = tamEstriboCm / 100;
      const totalLinearEstribos = tamEstriboM * quantEstribos;
      const totalBarrasEstribos = totalLinearEstribos / COMPRIMENTO_BARRA_FERRO;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalBarras: totalBarrasFerro,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
        quantEstribos: quantEstribos,
        tamEstribos: tamEstriboCm,
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
                <TableHead>Quant. Estribos</TableHead>
                <TableHead>Tam. Estribos (cm)</TableHead>
                <TableHead className="font-bold bg-primary/10">Ferro 3/16 (barras)</TableHead>
                 <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Input value={row.pav} onChange={(e) => handleInputChange(row.id, 'pav', e.target.value)} /></TableCell>
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
                  <TableCell>{row.quantEstribos.toFixed(2)}</TableCell>
                  <TableCell>{row.tamEstribos.toFixed(2)}</TableCell>
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
                  <TableCell></TableCell>
                  <TableCell></TableCell>
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
  comprimento: number; // m
  largura: number; // cm
  altura: number; // cm
  quantDeFerro: number;
};

const initialPilarRow: Omit<PilarRow, 'id'> = {
  pav: 'Térreo',
  tipo: 'P1',
  bitola: '3/8',
  quant: 1,
  comprimento: 3,
  largura: 20,
  altura: 20,
  quantDeFerro: 4,
};


function PilarCalculator() {
  const [rows, setRows] = useState<PilarRow[]>([{ ...initialPilarRow, id: crypto.randomUUID() }]);

  const handleAddRow = () => {
    setRows([...rows, { ...initialPilarRow, id: crypto.randomUUID(), tipo: `P${rows.length + 1}` }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: string, field: keyof PilarRow, value: string) => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        const parsedValue = field === 'pav' || field === 'tipo' || field === 'bitola' ? value : parseFloat(value) || 0;
        return { ...row, [field]: parsedValue };
      }
      return row;
    });
    setRows(newRows);
  };

  const calculatedRows = useMemo(() => {
    return rows.map(row => {
      // Convert cm to m for calculations
      const larguraM = row.largura / 100;
      const alturaM = row.altura / 100;
      const comprimentoM = row.comprimento; // Already in meters
      
      const volumeUnitario = larguraM * alturaM * comprimentoM;
      const volumeTotal = volumeUnitario * row.quant;
      
      const totalLinearFerro = (comprimentoM + 0.5) * row.quantDeFerro * row.quant;
      const totalBarrasFerro = totalLinearFerro / COMPRIMENTO_BARRA_FERRO;

      const cimentoSacos = volumeTotal > 0 ? volumeTotal / 0.16 : 0;
      const areiaM3 = (cimentoSacos * 5 * 18) / 1000;
      const britaM3 = (cimentoSacos * 6 * 18) / 1000;

      const quantEstribos = (comprimentoM > 0 ? comprimentoM / 0.15 : 0) * row.quant;
      const tamEstriboCm = ((row.largura - 3) + (row.altura - 3)) * 2 + 5;
      const tamEstriboM = tamEstriboCm / 100;
      const totalLinearEstribos = tamEstriboM * quantEstribos;
      const totalBarrasEstribos = totalLinearEstribos / COMPRIMENTO_BARRA_FERRO;

      return {
        ...row,
        volume: volumeTotal,
        totalLinear: totalLinearFerro,
        totalBarras: totalBarrasFerro,
        cimento: cimentoSacos,
        areia: areiaM3,
        brita: britaM3,
        quantEstribos: quantEstribos,
        tamEstribos: tamEstriboCm,
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
                <TableHead>Quant. Estribos</TableHead>
                <TableHead>Tam. Estribos (cm)</TableHead>
                <TableHead className="font-bold bg-primary/10">Ferro 3/16 (barras)</TableHead>
                 <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Input value={row.pav} onChange={(e) => handleInputChange(row.id, 'pav', e.target.value)} /></TableCell>
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
                  <TableCell>{row.quantEstribos.toFixed(2)}</TableCell>
                  <TableCell>{row.tamEstribos.toFixed(2)}</TableCell>
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
                  <TableCell></TableCell>
                  <TableCell></TableCell>
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


export default function QuantitativoPage() {

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Quantitativo"
        description="Crie orçamentos detalhados para seus projetos."
      />
      <SapataCalculator />
      <VigamentoCalculator />
      <PilarCalculator />
    </div>
  );
}
