
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
import { Calculator, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader, TableFooter } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

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
        <Card className="col-span-1 md:col-span-2">
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

const initialPoints = [
    { x: '0', y: '0' },
    { x: '10', y: '0' },
    { x: '10', y: '20' },
    { x: '0', y: '20' },
];

function IrregularAreaCalculator() {
  const [points, setPoints] = useState(initialPoints);
  const [area, setArea] = useState<number | null>(null);

  const handlePointChange = (index: number, axis: 'x' | 'y', value: string) => {
    const newPoints = [...points];
    newPoints[index][axis] = value;
    setPoints(newPoints);
    setArea(null); // Recalculate on change
  };

  const addPoint = () => {
    setPoints([...points, { x: '0', y: '0' }]);
  };

  const removePoint = (index: number) => {
    if (points.length <= 3) return; // Need at least 3 points for a polygon
    const newPoints = points.filter((_, i) => i !== index);
    setPoints(newPoints);
    setArea(null);
  };
  
  const handleReset = () => {
      setPoints(initialPoints);
      setArea(null);
  }

  const calculateArea = () => {
    const numericPoints = points.map(p => ({ x: parseFloat(p.x), y: parseFloat(p.y) }));
    if (numericPoints.some(p => isNaN(p.x) || isNaN(p.y))) {
      setArea(null);
      return;
    }
    
    // Shoelace formula
    let total = 0;
    for (let i = 0; i < numericPoints.length; i++) {
      const currentPoint = numericPoints[i];
      const nextPoint = numericPoints[(i + 1) % numericPoints.length];
      total += (currentPoint.x * nextPoint.y - nextPoint.x * currentPoint.y);
    }
    const calculatedArea = Math.abs(total / 2);
    setArea(calculatedArea);
  };

  const svgData = useMemo(() => {
    const numericPoints = points.map(p => ({ x: parseFloat(p.x) || 0, y: parseFloat(p.y) || 0 }));
    if (numericPoints.length < 3) return { path: '', viewBox: '0 0 300 200', points: [], lines: [] };

    const allX = numericPoints.map(p => p.x);
    const allY = numericPoints.map(p => p.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width === 0 || height === 0) return { path: '', viewBox: '0 0 300 200', points: [], lines: [] };

    const padding = 20;
    const svgWidth = 300;
    const svgHeight = 200;

    const scale = Math.min((svgWidth - 2 * padding) / width, (svgHeight - 2 * padding) / height);

    const translatedPoints = numericPoints.map(p => ({
        x: (p.x - minX) * scale + padding,
        y: svgHeight - ((p.y - minY) * scale + padding), // Flip Y-axis for correct display
    }));

    const lines = [];
    for (let i = 0; i < numericPoints.length; i++) {
        const p1 = numericPoints[i];
        const p2 = numericPoints[(i + 1) % numericPoints.length];
        const translatedP1 = translatedPoints[i];
        const translatedP2 = translatedPoints[(i + 1) % translatedPoints.length];

        const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const midX = (translatedP1.x + translatedP2.x) / 2;
        const midY = (translatedP1.y + translatedP2.y) / 2;
        lines.push({ x: midX, y: midY, length: length.toFixed(2) });
    }
    
    return {
        path: translatedPoints.map(p => `${p.x},${p.y}`).join(' '),
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        points: translatedPoints,
        lines: lines
    };
  }, [points]);


  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle>Cálculo de Área por Coordenadas</CardTitle>
        <CardDescription>
          Insira os vértices (pontos X, Y) do terreno para calcular a área e visualizar o desenho.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
            <div className="pr-2 border rounded-md">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-1/4 p-2">Ponto</TableHead>
                        <TableHead className="w-1/3 p-2">Eixo X (m)</TableHead>
                        <TableHead className="w-1/3 p-2">Eixo Y (m)</TableHead>
                        <TableHead className="w-[40px] p-2"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {points.map((point, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium p-2">P{index + 1}</TableCell>
                            <TableCell className="p-2">
                                <Input type="number" step="0.1" value={point.x} onChange={e => handlePointChange(index, 'x', e.target.value)} />
                            </TableCell>
                            <TableCell className="p-2">
                                <Input type="number" step="0.1" value={point.y} onChange={e => handlePointChange(index, 'y', e.target.value)} />
                            </TableCell>
                             <TableCell className="p-2">
                                <Button variant="ghost" size="icon" onClick={() => removePoint(index)} disabled={points.length <= 3}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
             </Table>
            </div>
            <div className="flex gap-2">
                <Button onClick={addPoint} variant="outline"><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Ponto</Button>
                <Button onClick={handleReset} variant="secondary"><RotateCcw className="mr-2 h-4 w-4"/>Zerar Pontos</Button>
            </div>
             <Button onClick={calculateArea} className="w-full" variant="accent" disabled={points.length < 3}>Calcular Área</Button>
        </div>
        <div className="space-y-4">
            <Label>Desenho do Terreno (escala)</Label>
            <div className="w-full h-56 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                {svgData.path ? (
                    <svg viewBox={svgData.viewBox} className="w-full h-full">
                      <polygon points={svgData.path} className="fill-primary/20 stroke-primary stroke-2" />
                       {svgData.points.map((p, index) => (
                        <g key={`point-${index}`}>
                            <circle cx={p.x} cy={p.y} r="3" className="fill-destructive" />
                            <text x={p.x + 5} y={p.y + 5} className="text-xs font-bold fill-foreground">
                                P{index + 1}
                            </text>
                        </g>
                       ))}
                       {svgData.lines.map((line, index) => (
                         <text key={`line-${index}`} x={line.x} y={line.y} textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-bold fill-foreground stroke-background stroke-[0.5px] paint-order-stroke">
                           {line.length}m
                         </text>
                       ))}
                    </svg>
                 ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">Insira pelo menos 3 pontos com coordenadas válidas para ver o desenho.</p>
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

function BeamReinforcementCalculator() {
    const [span, setSpan] = useState('');
    const [load, setLoad] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [cover, setCover] = useState('2.5');
    const [fck, setFck] = useState('25');
    const [result, setResult] = useState<{ As: number; AsMin: number; suggestions: any[] } | null>(null);

    const steelBars = [
        { diameter: 5.0, area: 0.20 },
        { diameter: 6.3, area: 0.31 },
        { diameter: 8.0, area: 0.50 },
        { diameter: 10.0, area: 0.79 },
        { diameter: 12.5, area: 1.23 },
        { diameter: 16.0, area: 2.01 },
        { diameter: 20.0, area: 3.14 },
        { diameter: 25.0, area: 4.91 },
    ];

    const calculateReinforcement = () => {
        const vao = parseFloat(span);
        const carga = parseFloat(load);
        const bw = parseFloat(width);
        const h = parseFloat(height);
        const c = parseFloat(cover);
        const fckValue = parseInt(fck, 10);

        if (isNaN(vao) || isNaN(carga) || isNaN(bw) || isNaN(h) || isNaN(c) || isNaN(fckValue)) {
            setResult(null);
            return;
        }

        // --- Simplified concrete beam design formulas (NBR 6118) ---
        // units: kN and cm
        
        // 1. Calculate Bending Moment (Mk)
        const Mk = (carga * Math.pow(vao, 2)) / 8; // Result in kNm
        
        // 2. Continue with existing calculation logic
        const fcd = (fckValue / 1.4) * 0.1; // Convert MPa to kN/cm²
        const d = h - c; // Effective depth in cm
        const Md = Mk * 1.4 * 100; // Design moment in kN.cm
        
        // K calculation
        const k = Md / (bw * Math.pow(d, 2) * 0.85 * fcd);
        
        let As;
        if (k > 0.297) { // Domain 3 limit for CA-50
            // Needs compression reinforcement - outside scope of this simple calculator
            As = -1; // Indicate error/warning
        } else {
             const kz = 0.5 * (1 + Math.sqrt(1 - 2 * k));
             const z = kz * d; // Lever arm
             const fyd = (50 / 1.15); // Steel yield strength in kN/cm²
             As = Md / (z * fyd); 
        }

        // Minimum reinforcement area
        const rho_min = Math.max(0.15 / 100, 0.0015);
        const AsMin = rho_min * bw * h;

        const finalAs = Math.max(As, AsMin);

        // Suggest bars
        const suggestions = [];
        for (const numBars of [4, 6, 8, 10]) {
            for (const bar of steelBars) {
                if (numBars * bar.area >= finalAs) {
                    suggestions.push({ num: numBars, bar, totalArea: numBars * bar.area });
                    break;
                }
            }
        }
        
        const bestSuggestion = suggestions.filter(s => s.totalArea >= finalAs).sort((a,b) => a.totalArea - b.totalArea).slice(0, 3);

        setResult({ As: finalAs, AsMin, suggestions: bestSuggestion });
    };

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle>Calculadora de Armadura de Viga</CardTitle>
                <CardDescription>
                    Faça o pré-dimensionamento da armadura longitudinal de vigas biapoiadas com carga distribuída.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="beam-span">Vão da Viga (m)</Label>
                            <Input id="beam-span" type="number" placeholder="Ex: 5" value={span} onChange={(e) => setSpan(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="beam-load">Carga (kN/m)</Label>
                            <Input id="beam-load" type="number" placeholder="Ex: 25" value={load} onChange={(e) => setLoad(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="fck">fck do Concreto</Label>
                            <Select value={fck} onValueChange={setFck}>
                                <SelectTrigger id="fck"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="20">20 MPa</SelectItem>
                                    <SelectItem value="25">25 MPa</SelectItem>
                                    <SelectItem value="30">30 MPa</SelectItem>
                                    <SelectItem value="35">35 MPa</SelectItem>
                                    <SelectItem value="40">40 MPa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="beam-width">Largura (bw)</Label>
                            <Input id="beam-width" type="number" placeholder="cm" value={width} onChange={(e) => setWidth(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="beam-height">Altura (h)</Label>
                            <Input id="beam-height" type="number" placeholder="cm" value={height} onChange={(e) => setHeight(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="beam-cover">Cobrimento</Label>
                            <Input id="beam-cover" type="number" placeholder="cm" value={cover} onChange={(e) => setCover(e.target.value)} />
                        </div>
                    </div>
                    <Button onClick={calculateReinforcement} className="w-full" variant="accent">Calcular Armadura</Button>
                </div>
                <div className="space-y-4">
                     <Label>Resultados</Label>
                      <div className="w-full h-full bg-muted rounded-md flex flex-col items-center justify-center p-4 text-center space-y-4">
                        {result === null && (
                             <p className="text-sm text-muted-foreground">Preencha os dados para ver o resultado.</p>
                        )}
                        {result && result.As === -1 && (
                            <p className="text-destructive font-bold">Viga necessita de armadura dupla. Aumente a altura (h).</p>
                        )}
                        {result && result.As > 0 && (
                            <>
                                <div>
                                    <p className="text-muted-foreground">Área de Aço Mínima</p>
                                    <p className="text-lg font-bold">{result.AsMin.toFixed(2)} cm²</p>
                                </div>
                                 <div>
                                    <p className="text-muted-foreground">Área de Aço Calculada (As)</p>
                                    <p className="text-2xl font-bold text-primary">{result.As.toFixed(2)} cm²</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground mt-2">Sugestões de Bitolas (CA-50)</p>
                                     <div className="flex gap-4 justify-center">
                                     {result.suggestions.map((s, i) => (
                                        <div key={i} className="p-2 border rounded-md bg-background">
                                            <p className="font-bold">{s.num} Ø {s.bar.diameter.toFixed(1)}</p>
                                            <p className="text-xs text-muted-foreground">({s.totalArea.toFixed(2)} cm²)</p>
                                        </div>
                                     ))}
                                     </div>
                                </div>
                            </>
                        )}
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
        <IrregularAreaCalculator />
      </div>
      <div className="grid grid-cols-1 gap-8 mt-8">
        <BeamReinforcementCalculator />
      </div>
    </div>
  );
}
