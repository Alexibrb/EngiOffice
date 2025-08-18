import { UserNav } from '@/components/user-nav';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import {
  Menu,
} from 'lucide-react';
import { DashboardNav } from './dashboard-nav';

export function Header() {
  return (
    <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
       <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs p-0">
                <DashboardNav />
            </SheetContent>
          </Sheet>
      <div className="flex-1" />
      <UserNav />
    </div>
  );
}
