import { 
  Home, 
  Users, 
  CreditCard, 
  Settings, 
  LogOut, 
  FileText, 
  MessageCircle,
  Activity,
  Building2,
  User
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";

const navigation = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: Home,
    description: "Visão geral do sistema"
  },
  { 
    name: "Médicos", 
    href: "/medicos", 
    icon: Users,
    description: "Gerenciar médicos"
  },
  { 
    name: "Pagamentos", 
    href: "/pagamentos", 
    icon: CreditCard,
    description: "Controle de pagamentos",
    badge: "3"
  },
  { 
    name: "Relatórios", 
    href: "/relatorios", 
    icon: FileText,
    description: "Relatórios e analytics"
  },
];

const toolsNavigation = [
  { 
    name: "Teste WhatsApp", 
    href: "/teste-whatsapp", 
    icon: MessageCircle,
    description: "Testar envio de mensagens"
  },
  { 
    name: "Configurações", 
    href: "/configuracoes", 
    icon: Settings,
    description: "Configurar sistema"
  },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <Sidebar 
      className="border-r border-sidebar-border shadow-lg"
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-poppins font-semibold text-sidebar-foreground text-sm truncate">
                HCC Medical
              </h2>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                Sistema de Pagamentos
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-3 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-3">
              Principal
            </p>
          )}
          <SidebarMenu className="space-y-1">
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.href}
                    className={
                      isActive(item.href)
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.name}</span>
                            {item.badge && (
                              <Badge 
                                variant="secondary" 
                                className="h-5 text-xs bg-primary/10 text-primary border-primary/20"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-sidebar-foreground/60 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Tools Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-3">
              Ferramentas
            </p>
          )}
          <SidebarMenu className="space-y-1">
            {toolsNavigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.href}
                    className={
                      isActive(item.href)
                        ? "sidebar-nav-item-active"
                        : "sidebar-nav-item-inactive"
                    }
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{item.name}</span>
                        <p className="text-xs text-sidebar-foreground/60 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="space-y-3">
          {!collapsed && (
            <div className="px-3 py-2 bg-sidebar-accent/30 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <Activity className="h-3 w-3 text-accent animate-pulse-soft" />
                <span className="text-sidebar-foreground/70">Sistema Online</span>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/perfil'}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
            title={collapsed ? "Meu Perfil" : undefined}
          >
            <User className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Meu Perfil</span>}
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0 transition-transform duration-200 hover:rotate-12" />
            {!collapsed && <span className="ml-2">Sair do Sistema</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}