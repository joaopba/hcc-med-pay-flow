import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  TrendingUp, 
  FileCheck, 
  Clock, 
  DollarSign, 
  Calendar,
  Download,
  BarChart3,
  Upload,
  AlertTriangle,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MedicoStats {
  totalNotas: number;
  notasAprovadas: number;
  notasPendentes: number;
  notasRejeitadas: number;
  valorTotal: number;
  valorAprovado: number;
  valorPendente: number;
}

interface NotaData {
  id: string;
  status: string;
  nome_arquivo: string;
  created_at: string;
  observacoes: string;
  pagamento: {
    valor: number;
    mes_competencia: string;
  };
}

interface ChartData {
  mes: string;
  valor: number;
  status: string;
}

interface PagamentoPendente {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
}

export default function DashboardMedicos() {
  const [cpf, setCpf] = useState("");
  const [medico, setMedico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MedicoStats>({
    totalNotas: 0,
    notasAprovadas: 0,
    notasPendentes: 0,
    notasRejeitadas: 0,
    valorTotal: 0,
    valorAprovado: 0,
    valorPendente: 0
  });
  const [notas, setNotas] = useState<NotaData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pagamentosPendentes, setPagamentosPendentes] = useState<PagamentoPendente[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState<PagamentoPendente | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .substr(0, 14);
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
  };

  const buscarDados = async () => {
    if (!cpf || cpf.length < 14) {
      toast({
        title: "Erro",
        description: "Digite um CPF válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar médico pelo CPF
      const cpfNumeros = cpf.replace(/\D/g, '');
      const { data: medicoData, error: medicoError } = await supabase
        .from("medicos")
        .select("*")
        .eq("cpf", cpfNumeros)
        .eq("ativo", true)
        .single();

      if (medicoError || !medicoData) {
        toast({
          title: "CPF não encontrado",
          description: "Não encontramos um médico ativo com este CPF",
          variant: "destructive",
        });
        return;
      }

      setMedico(medicoData);

      // Buscar pagamentos pendentes sem notas
      const { data: pagamentosPendentesData, error: pagamentosError } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("medico_id", medicoData.id)
        .in("status", ["pendente", "solicitado"])
        .is("nota_pdf_url", null)
        .order("mes_competencia", { ascending: false });

      if (pagamentosError) throw pagamentosError;

      const pagamentosPendentesProcessados = pagamentosPendentesData?.map(p => ({
        id: p.id,
        mes_competencia: p.mes_competencia,
        valor: p.valor,
        status: p.status
      })) || [];

      setPagamentosPendentes(pagamentosPendentesProcessados);

      // Buscar todas as notas do médico
      const { data: notasData, error: notasError } = await supabase
        .from("notas_medicos")
        .select(`
          *,
          pagamentos!inner (
            valor,
            mes_competencia
          )
        `)
        .eq("medico_id", medicoData.id)
        .order("created_at", { ascending: false });

      if (notasError) throw notasError;

      const notasProcessadas = notasData?.map(nota => ({
        id: nota.id,
        status: nota.status,
        nome_arquivo: nota.nome_arquivo,
        created_at: nota.created_at,
        observacoes: nota.observacoes,
        pagamento: {
          valor: nota.pagamentos.valor,
          mes_competencia: nota.pagamentos.mes_competencia
        }
      })) || [];

      setNotas(notasProcessadas);

      // Calcular estatísticas
      const totalNotas = notasProcessadas.length;
      const notasAprovadas = notasProcessadas.filter(n => n.status === 'aprovado').length;
      const notasPendentes = notasProcessadas.filter(n => n.status === 'pendente').length;
      const notasRejeitadas = notasProcessadas.filter(n => n.status === 'rejeitado').length;
      
      const valorTotal = notasProcessadas.reduce((sum, nota) => sum + nota.pagamento.valor, 0);
      const valorAprovado = notasProcessadas
        .filter(n => n.status === 'aprovado')
        .reduce((sum, nota) => sum + nota.pagamento.valor, 0);
      const valorPendente = notasProcessadas
        .filter(n => n.status === 'pendente')
        .reduce((sum, nota) => sum + nota.pagamento.valor, 0);

      setStats({
        totalNotas,
        notasAprovadas,
        notasPendentes,
        notasRejeitadas,
        valorTotal,
        valorAprovado,
        valorPendente
      });

      // Preparar dados para gráficos
      const chartDataMap = new Map();
      notasProcessadas.forEach(nota => {
        const mes = new Date(nota.pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: '2-digit' 
        });
        if (!chartDataMap.has(mes)) {
          chartDataMap.set(mes, { mes, valor: 0, aprovado: 0, pendente: 0, rejeitado: 0 });
        }
        const current = chartDataMap.get(mes);
        current.valor += nota.pagamento.valor;
        current[nota.status] = (current[nota.status] || 0) + nota.pagamento.valor;
      });

      setChartData(Array.from(chartDataMap.values()).slice(-6));

      toast({
        title: "Sucesso",
        description: `Dados carregados para ${medicoData.nome}`,
      });

      // Mostrar modal se houver pagamentos pendentes
      if (pagamentosPendentesProcessados.length > 0) {
        setTimeout(() => {
          setShowUploadModal(true);
        }, 1000);
      }

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="default"><FileCheck className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">❌ Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusColors = {
    aprovado: '#22c55e',
    pendente: '#f59e0b',
    rejeitado: '#ef4444'
  };

  const handleFileUpload = async (pagamentoId: string, file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${pagamentoId}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Registrar na tabela notas_medicos
      const { error: insertError } = await supabase
        .from("notas_medicos")
        .insert({
          medico_id: medico.id,
          pagamento_id: pagamentoId,
          arquivo_url: filePath,
          nome_arquivo: file.name,
          status: 'pendente'
        });

      if (insertError) {
        // Se der erro, remover o arquivo do storage
        await supabase.storage.from('notas').remove([filePath]);
        throw insertError;
      }

      toast({
        title: "Sucesso",
        description: "Nota fiscal enviada com sucesso! Aguarde a análise.",
      });

      // Fechar modal e recarregar dados
      setShowUploadModal(false);
      setSelectedPagamento(null);
      buscarDados();

    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha no upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const pieData = [
    { name: 'Aprovadas', value: stats.notasAprovadas, color: statusColors.aprovado },
    { name: 'Pendentes', value: stats.notasPendentes, color: statusColors.pendente },
    { name: 'Rejeitadas', value: stats.notasRejeitadas, color: statusColors.rejeitado }
  ].filter(item => item.value > 0);

  if (!medico) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard do Médico
            </h1>
            <p className="text-muted-foreground">
              Visualize suas estatísticas, notas fiscais e valores
            </p>
          </div>

          <Card>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">Acesso por CPF</CardTitle>
              <p className="text-sm text-muted-foreground">
                Digite seu CPF para visualizar seu dashboard
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCPFChange}
                    maxLength={14}
                    className="text-lg text-center"
                  />
                </div>
                <Button 
                  onClick={buscarDados} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Carregando..." : "📊 Acessar Dashboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Dashboard - {medico.nome}
              </h1>
              <p className="text-muted-foreground">
                Visão geral das suas notas fiscais e pagamentos
              </p>
            </div>
            <Button variant="outline" onClick={() => setMedico(null)}>
              Sair
            </Button>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNotas}</div>
              <p className="text-xs text-muted-foreground">
                Notas enviadas no total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</div>
              <p className="text-xs text-muted-foreground">
                Valor total dos pagamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Aprovado</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.valorAprovado)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.notasAprovadas} notas aprovadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(stats.valorPendente)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.notasPendentes} notas pendentes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerta de pagamentos pendentes */}
        {pagamentosPendentes.length > 0 && (
          <Alert className="mb-8 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong className="text-yellow-800">
                  Atenção! Você possui {pagamentosPendentes.length} pagamento(s) pendente(s) de nota fiscal.
                </strong>
                <p className="text-yellow-700 mt-1">
                  Clique no botão ao lado para enviar suas notas fiscais agora.
                </p>
              </div>
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="ml-4 bg-yellow-600 hover:bg-yellow-700"
              >
                📄 Enviar Notas Agora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Gráfico de barras por mês */}
          <Card>
            <CardHeader>
              <CardTitle>Valores por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de pizza - Status das notas */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Lista de notas recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Histórico de Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notas.slice(0, 10).map((nota) => (
                <div key={nota.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{nota.nome_arquivo}</h4>
                      {getStatusBadge(nota.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Competência:</strong> {new Date(nota.pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                      <p>
                        <strong>Enviado em:</strong> {new Date(nota.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      {nota.observacoes && (
                        <p className="text-destructive">
                          <strong>Observações:</strong> {nota.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(nota.pagamento.valor)}
                    </p>
                  </div>
                </div>
              ))}
              
              {notas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma nota fiscal encontrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal para upload de notas */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Upload className="h-6 w-6 text-primary" />
                📄 Enviar Notas Fiscais Pendentes
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <strong className="text-yellow-800">
                    Você possui {pagamentosPendentes.length} pagamento(s) aguardando documentação!
                  </strong>
                  <p className="text-yellow-700 mt-1">
                    Envie as notas fiscais correspondentes aos valores abaixo para liberar seus pagamentos.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {pagamentosPendentes.map((pagamento) => (
                  <Card key={pagamento.id} className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg text-primary">
                            {new Date(pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </CardTitle>
                          <p className="text-3xl font-bold text-green-600 mt-2">
                            {formatCurrency(pagamento.valor)}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-yellow-50">
                          Aguardando Nota
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-2">
                            📋 Instruções para envio:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Arquivo deve estar em formato PDF</li>
                            <li>• Nota fiscal deve corresponder ao valor: <strong>{formatCurrency(pagamento.valor)}</strong></li>
                            <li>• Competência: <strong>{new Date(pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong></li>
                          </ul>
                        </div>

                        <div className="pt-2 border-t">
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(pagamento.id, file);
                              }
                            }}
                            disabled={uploading}
                            className="hidden"
                            id={`file-${pagamento.id}`}
                          />
                          <Label htmlFor={`file-${pagamento.id}`} className="cursor-pointer">
                            <div className="w-full p-6 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/50 transition-colors bg-primary/5 hover:bg-primary/10">
                              <div className="text-center">
                                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                                <p className="font-medium text-primary">
                                  {uploading ? "Enviando..." : "📄 Clique para enviar a nota fiscal"}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Valor: {formatCurrency(pagamento.valor)} | Apenas arquivos PDF
                                </p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}