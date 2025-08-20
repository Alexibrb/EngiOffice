
'use client';

import { useState, useMemo, useEffect } from 'react';
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
    { x: '20', y: '0' },
    { x: '20', y: '10' },
    { x: '0', y: '10' },
    { x: '0', y: '0' },
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

function MaterialQuantifier() {
  const [serviceType, setServiceType] = useState('concreto');
  const [inputs, setInputs] = useState<Record<string, string>>({
    volume: '1.0',
    perda: '5',
    cimento: '1',
    areia: '2',
    brita: '3',
  });
  const [results, setResults] = useState<Record<string, string | number> | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    setResults(null);
  };

  const calculate = () => {
    const parsedInputs: Record<string, number> = {};
    for (const key in inputs) {
      parsedInputs[key] = parseFloat(inputs[key]) || 0;
    }

    if (serviceType === 'concreto') {
      const { volume, perda, cimento, areia, brita } = parsedInputs;
      if (!volume || volume <= 0 || !cimento || !areia || !brita) {
        setResults(null);
        return;
      }
      
      const volumeComPerdas = volume * (1 + perda / 100);

      const consumoCimento = 350; // kg/m³ para um traço médio
      const consumoAreia = 0.5; // m³/m³
      const consumoBrita = 0.8; // m³/m³
      
      const proporcaoTotal = cimento + areia + brita;
      
      // Ajuste simples baseado no traço. O consumo base é para 1:2:4, ajustamos linearmente.
      // Isso é uma aproximação, mas mais intuitiva.
      const fatorAjuste = (1+2+4) / proporcaoTotal;
      
      const cimentoTotalKg = consumoCimento * fatorAjuste * volumeComPerdas;
      const cimentoTotalSacos = Math.ceil(cimentoTotalKg / 50);
      const areiaTotalM3 = consumoAreia * fatorAjuste * volumeComPerdas;
      const britaTotalM3 = consumoBrita * fatorAjuste * volumeComPerdas;


      setResults({
        'Cimento (sacos 50kg)': cimentoTotalSacos,
        'Areia (m³)': areiaTotalM3.toFixed(3),
        'Brita (m³)': britaTotalM3.toFixed(3),
        'Volume com Perdas (m³)': volumeComPerdas.toFixed(3),
      });
    } else if (serviceType === 'alvenaria') {
        const { area, tipoTijolo, espessuraJunta, perda } = parsedInputs;
        if (!area || !tipoTijolo || tipoTijolo <= 0) {
            setResults(null);
            return;
        }

        // Dimensões do tijolo em metros [comprimento, altura]
        const dimensoes = [[0.19, 0.19], [0.29, 0.19], [0.39, 0.19]];
        const [comp, alt] = dimensoes[tipoTijolo -1];
        const junta = espessuraJunta / 100; // cm para m
        
        const areaTijoloComJunta = (comp + junta) * (alt + junta);
        const tijolosPorM2 = Math.ceil(1 / areaTijoloComJunta);
        const tijolosTotal = Math.ceil(tijolosPorM2 * area * (1 + perda / 100));

        // Volume de argamassa (simplificado)
        const volArgamassaM2 = (1 - (tijolosPorM2 * comp * alt)) * (junta * 10); // A largura do tijolo é ~9cm
        const volArgamassaTotal = volArgamassaM2 * area * (1 + perda / 100);

        setResults({
            'Tijolos/Blocos (un)': tijolosTotal,
            'Volume de Argamassa (m³)': volArgamassaTotal.toFixed(3),
        });

    } else if (serviceType === 'piso') {
        const { area, larguraPiso, comprimentoPiso, espessuraArgamassa, perda } = parsedInputs;
        if (!area || !larguraPiso || !comprimentoPiso || !espessuraArgamassa) {
            setResults(null);
            return;
        }
        
        const areaPecaM2 = (larguraPiso / 100) * (comprimentoPiso / 100);
        const pecasTotal = Math.ceil((area / areaPecaM2) * (1 + perda / 100));

        const volArgamassa = area * (espessuraArgamassa / 100) * (1 + (perda/100) + 0.1); // Adiciona perda + fator de empolamento
        
        setResults({
            'Peças de Piso (un)': pecasTotal,
            'Argamassa de Assentamento (m³)': volArgamassa.toFixed(3),
        });

    } else if (serviceType === 'pintura') {
        const { area, rendimentoTinta, numeroDemaos, perda } = parsedInputs;
         if (!area || !rendimentoTinta || !numeroDemaos) {
            setResults(null);
            return;
        }

        const areaTotalPintura = area * numeroDemaos;
        const litrosNecessarios = (areaTotalPintura / rendimentoTinta) * (1 + perda / 100);

        setResults({
            'Tinta Necessária (litros)': litrosNecessarios.toFixed(2),
        });
    }
  };
  
  useEffect(() => {
    let defaultInputs = {};
    switch(serviceType) {
      case 'concreto':
        defaultInputs = { volume: '1.0', perda: '5', cimento: '1', areia: '2', brita: '3' };
        break;
      case 'alvenaria':
        defaultInputs = { area: '10', tipoTijolo: '1', espessuraJunta: '1', perda: '10' };
        break;
      case 'piso':
        defaultInputs = { area: '20', larguraPiso: '60', comprimentoPiso: '60', espessuraArgamassa: '1', perda: '10' };
        break;
      case 'pintura':
        defaultInputs = { area: '50', rendimentoTinta: '10', numeroDemaos: '2', perda: '15' };
        break;
    }
    setInputs(defaultInputs);
    setResults(null);
  }, [serviceType]);

  const renderInputs = () => {
    switch(serviceType) {
      case 'concreto':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="volume">Volume de Concreto (m³)</Label>
              <Input id="volume" type="number" step="0.01" placeholder="Ex: 1.0" value={inputs.volume || ''} onChange={(e) => handleInputChange('volume', e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="perda">Percentual de Perda (%)</Label>
              <Input id="perda" type="number" step="1" placeholder="Ex: 5" value={inputs.perda || ''} onChange={(e) => handleInputChange('perda', e.target.value)} />
            </div>
            <div>
              <Label>Traço do Concreto (em volume)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="space-y-1">
                  <Label htmlFor="traco-cimento" className="text-xs">Cimento</Label>
                  <Input id="traco-cimento" type="number" value={inputs.cimento || ''} onChange={(e) => handleInputChange('cimento', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="traco-areia" className="text-xs">Areia</Label>
                  <Input id="traco-areia" type="number" value={inputs.areia || ''} onChange={(e) => handleInputChange('areia', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="traco-brita" className="text-xs">Brita</Label>
                  <Input id="traco-brita" type="number" value={inputs.brita || ''} onChange={(e) => handleInputChange('brita', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        );
      case 'alvenaria':
        return (
           <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="alvenaria-area">Área da Parede (m²)</Label>
                <Input id="alvenaria-area" type="number" placeholder="Ex: 10" value={inputs.area || ''} onChange={(e) => handleInputChange('area', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="alvenaria-tijolo">Tipo de Tijolo/Bloco</Label>
                <Select value={inputs.tipoTijolo} onValueChange={(v) => handleInputChange('tipoTijolo', v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">Tijolo 6 furos (9x19x19 cm)</SelectItem>
                        <SelectItem value="2">Tijolo 8 furos (9x19x29 cm)</SelectItem>
                        <SelectItem value="3">Bloco de concreto (9x19x39 cm)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="alvenaria-junta">Espessura Junta (cm)</Label>
                    <Input id="alvenaria-junta" type="number" placeholder="Ex: 1" value={inputs.espessuraJunta || ''} onChange={(e) => handleInputChange('espessuraJunta', e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="alvenaria-perda">Perda (%)</Label>
                    <Input id="alvenaria-perda" type="number" placeholder="Ex: 10" value={inputs.perda || ''} onChange={(e) => handleInputChange('perda', e.target.value)} />
                </div>
            </div>
           </div>
        );
    case 'piso':
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="piso-area">Área do Piso (m²)</Label>
                    <Input id="piso-area" type="number" placeholder="Ex: 20" value={inputs.area || ''} onChange={(e) => handleInputChange('area', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="piso-largura">Largura Peça (cm)</Label>
                        <Input id="piso-largura" type="number" placeholder="Ex: 60" value={inputs.larguraPiso || ''} onChange={(e) => handleInputChange('larguraPiso', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="piso-comprimento">Comprimento Peça (cm)</Label>
                        <Input id="piso-comprimento" type="number" placeholder="Ex: 60" value={inputs.comprimentoPiso || ''} onChange={(e) => handleInputChange('comprimentoPiso', e.target.value)} />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="piso-argamassa">Espessura Argamassa (cm)</Label>
                        <Input id="piso-argamassa" type="number" placeholder="Ex: 1" value={inputs.espessuraArgamassa || ''} onChange={(e) => handleInputChange('espessuraArgamassa', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="piso-perda">Perda (%)</Label>
                        <Input id="piso-perda" type="number" placeholder="Ex: 10" value={inputs.perda || ''} onChange={(e) => handleInputChange('perda', e.target.value)} />
                    </div>
                </div>
            </div>
        );
    case 'pintura':
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pintura-area">Área de Pintura (m²)</Label>
                    <Input id="pintura-area" type="number" placeholder="Ex: 50" value={inputs.area || ''} onChange={(e) => handleInputChange('area', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="pintura-rendimento">Rendimento da Tinta (m²/L)</Label>
                        <Input id="pintura-rendimento" type="number" placeholder="Ex: 10" value={inputs.rendimentoTinta || ''} onChange={(e) => handleInputChange('rendimentoTinta', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="pintura-demaos">Nº de Demãos</Label>
                        <Input id="pintura-demaos" type="number" placeholder="Ex: 2" value={inputs.numeroDemaos || ''} onChange={(e) => handleInputChange('numeroDemaos', e.target.value)} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="pintura-perda">Perda (%)</Label>
                    <Input id="pintura-perda" type="number" placeholder="Ex: 15" value={inputs.perda || ''} onChange={(e) => handleInputChange('perda', e.target.value)} />
                </div>
            </div>
        );
      default:
        return null;
    }
  }

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle>Calculadora de Quantitativos</CardTitle>
        <CardDescription>
          Estime a quantidade de materiais necessários para diferentes tipos de serviço.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-type">Tipo de Serviço</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger id="service-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concreto">Concreto</SelectItem>
                <SelectItem value="alvenaria">Alvenaria</SelectItem>
                <SelectItem value="piso">Piso</SelectItem>
                <SelectItem value="pintura">Pintura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderInputs()}
          <Button onClick={calculate} className="w-full" variant="accent">Calcular Quantidade</Button>
        </div>
        <div className="space-y-4">
          <Label>Resultados Estimados</Label>
          <div className="p-4 bg-muted rounded-md min-h-[200px] flex items-center justify-center">
            {results ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material / Parâmetro</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(results).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{key}</TableCell>
                      <TableCell className="text-right">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Insira os dados e clique em calcular para ver os resultados.
              </p>
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
        <MaterialQuantifier />
      </div>
    </div>
  );
}

    