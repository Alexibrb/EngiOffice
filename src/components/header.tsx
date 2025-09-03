
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import {
  Menu,
} from 'lucide-react';
import { MobileNav } from './mobile-nav';

export function Header() {
  return (
    <div className="flex h-14 items-center gap-4 sm:px-6 md:hidden">
       <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs p-0">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
              </SheetHeader>
              <MobileNav />
            </SheetContent>
          </Sheet>
      <div className="flex-1" />
    </div>
  );
}
