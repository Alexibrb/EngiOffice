
'use client';

import { useCompanyData } from '@/app/dashboard/layout';
import Image from 'next/image';

export function PageHeader({ title, description }: { title: string, description: string }) {
  const companyData = useCompanyData();

  return (
    <div className="flex items-center gap-4 mb-8">
       {companyData?.logoUrl && (
            <Image
                src={companyData.logoUrl}
                alt="Logo da Empresa"
                width={80}
                height={80}
                className="rounded-lg object-contain"
                data-ai-hint="company logo"
            />
        )}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold font-headline text-foreground">{companyData?.companyName}</h1>
        <p className="text-sm text-muted-foreground italic">{companyData?.slogan}</p>
        <p className="text-sm text-muted-foreground mt-1">{companyData?.address}</p>
        <p className="text-sm text-muted-foreground">{companyData?.phone} | {companyData?.cnpj}</p>
      </div>
    </div>
  );
}
