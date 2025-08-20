
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
        <Card className="col-span-1">
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

const initialSides = { a: '', b: '', c: '', d: '', p: '' };
const sideLabels = {
    a: 'Frente (A)',
    b: 'Lado Direito (B)',
    c: 'Fundo (C)',
    d: 'Lado Esquerdo (D)',
};

type SideKey = keyof typeof sideLabels;

function IrregularAreaCalculator() {
  const [sides, setSides] = useState(initialSides);
  const [area, setArea] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<string | null>(null);
  const [pointCoords, setPointCoords] = useState<{ x: number, y: number }[]>([]);

  const handleSideChange = (side: keyof typeof sides, value: string) => {
    setSides(prev => ({ ...prev, [side]: value }));
  };

  const calculateAreaAndPoints = () => {
    const { a, b, c, d, p } = sides;
    const sideA = parseFloat(a);
    const sideB = parseFloat(b);
    const sideC = parseFloat(c);
    const sideD = parseFloat(d);
    const diagP = parseFloat(p);

    if ([sideA, sideB, sideC, sideD, diagP].some(isNaN)) {
      setError('Todas as medidas devem ser números válidos.');
      setArea(null);
      setPoints(null);
      return;
    }

    // Heron's formula for triangle area
    const heron = (x: number, y: number, z: number) => {
      if (x + y <= z || x + z <= y || y + z <= x) return NaN;
      const s = (x + y + z) / 2;
      return Math.sqrt(s * (s - x) * (s - y) * (s - z));
    };

    const area1 = heron(sideA, sideD, diagP); // Triangle with Frente, Lado Esquerdo, Diagonal
    const area2 = heron(sideB, sideC, diagP); // Triangle with Lado Direito, Fundo, Diagonal

    if (isNaN(area1) || isNaN(area2)) {
      setError('As medidas fornecidas não formam triângulos válidos. Verifique a medida cruzada.');
      setArea(null);
      setPoints(null);
      return;
    }

    setError(null);
    setArea(area1 + area2);

    // Calculate points for drawing
    const p1 = { x: 0, y: 0 };
    const p2 = { x: sideA, y: 0 };

    // Law of cosines to find angles
    // Angle at p1 for triangle (A, D, P)
    const angle1 = Math.acos((sideA * sideA + diagP * diagP - sideD * sideD) / (2 * sideA * diagP));
    // Angle at p2 for triangle (A, B, P') - needs the other diagonal, let's place points differently.

    // Let's place p1 (A-D corner) at origin
    const pA_D = { x: 0, y: 0 }; 
    // Place p2 (A-B corner) on x-axis
    const pA_B = { x: sideA, y: 0 };

    // Calculate position of p3 (D-C corner) using triangle (A,D,P)
    const angle_p1 = Math.acos((sideA*sideA + sideD*sideD - diagP*diagP) / (2 * sideA * sideD));
    if (isNaN(angle_p1)) {
        setError("Não foi possível calcular o ângulo. Verifique as medidas.");
        return;
    }
    const pD_C_Angle = Math.acos((sideD*sideD + diagP*diagP - sideA*sideA) / (2 * sideD * diagP));
    const pD_C = {
        x: sideD * Math.cos(pD_C_Angle),
        y: sideD * Math.sin(pD_C_Angle)
    };

    // Calculate position of p4 (B-C corner) using triangle (A,B,P) is complex.
    // Let's use the other triangle (B,C,P) with p3 and p2
    const angle_p2 = Math.acos((sideA*sideA + diagP*diagP - sideB*sideB) / (2*sideA*diagP));
     const pB_C = {
        x: pA_B.x + sideB * Math.cos(Math.PI - angle_p2),
        y: pA_B.y + sideB * Math.sin(Math.PI - angle_p2)
    };

    const finalPoints = [pA_D, pA_B, pB_C, pD_C];
    
    // Normalize and scale points to fit in the viewbox
    const allX = finalPoints.map(p => p.x);
    const allY = finalPoints.map(p => p.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    const width = maxX - minX;
    const height = maxY - minY;
    
    const padding = 30;
    const svgWidth = 300;
    const svgHeight = 200;

    const scale = Math.min((svgWidth - 2 * padding) / width, (svgHeight - 2 * padding) / height);

    const translatedPoints = finalPoints.map(p => ({
        x: (p.x - minX) * scale + padding,
        y: (p.y - minY) * scale + padding,
    }));
    
    setPointCoords(translatedPoints);
    setPoints(translatedPoints.map(p => `${p.x},${p.y}`).join(' '));
  };
  
  const viewBox = `0 0 300 200`;

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Cálculo de Terreno Irregular (4 Lados)</CardTitle>
        <CardDescription>
          Use a medida cruzada (diagonal) entre cantos opostos (ex: Frente/Esquerda até Fundo/Direita).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(sideLabels) as SideKey[]).map(side => (
              <div key={side} className="space-y-2">
                <Label htmlFor={`side-${side}`}>{sideLabels[side]} (m)</Label>
                <Input id={`side-${side}`} type="number" placeholder="0.00" value={sides[side]} onChange={e => handleSideChange(side, e.target.value)} />
              </div>
            ))}
          </div>
           <div className="space-y-2">
              <Label htmlFor="diagonal-p">Medida Cruzada (Diagonal P)</Label>
              <Input id="diagonal-p" type="number" placeholder="0.00" value={sides.p} onChange={e => handleSideChange('p', e.target.value)} />
           </div>
          <Button onClick={calculateAreaAndPoints} className="w-full" variant="accent">Calcular Área</Button>
           {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="space-y-4">
            <Label>Desenho do Terreno (escala)</Label>
            <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                 {points ? (
                    <svg viewBox={viewBox} className="w-full h-full">
                      <polygon points={points} className="fill-primary/20 stroke-primary stroke-2" />
                      {pointCoords.length === 4 && (
                        <>
                          <text x={(pointCoords[0].x + pointCoords[1].x) / 2} y={(pointCoords[0].y + pointCoords[1].y) / 2 - 5} fill="currentColor" textAnchor="middle" fontSize="10">A</text>
                          <text x={(pointCoords[1].x + pointCoords[2].x) / 2 + 5} y={(pointCoords[1].y + pointCoords[2].y) / 2} fill="currentColor" textAnchor="middle" fontSize="10">B</text>
                          <text x={(pointCoords[2].x + pointCoords[3].x) / 2} y={(pointCoords[2].y + pointCoords[3].y) / 2 + 10} fill="currentColor" textAnchor="middle" fontSize="10">C</text>
                          <text x={(pointCoords[3].x + pointCoords[0].x) / 2 - 5} y={(pointCoords[3].y + pointCoords[0].y) / 2} fill="currentColor" textAnchor="middle" fontSize="10">D</text>
                          <line x1={pointCoords[0].x} y1={pointCoords[0].y} x2={pointCoords[2].x} y2={pointCoords[2].y} className="stroke-destructive/50" strokeWidth="1" strokeDasharray="4"/>
                        </>
                      )}
                    </svg>
                 ) : (
                    <p className="text-sm text-muted-foreground">O desenho aparecerá aqui.</p>
                 )}
            </div>
            {area !== null && (
                 <p className="w-full text-center text-lg font-bold">Área Total: {area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</p>
            )}
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
        <IrregularAreaCalculator />
      </div>
    </div>
  );
}
