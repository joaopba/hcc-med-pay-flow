import { Home, Users, CreditCard, Settings, LogOut, FileText, MessageCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Médicos", href: "/medicos", icon: Users },
  { name: "Pagamentos", href: "/pagamentos", icon: CreditCard },
  { name: "Relatórios", href: "/relatorios", icon: FileText },
  { name: "Teste WhatsApp", href: "/teste-whatsapp", icon: MessageCircle },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

export default function AppSidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="HCC" className="h-8 w-auto" />
          <div>
            <h2 className="font-semibold text-sidebar-foreground">HCC Hospital</h2>
            <p className="text-xs text-sidebar-foreground/70">Sistema de Pagamentos</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}