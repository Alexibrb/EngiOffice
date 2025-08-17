
'use client';

import { useState } from 'react';
import { suggestTimeline } from '@/ai/flows/smart-timeline-suggestions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function TimelineSugestoesPage() {
  const [description, setDescription] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuggestion('');

    try {
      const result = await suggestTimeline({ serviceDescription: description });
      setSuggestion(result.suggestedTimeline);
    } catch (err) {
      setError('Ocorreu um erro ao gerar a sugestão. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader 
        title="Sugestões de Timeline com IA"
        description="Descreva um serviço e deixe a inteligência artificial criar uma proposta de cronograma."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Descrição do Serviço</CardTitle>
            <CardDescription>
              Forneça o máximo de detalhes para uma sugestão mais precisa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid w-full gap-4">
                <Label htmlFor="service-description">Descrição</Label>
                <Textarea
                  id="service-description"
                  placeholder="Ex: Construção de um edifício residencial de 5 andares com área total de 1500m², incluindo fundação, estrutura de concreto, e acabamentos."
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !description} variant="accent">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Sugestão
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Timeline Sugerida</CardTitle>
            <CardDescription>
              Esta é uma estimativa e deve ser revisada por um profissional.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!isLoading && !suggestion && !error && (
              <div className="text-center text-muted-foreground">
                <Sparkles className="mx-auto h-12 w-12 text-gray-300" />
                <p>A sua sugestão de timeline aparecerá aqui.</p>
              </div>
            )}
            {suggestion && (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap font-body">
                {suggestion}
              </div>
            )}
             {isLoading && (
              <div className="text-center text-muted-foreground animate-pulse">
                <Sparkles className="mx-auto h-12 w-12 text-gray-300" />
                <p>Analisando e construindo o cronograma...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
