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
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de pagamentos médicos
          </p>
        </div>

        {/* Alerta de notas pendentes */}
        {stats.notasParaPagamento > 0 && (
          <Card className="mb-6 border-warning bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                <span className="font-medium">
                  Atenção: {stats.notasParaPagamento} nota(s) aguardando pagamento
                </span>
                <Button size="sm" variant="outline">
                  Ver detalhes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Médicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMedicos}</div>
              <p className="text-xs text-muted-foreground">Médicos ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.pagamentosPendentes}
              </div>
              <p className="text-xs text-muted-foreground">Solicitações pendentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notas Recebidas</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {stats.notasRecebidas}
              </div>
              <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</div>
              <p className="text-xs text-muted-foreground">Mês atual</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo por Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Pendentes de solicitação</span>
                <Badge variant="secondary">{stats.pagamentosPendentes}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Notas recebidas</span>
                <Badge variant="default">{stats.notasRecebidas}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Processados</span>
                <Badge variant="outline">0</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Gerenciar Médicos
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Ver Pagamentos
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileCheck className="h-4 w-4 mr-2" />
                Processar Notas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}