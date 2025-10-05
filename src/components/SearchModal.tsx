import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface SearchResult {
  id: string;
  type: "medico" | "pagamento";
  title: string;
  subtitle: string;
  icon: typeof User;
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const results: SearchResult[] = [];

      // Search médicos
      const { data: medicos } = await supabase
        .from("medicos")
        .select("id, nome, especialidade, numero_whatsapp")
        .or(`nome.ilike.%${searchQuery}%,numero_whatsapp.ilike.%${searchQuery}%`)
        .limit(5);

      if (medicos) {
        medicos.forEach((medico) => {
          results.push({
            id: medico.id,
            type: "medico",
            title: medico.nome,
            subtitle: `${medico.especialidade || 'Especialidade não informada'} • ${medico.numero_whatsapp}`,
            icon: User,
          });
        });
      }

      // Search pagamentos
      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select(`
          id,
          mes_competencia,
          valor,
          status,
          medicos!inner (
            nome
          )
        `)
        .or(`mes_competencia.ilike.%${searchQuery}%`)
        .limit(5);

      if (pagamentos) {
        pagamentos.forEach((pagamento: any) => {
          results.push({
            id: pagamento.id,
            type: "pagamento",
            title: `Pagamento - ${pagamento.medicos.nome}`,
            subtitle: `${pagamento.mes_competencia} • R$ ${pagamento.valor.toLocaleString('pt-BR')} • ${pagamento.status}`,
            icon: CreditCard,
          });
        });
      }

      setResults(results);
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === "medico") {
      navigate("/medicos");
    } else {
      navigate("/pagamentos");
    }
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-3xl p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-background p-6 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="gradient-text text-2xl flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-xl">
                <Search className="h-5 w-5 text-primary-foreground" />
              </div>
              Busca Rápida
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Pesquise por médicos, pagamentos e mais...
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para buscar..."
              className="pl-12 pr-4 h-12 glass-effect border-border/50 focus:border-primary/50 rounded-xl text-base"
              autoFocus
            />
            {query.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <kbd className="inline-flex h-6 select-none items-center gap-1 rounded-lg border border-border/50 bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                  ESC
                </kbd>
              </motion.div>
            )}
          </div>

          {query.length < 2 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center space-y-4"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-primary blur-2xl opacity-20 rounded-full" />
                <div className="relative p-4 glass-effect rounded-2xl border border-border/50">
                  <Search className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Comece a digitar para pesquisar</p>
                <p className="text-xs text-muted-foreground">
                  Mínimo de 2 caracteres necessários
                </p>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <div className="p-4 glass-effect rounded-2xl border border-border/50">
                  <Search className="h-8 w-8 text-primary" />
                </div>
              </motion.div>
              <p className="text-sm font-medium text-muted-foreground">Buscando resultados...</p>
            </motion.div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 text-center space-y-4"
            >
              <div className="relative inline-block">
                <div className="p-4 glass-effect rounded-2xl border border-border/50">
                  <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Nenhum resultado encontrado</p>
                <p className="text-xs text-muted-foreground">
                  Tente buscar por outro termo
                </p>
              </div>
            </motion.div>
          )}

          {!loading && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {results.length} Resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {results.map((result, index) => (
                  <motion.div
                    key={`${result.type}-${result.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(result)}
                    className="relative p-4 glass-effect border border-border/50 rounded-xl cursor-pointer hover:border-primary/40 transition-all group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-4">
                      <div className="flex-shrink-0 p-3 bg-gradient-primary rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                        <result.icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate text-base">
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {result.subtitle}
                        </p>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        whileHover={{ opacity: 1, x: 0 }}
                        className="flex-shrink-0"
                      >
                        <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border/50 bg-muted font-mono text-xs font-medium text-muted-foreground">
                          ↵
                        </kbd>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/50 glass-effect">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↑↓
                </kbd>
                <span>Navegar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↵
                </kbd>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ESC
                </kbd>
                <span>Fechar</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="opacity-70">Powered by</span>
              <span className="font-semibold gradient-text">HCC</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
