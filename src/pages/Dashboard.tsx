import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, FileCheck, DollarSign, Bell, TrendingUp, Activity, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

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

  // Mock data for charts
  const revenueData = [
    { month: 'Jan', valor: 145000, meta: 150000 },
    { month: 'Fev', valor: 168000, meta: 160000 },
    { month: 'Mar', valor: 152000, meta: 170000 },
    { month: 'Abr', valor: 189000, meta: 180000 },
    { month: 'Mai', valor: 203000, meta: 190000 },
    { month: 'Jun', valor: 197000, meta: 200000 },
  ];

  const statusData = [
    { name: 'Aprovados', value: 65, color: 'hsl(142 70% 50%)' },
    { name: 'Pendentes', value: 20, color: 'hsl(43 90% 60%)' },
    { name: 'Rejeitados', value: 8, color: 'hsl(0 85% 60%)' },
    { name: 'Em análise', value: 7, color: 'hsl(200 85% 55%)' },
  ];

  const activityData = [
    { day: 'Seg', pagamentos: 12, notas: 8 },
    { day: 'Ter', pagamentos: 15, notas: 12 },
    { day: 'Qua', pagamentos: 8, notas: 6 },
    { day: 'Qui', pagamentos: 18, notas: 14 },
    { day: 'Sex', pagamentos: 22, notas: 18 },
    { day: 'Sáb', pagamentos: 5, notas: 3 },
    { day: 'Dom', pagamentos: 2, notas: 1 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border-border/50">
          <p className="text-foreground font-semibold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('alor') || entry.name.includes('eta') 
                ? formatCurrency(entry.value) 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout title="Dashboard Executivo" subtitle="Análise completa do sistema de pagamentos">
      <div className="p-6 space-y-6">
        {/* Alert Banner */}
        {stats.notasParaPagamento > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card border-warning/50 bg-gradient-to-r from-warning/10 to-warning/5"
          >
            <div className="flex items-center gap-4 p-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-3 bg-warning/20 rounded-xl"
              >
                <Bell className="h-5 w-5 text-warning" />
              </motion.div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Atenção Necessária</h4>
                <p className="text-sm text-muted-foreground">
                  {stats.notasParaPagamento} nota(s) fiscal aguardando processamento e pagamento
                </p>
              </div>
              <Button className="btn-premium-primary">
                Ver Detalhes
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-premium group"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-primary rounded-xl group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-1 text-success text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  +12%
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Médicos Ativos</h3>
              <p className="text-3xl font-bold gradient-text mb-1">{stats.totalMedicos}</p>
              <p className="text-xs text-muted-foreground">Total cadastrado no sistema</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-premium group"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-warning to-warning/60 rounded-xl group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-warning-foreground" />
                </div>
                <div className="flex items-center gap-1 text-warning text-sm font-semibold">
                  <Activity className="h-4 w-4" />
                  Ativo
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Solicitações Pendentes</h3>
              <p className="text-3xl font-bold text-warning mb-1">{stats.pagamentosPendentes}</p>
              <p className="text-xs text-muted-foreground">Aguardando análise inicial</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-premium group"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-accent to-accent/60 rounded-xl group-hover:scale-110 transition-transform">
                  <FileCheck className="h-6 w-6 text-accent-foreground" />
                </div>
                <div className="flex items-center gap-1 text-info text-sm font-semibold">
                  <ArrowUpRight className="h-4 w-4" />
                  +8
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Notas Fiscais</h3>
              <p className="text-3xl font-bold text-accent mb-1">{stats.notasRecebidas}</p>
              <p className="text-xs text-muted-foreground">Recebidas e validadas</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-premium group"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-success to-success/60 rounded-xl group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6 text-success-foreground" />
                </div>
                <div className="flex items-center gap-1 text-success text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  +23%
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Valor Total</h3>
              <p className="text-2xl font-bold text-success mb-1">{formatCurrency(stats.valorTotal)}</p>
              <p className="text-xs text-muted-foreground">Volume do mês atual</p>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Revenue Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="xl:col-span-2 card-premium"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Evolução de Receita</h3>
                  <p className="text-sm text-muted-foreground">Comparativo com meta mensal</p>
                </div>
                <Badge className="badge-premium bg-success/10 text-success border-success/30">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +15.3%
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(220 90% 56%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(220 90% 56%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(270 80% 65%)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(270 80% 65%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="valor" 
                    name="Valor Real"
                    stroke="hsl(220 90% 56%)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValor)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="meta" 
                    name="Meta"
                    stroke="hsl(270 80% 65%)" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1} 
                    fill="url(#colorMeta)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Status Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="card-premium"
          >
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground">Distribuição por Status</h3>
                <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {statusData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                      <p className="text-sm font-semibold text-foreground">{item.value}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Activity and Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Weekly Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card-premium"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Atividade Semanal</h3>
                  <p className="text-sm text-muted-foreground">Pagamentos vs Notas Fiscais</p>
                </div>
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="day" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="pagamentos" 
                    name="Pagamentos"
                    fill="hsl(220 90% 56%)" 
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="notas" 
                    name="Notas"
                    fill="hsl(250 85% 60%)" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="card-premium"
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-6">Ações Rápidas</h3>
              <div className="space-y-3">
                <Button className="w-full justify-between btn-premium-primary h-14 text-base group">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <span className="font-semibold">Gerenciar Médicos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button className="w-full justify-between btn-premium-secondary h-14 text-base group">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5" />
                    <span className="font-semibold">Processar Pagamentos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button className="w-full justify-between btn-premium-secondary h-14 text-base group">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-5 w-5" />
                    <span className="font-semibold">Validar Notas Fiscais</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button className="w-full justify-between btn-premium-secondary h-14 text-base group">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5" />
                    <span className="font-semibold">Relatórios Analíticos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}