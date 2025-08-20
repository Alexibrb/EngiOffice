
'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function QuantitativoPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Quantitativo"
        description="Crie orçamentos detalhados para seus projetos."
      />
      <Card>
        <CardHeader>
            <CardTitle>Nova Calculadora de Quantitativos</CardTitle>
            <CardDescription>
                Vamos começar a construir a nova ferramenta de quantitativos aqui.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Em breve...</p>
        </CardContent>
      </Card>
    </div>
  );
}
