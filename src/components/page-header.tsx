
'use client';

import { useCompanyData } from '@/app/dashboard/layout';
import Image from 'next/image';

export function PageHeader({ title, description }: { title: string, description: string }) {
  const companyData = useCompanyData();

  return (
    <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        {companyData?.logoUrl && (
          <Image
            src={companyData.logoUrl}
            alt="Logo da Empresa"
            width={64}
            height={64}
            className="rounded-lg object-contain"
            data-ai-hint="company logo"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="text-right text-sm text-muted-foreground">
        <p className="font-bold text-card-foreground">{companyData?.companyName}</p>
        <p>{companyData?.slogan}</p>
        <p>{companyData?.address}</p>
        <p>{companyData?.phone} | {companyData?.cnpj}</p>
      </div>
    </div>
  );
}
