
'use client';

export function PageHeader({ title, description }: { title: string, description: string }) {

  return (
    <div className="flex items-center justify-between">
      <div className="grid gap-1">
        <h1 className="text-2xl md:text-3xl font-bold font-headline text-foreground tracking-tight">
          {title}
        </h1>
        <p className="text-lg text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
