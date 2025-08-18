
'use client';

import { useState } from 'react';
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
import { Calculator } from 'lucide-react';

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

function OccupancyRateCalculator() {
  const [buildingArea, setBuildingArea] = useState('');
  const [landArea, setLandArea] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const ba = parseFloat(buildingArea);
    const la = parseFloat(landArea);
    if (!isNaN(ba) && !isNaN(la) && ba > 0 && la > 0 && ba <= la) {
      setResult((ba / la) * 100);
    } else {
      setResult(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxa de Ocupação</CardTitle>
        <CardDescription>Calcule a porcentagem do terreno ocupada pela construção.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="occupancy-building">Área da Edificação (m²)</Label>
            <Input id="occupancy-building" type="number" placeholder="Ex: 150" value={buildingArea} onChange={(e) => setBuildingArea(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupancy-land">Área do Terreno (m²)</Label>
            <Input id="occupancy-land" type="number" placeholder="Ex: 500" value={landArea} onChange={(e) => setLandArea(e.target.value)} />
          </div>
        </div>
        <Button onClick={calculate} className="w-full" variant="accent">Calcular Taxa</Button>
      </CardContent>
      {result !== null && (
        <CardFooter>
          <p className="w-full text-center text-lg font-bold">Taxa de Ocupação: {result.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</p>
        </CardFooter>
      )}
    </Card>
  );
}

function LandUseCalculator() {
  const [totalBuiltArea, setTotalBuiltArea] = useState('');
  const [landArea, setLandArea] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const tba = parseFloat(totalBuiltArea);
    const la = parseFloat(landArea);
    if (!isNaN(tba) && !isNaN(la) && tba > 0 && la > 0) {
      setResult(tba / la);
    } else {
      setResult(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coeficiente de Aproveitamento</CardTitle>
        <CardDescription>Calcule a relação entre a área construída e a área do terreno.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="use-built">Área Total Construída (m²)</Label>
            <Input id="use-built" type="number" placeholder="Ex: 400" value={totalBuiltArea} onChange={(e) => setTotalBuiltArea(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="use-land">Área do Terreno (m²)</Label>
            <Input id="use-land" type="number" placeholder="Ex: 500" value={landArea} onChange={(e) => setLandArea(e.target.value)} />
          </div>
        </div>
        <Button onClick={calculate} className="w-full" variant="accent">Calcular Coeficiente</Button>
      </CardContent>
      {result !== null && (
        <CardFooter>
          <p className="w-full text-center text-lg font-bold">Coeficiente: {result.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
        </CardFooter>
      )}
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
        <OccupancyRateCalculator />
        <LandUseCalculator />
      </div>
    </div>
  );
}
