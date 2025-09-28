import { Bell, Search, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-lg transition-colors" />
          
          {title && (
            <div className="hidden md:block">
              <h1 className="text-xl font-poppins font-semibold text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground -mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Center - Search */}
        <div className="hidden lg:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar médicos, pagamentos..."
              className="pl-10 bg-background/50 border-border focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Mobile Search */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-muted"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-muted"
          >
            <Bell className="h-4 w-4" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              3
            </Badge>
          </Button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-sm">
              <p className="font-medium text-foreground">Administrador</p>
              <p className="text-xs text-muted-foreground">HCC Hospital</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}