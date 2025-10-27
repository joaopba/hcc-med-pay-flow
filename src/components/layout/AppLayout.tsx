import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import conquistaLogo from "@/assets/conquista-inovacao.png";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader title={title} subtitle={subtitle} />
          <main className="flex-1 overflow-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {children}
            </motion.div>
          </main>
          <footer className="py-4 border-t border-border/30">
            <div className="container mx-auto px-6 flex items-center justify-center gap-3">
              <span className="text-xs text-muted-foreground">Desenvolvido por</span>
              <img 
                src={conquistaLogo} 
                alt="Conquista Inovação" 
                className="h-5 opacity-60 hover:opacity-100 transition-opacity"
              />
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}