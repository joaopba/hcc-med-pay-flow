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
      <DialogContent className="glass-card border-border/50 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="gradient-text">Busca Rápida</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar médicos, pagamentos..."
              className="pl-10 glass-effect border-border/50 focus:border-primary/50"
              autoFocus
            />
          </div>

          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <Search className="h-6 w-6" />
              </motion.div>
              <p className="mt-2 text-sm">Buscando...</p>
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum resultado encontrado</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <motion.div
                  key={`${result.type}-${result.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(result)}
                  className="p-4 glass-effect border border-border/50 rounded-xl cursor-pointer hover:border-primary/30 transition-all hover:scale-[1.02] group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-primary rounded-lg group-hover:scale-110 transition-transform">
                      <result.icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {result.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
