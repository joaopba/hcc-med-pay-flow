import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, FileCheck, DollarSign, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

interface DashboardStats {
  totalMedicos: number;
  pagamentosPendentes: number;
  notasRecebidas: number;
  valorTotal: number;
  notasParaPagamento: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMedicos: 0,
    pagamentosPendentes: 0,
    notasRecebidas: 0,
    valorTotal: 0,
    notasParaPagamento: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Total de médicos ativos
      const { data: medicos } = await supabase
        .from("medicos")
        .select("id")
        .eq("ativo", true);

      // Pagamentos pendentes de solicitação
      const { data: pendentes } = await supabase
        .from("pagamentos")
        .select("id, valor")
        .eq("status", "pendente");

      // Notas recebidas (aguardando pagamento)
      const { data: notasRecebidas } = await supabase
        .from("pagamentos")
        .select("id, valor")
        .eq("status", "nota_recebida");

      // Valor total do mês atual
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: pagamentosAtual } = await supabase
        .from("pagamentos")
        .select("valor")
        .eq("mes_competencia", currentMonth);

      const valorTotal = pagamentosAtual?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      setStats({
        totalMedicos: medicos?.length || 0,
        pagamentosPendentes: pendentes?.length || 0,
        notasRecebidas: notasRecebidas?.length || 0,
        valorTotal,
        notasParaPagamento: notasRecebidas?.length || 0,
      });

      // Mostrar notificação se houver notas para pagamento
      if (notasRecebidas && notasRecebidas.length > 0) {
        toast({
          title: "📋 Novas notas recebidas!",
          description: `Você tem ${notasRecebidas.length} nota(s) aguardando pagamento.`,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AppLayout title="Dashboard" subtitle="Visão geral do sistema de pagamentos médicos">
      <div className="p-6 animate-fade-in-up">
        {/* Alerta de novas notas */}
        {stats.notasParaPagamento > 0 && (
          <div className="card-professional mb-6 border-warning bg-warning/5 animate-slide-in-right">
            <div className="flex items-center gap-3 p-4">
              <div className="p-2 bg-warning/20 rounded-lg">
                <Bell className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <span className="font-poppins font-semibold text-warning-foreground">
                  Atenção: {stats.notasParaPagamento} nota(s) aguardando pagamento
                </span>
              </div>
              <Button size="sm" variant="outline" className="hover:bg-warning hover:text-warning-foreground">
                Ver detalhes
              </Button>
            </div>
          </div>
        )}

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card-professional-hover bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Médicos</p>
                <p className="text-3xl font-poppins font-bold text-primary">{stats.totalMedicos}</p>
                <p className="text-sm text-muted-foreground">médicos ativos</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="card-professional-hover bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-poppins font-bold text-warning">{stats.pagamentosPendentes}</p>
                <p className="text-sm text-muted-foreground">solicitações pendentes</p>
              </div>
              <div className="p-3 bg-warning/10 rounded-xl">
                <CreditCard className="h-6 w-6 text-warning" />
              </div>
            </div>
          </div>

          <div className="card-professional-hover bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notas Recebidas</p>
                <p className="text-3xl font-poppins font-bold text-accent">{stats.notasRecebidas}</p>
                <p className="text-sm text-muted-foreground">aguardando pagamento</p>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl">
                <FileCheck className="h-6 w-6 text-accent" />
              </div>
            </div>
          </div>

          <div className="card-professional-hover bg-gradient-to-br from-foreground/5 to-foreground/10 border-foreground/20">
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-poppins font-bold text-foreground">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-sm text-muted-foreground">mês atual</p>
              </div>
              <div className="p-3 bg-foreground/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Cards de resumo e ações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-professional">
            <div className="p-6">
              <h3 className="text-lg font-poppins font-semibold mb-6">Resumo por Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-medium">Pendentes de solicitação</span>
                  <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                    {stats.pagamentosPendentes}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-medium">Notas recebidas</span>
                  <Badge variant="default" className="bg-accent/10 text-accent border-accent/20">
                    {stats.notasRecebidas}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-medium">Processados hoje</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">0</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="card-professional">
            <div className="p-6">
              <h3 className="text-lg font-poppins font-semibold mb-6">Ações Rápidas</h3>
              <div className="space-y-3">
                <Button className="w-full justify-start btn-gradient-primary h-12">
                  <Users className="h-5 w-5 mr-3" />
                  <span className="font-medium">Gerenciar Médicos</span>
                </Button>
                <Button className="w-full justify-start h-12" variant="outline">
                  <CreditCard className="h-5 w-5 mr-3" />
                  <span className="font-medium">Ver Pagamentos</span>
                </Button>
                <Button className="w-full justify-start btn-gradient-accent h-12">
                  <FileCheck className="h-5 w-5 mr-3" />
                  <span className="font-medium">Processar Notas</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}