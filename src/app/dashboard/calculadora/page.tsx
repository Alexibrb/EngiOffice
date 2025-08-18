
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import { Calculator, PlusCircle, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader, TableFooter } from '@/components/ui/table';

function AreaCalculator() {
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const w = parseFloat(width);
    const l = parseFloat(length);
    if (!isNaN(w) && !isNaN(l) && w > 0 && l > 0) {
      setResult(w * l);
    } else {
      setResult(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cálculo de Área</CardTitle>
        <CardDescription>Calcule a área de um espaço retangular.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="area-width">Largura (m)</Label>
            <Input id="area-width" type="number" placeholder="Ex: 10" value={width} onChange={(e) => setWidth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-length">Comprimento (m)</Label>
            <Input id="area-length" type="number" placeholder="Ex: 20" value={length} onChange={(e) => setLength(e.target.value)} />
          </div>
        </div>
        <Button onClick={calculate} className="w-full" variant="accent">Calcular Área</Button>
      </CardContent>
      {result !== null && (
        <CardFooter>
          <p className="w-full text-center text-lg font-bold">Resultado: {result.toLocaleString('pt-BR')} m²</p>
        </CardFooter>
      )}
    </Card>
  );
}

function PricePerSqMCalculator() {
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const a = parseFloat(area);
    const p = parseFloat(price);
    if (!isNaN(a) && !isNaN(p) && a > 0 && p > 0) {
      setResult(a * p);
    } else {
      setResult(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preço por Metro Quadrado</CardTitle>
        <CardDescription>Estime o custo total com base na área e no preço por m².</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price-area">Área Total (m²)</Label>
            <Input id="price-area" type="number" placeholder="Ex: 200" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-sqm">Preço por m² (R$)</Label>
            <Input id="price-sqm" type="number" placeholder="Ex: 1500" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <Button onClick={calculate} className="w-full" variant="accent">Calcular Preço</Button>
      </CardContent>
      {result !== null && (
        <CardFooter>
          <p className="w-full text-center text-lg font-bold">Custo Estimado: R$ {result.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </CardFooter>
      )}
    </Card>
  );
}

const initialAreaFields = [
    { id: 'terreno', label: 'Área do Terreno' },
    { id: 'subsolo', label: 'Área Subsolo' },
    { id: 'terreo', label: 'Área Térreo' },
    { id: 'mezanino', label: 'Área Mezanino' },
];

const initialAreas = {
    terreno: '0.00', subsolo: '0.00', terreo: '0.00', mezanino: '0.00'
};

function AreaAnalysisCalculator() {
    const [areaFields, setAreaFields] = useState(initialAreaFields);
    const [areas, setAreas] = useState<Record<string, string>>(initialAreas);
    const [pavCount, setPavCount] = useState(0);

    const handleAreaChange = (id: string, value: string) => {
        setAreas(prev => ({ ...prev, [id]: value }));
    };

    const addPavement = () => {
        const newPavCount = pavCount + 1;
        const newField = { id: `pav${newPavCount}`, label: `Área ${newPavCount}º pav.` };
        setAreaFields(prev => [...prev, newField]);
        setAreas(prev => ({ ...prev, [newField.id]: '0.00' }));
        setPavCount(newPavCount);
    }
    
    const handleReset = () => {
        setAreaFields(initialAreaFields);
        setAreas(initialAreas);
        setPavCount(0);
    };

    const parsedAreas = useMemo(() => {
        const result: Record<string, number> = {};
        for (const key in areas) {
            result[key] = parseFloat(areas[key]) || 0;
        }
        return result;
    }, [areas]);

    const totalConstruido = useMemo(() => {
        return Object.keys(parsedAreas)
            .filter(key => key !== 'terreno')
            .reduce((sum, key) => sum + parsedAreas[key], 0);
    }, [parsedAreas]);

    const areaComputavel = useMemo(() => {
       return Object.keys(parsedAreas)
            .filter(key => key !== 'terreno' && key !== 'subsolo')
            .reduce((sum, key) => sum + parsedAreas[key], 0);
    }, [parsedAreas]);

    const coeficienteAproveitamento = useMemo(() => {
        if (parsedAreas.terreno > 0) {
            return areaComputavel / parsedAreas.terreno;
        }
        return 0;
    }, [areaComputavel, parsedAreas.terreno]);

    const taxaOcupacao = useMemo(() => {
        if (parsedAreas.terreno > 0) {
            return parsedAreas.terreo / parsedAreas.terreno;
        }
        return 0;
    }, [parsedAreas.terreo, parsedAreas.terreno]);


    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Cálculo de Áreas e Coeficientes</CardTitle>
                <CardDescription>Calcule o total construído, taxa de ocupação e coeficiente de aproveitamento.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                        <Table>
                            <TableBody>
                                {areaFields.map(field => (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium p-2"><Label htmlFor={field.id}>{field.label}</Label></TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                id={field.id}
                                                type="number"
                                                placeholder="0.00"
                                                value={areas[field.id]}
                                                onChange={(e) => handleAreaChange(field.id, e.target.value)}
                                                className="text-right"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                 <TableRow>
                                    <TableCell className="font-bold p-2">Total Construído</TableCell>
                                    <TableCell className="text-right font-bold p-2">{totalConstruido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                         <div className="flex items-center gap-2 mt-4">
                            <Button onClick={addPavement} variant="outline" size="sm">
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Adicionar Pavimento
                            </Button>
                            <Button onClick={handleReset} variant="destructive" size="sm">
                                <RotateCcw className="mr-2 h-4 w-4"/>
                                Zerar Cálculo
                            </Button>
                         </div>
                    </div>
                     <div>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead className="p-2">Índice</TableHead>
                                    <TableHead className="text-right p-2">Resultado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold p-2">C.A (Coeficiente de Aproveitamento)</TableCell>
                                    <TableCell className="text-right text-lg font-bold p-2">{coeficienteAproveitamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold p-2">T.O (Taxa de Ocupação)</TableCell>
                                    <TableCell className="text-right text-lg font-bold p-2">{taxaOcupacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                     </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function CalculadoraPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Calculadora"
        description="Ferramentas rápidas para cálculos de engenharia e arquitetura."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AreaCalculator />
        <PricePerSqMCalculator />
        <AreaAnalysisCalculator />
      </div>
    </div>
  );
}
