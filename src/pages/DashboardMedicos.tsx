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
  Cell
} from "recharts";
import { 
  TrendingUp, 
  FileCheck, 
  Clock, 
  DollarSign, 
  Calendar,
  BarChart3,
  Upload,
  AlertTriangle,
  X,
  Building2
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
  temNotaRejeitada?: boolean;
  temNotaPendente?: boolean;
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
  const [showRejectedAlert, setShowRejectedAlert] = useState(false);
  const [rejectedNotes, setRejectedNotes] = useState<any[]>([]);
  const [showConfirmUpload, setShowConfirmUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .substr(0, 14);
  };

  useEffect(() => {
    if (medico && pagamentosPendentes.length > 0) {
      // Mostrar popup automaticamente após 1.5 segundos apenas para pagamentos que realmente precisam de nota
      const pagamentosQueNecessitamNota = pagamentosPendentes.filter(p => 
        !p.temNotaRejeitada && !p.temNotaPendente
      );
      if (pagamentosQueNecessitamNota.length > 0) {
        const timer = setTimeout(() => {
          setSelectedPagamento(pagamentosQueNecessitamNota[0]);
          setShowUploadModal(true);
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
  }, [medico, pagamentosPendentes]);

  // Configurar realtime para atualizações automáticas
  useEffect(() => {
    if (!medico) return;

    const channel = supabase
      .channel('dashboard-medicos-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas_medicos',
          filter: `medico_id=eq.${medico.id}`
        },
        () => {
          console.log('Nota atualizada, recarregando dados...');
          buscarDados();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagamentos',
          filter: `medico_id=eq.${medico.id}`
        },
        () => {
          console.log('Pagamento atualizado, recarregando dados...');
          buscarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [medico]);

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
      const cpfNumeros = cpf.replace(/\D/g, '');

      const { data: result, error: fnError } = await supabase.functions.invoke('get-medico-dados', {
        body: { cpf: cpfNumeros }
      });

      if (fnError || !result?.medico) {
        toast({
          title: "CPF não encontrado",
          description: "Não encontramos um médico ativo com este CPF",
          variant: "destructive",
        });
        return;
      }

      const medicoData = result.medico;
      setMedico(medicoData);

      const pagamentosPendentesData = result.pagamentos || [];

      const pagamentosPendentesProcessados = pagamentosPendentesData?.filter((p: any) => {
        const notasArray = Array.isArray(p.notas_medicos) ? p.notas_medicos : [];
        if (notasArray.length === 0) return true;
        const apenasRejeitadas = notasArray.every((nota: any) => nota.status === 'rejeitado');
        if (apenasRejeitadas) return true;
        const temNotaValidaOuPendente = notasArray.some((nota: any) =>
          nota.status === 'pendente' || nota.status === 'aprovado'
        );
        return !temNotaValidaOuPendente;
      }).map((p: any) => ({
        id: p.id,
        mes_competencia: p.mes_competencia,
        valor: p.valor,
        status: p.status,
        temNotaRejeitada: Array.isArray(p.notas_medicos) ? p.notas_medicos.some((nota: any) => nota.status === 'rejeitado') : false,
        temNotaPendente: Array.isArray(p.notas_medicos) ? p.notas_medicos.some((nota: any) => nota.status === 'pendente') : false
      })) || [];

      setPagamentosPendentes(pagamentosPendentesProcessados);

      const notasData = result.notas || [];
      const notasProcessadas = notasData.map((nota: any) => ({
        id: nota.id,
        status: nota.status,
        nome_arquivo: nota.nome_arquivo,
        created_at: nota.created_at,
        observacoes: nota.observacoes,
        pagamento: {
          valor: nota.pagamentos.valor,
          mes_competencia: nota.pagamentos.mes_competencia
        }
      }));

      setNotas(notasProcessadas);

      const notasRejeitadas = notasProcessadas.filter((n: any) => n.status === 'rejeitado');
      if (notasRejeitadas.length > 0) {
        setRejectedNotes(notasRejeitadas);
        setShowRejectedAlert(true);
      }

      const totalNotas = notasProcessadas.length;
      const notasAprovadas = notasProcessadas.filter((n: any) => n.status === 'aprovado').length;
      const notasPendentes = notasProcessadas.filter((n: any) => n.status === 'pendente').length;
      const rejeitadasCount = notasProcessadas.filter((n: any) => n.status === 'rejeitado').length;

      const valorTotal = notasProcessadas.reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);
      const valorAprovado = notasProcessadas
        .filter((n: any) => n.status === 'aprovado')
        .reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);
      const valorPendente = notasProcessadas
        .filter((n: any) => n.status === 'pendente')
        .reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);

      setStats({
        totalNotas,
        notasAprovadas,
        notasPendentes,
        notasRejeitadas: rejeitadasCount,
        valorTotal,
        valorAprovado,
        valorPendente
      });

      const monthlyData = notasProcessadas.reduce((acc: Record<string, any>, nota: any) => {
        const mes = nota.pagamento.mes_competencia;
        if (!acc[mes]) {
          acc[mes] = { mes, valor: 0, status: nota.status };
        }
        acc[mes].valor += nota.pagamento.valor;
        return acc;
      }, {} as Record<string, any>);

      setChartData((Object.values(monthlyData) as ChartData[]).sort((a, b) => a.mes.localeCompare(b.mes)));

    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar dados",
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
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente Análise</Badge>;
      case 'aprovado':
        return <Badge variant="default"><FileCheck className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">❌ Rejeitado</Badge>;
      case 'enviado':
        return <Badge variant="outline"><Upload className="h-3 w-3 mr-1" />Enviado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusColors = {
    aprovado: '#22c55e',
    pendente: '#f59e0b',
    rejeitado: '#ef4444'
  };

  const handleFileSelection = (file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setShowConfirmUpload(true);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !selectedPagamento) return;

    setUploading(true);
    setShowConfirmUpload(false);
    
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${selectedPagamento.id}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Registrar na tabela notas_medicos - GARANTIR que é do médico correto
      const { error: insertError } = await supabase
        .from("notas_medicos")
        .insert({
          medico_id: medico.id, // SEMPRE usar o médico logado
          pagamento_id: selectedPagamento.id,
          arquivo_url: filePath,
          nome_arquivo: selectedFile.name,
          status: 'pendente'
        });

      if (insertError) {
        // Se der erro, remover o arquivo do storage
        await supabase.storage.from('notas').remove([filePath]);
        throw insertError;
      }

      // Atualizar o pagamento com a URL da nota
      const { error: pagamentoUpdateError } = await supabase
        .from("pagamentos")
        .update({
          status: "nota_recebida",
          nota_pdf_url: filePath,
          data_resposta: new Date().toISOString()
        })
        .eq("id", selectedPagamento.id)
        .eq("medico_id", medico.id); // GARANTIR que é do médico correto

      if (pagamentoUpdateError) {
        console.error('Erro ao atualizar pagamento:', pagamentoUpdateError);
      }

      // Fechar modal e recarregar dados
      setShowUploadModal(false);
      setSelectedPagamento(null);
      setSelectedFile(null);
      buscarDados();

      // Mostrar mensagem de sucesso mais específica
      const isReenvio = selectedPagamento?.temNotaRejeitada;
      toast({
        title: "Sucesso",
        description: isReenvio 
          ? "Nota fiscal reenviada com sucesso! Aguarde a nova análise." 
          : "Nota fiscal enviada com sucesso! Aguarde a análise.",
      });

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
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              HCC HOSPITAL
            </h1>
            <h2 className="text-2xl font-semibold text-primary mb-2">
              Dashboard do Médico
            </h2>
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
        {/* Seção especial para médicos com notas pendentes */}
        {pagamentosPendentes.length > 0 && (
          <div className="mb-8">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <Upload className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">
                      📋 Notas Fiscais Pendentes
                    </h3>
                    <p className="text-amber-700 mb-4">
                      Você tem {pagamentosPendentes.length} pagamento(s) aguardando envio de nota fiscal.
                    </p>
                    <div className="grid gap-3">
                      {pagamentosPendentes.map((pagamento) => (
                        <div key={pagamento.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div>
                            <span className="font-medium">
                              {new Date(pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </span>
                            <span className="text-lg font-bold text-green-600 ml-2">
                              {formatCurrency(pagamento.valor)}
                            </span>
                            {pagamento.temNotaRejeitada && (
                              <Badge variant="destructive" className="ml-2">Rejeitada - Reenviar</Badge>
                            )}
                            {pagamento.temNotaPendente && (
                              <Badge variant="secondary" className="ml-2">Aguardando Análise</Badge>
                            )}
                          </div>
                          <Button
                            onClick={() => {
                              setSelectedPagamento(pagamento);
                              setSelectedFile(null);
                              setShowUploadModal(true);
                            }}
                            size="sm"
                            variant={pagamento.temNotaRejeitada ? "destructive" : pagamento.temNotaPendente ? "secondary" : "default"}
                            disabled={pagamento.temNotaPendente && !pagamento.temNotaRejeitada}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {pagamento.temNotaRejeitada ? "Reenviar Nota" : 
                             pagamento.temNotaPendente ? "Nota Enviada" : "Enviar Nota"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">
                    HCC HOSPITAL
                  </h1>
                  <Badge variant="outline" className="text-xs">
                    Portal Médico
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold text-primary">
                  {medico.nome}
                </h2>
                <p className="text-muted-foreground text-sm">
                  Dashboard personalizado - Notas fiscais e pagamentos
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setMedico(null)}>
              Sair
            </Button>
          </div>
        </div>

        {/* Dialog para notas rejeitadas */}
        <Dialog open={showRejectedAlert} onOpenChange={setShowRejectedAlert}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Notas Fiscais Rejeitadas
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {rejectedNotes.map((nota, index) => (
                <Alert key={index} variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="mt-2">
                    <div className="space-y-2">
                      <p className="font-semibold">
                        Nota Rejeitada - {nota.pagamento?.mes_competencia}
                      </p>
                      <p><strong>Valor:</strong> {formatCurrency(nota.pagamento?.valor || 0)}</p>
                      <p><strong>Motivo da rejeição:</strong></p>
                      <p className="bg-destructive/10 p-2 rounded text-sm">
                        {nota.observacoes || "Não especificado"}
                      </p>
                      <p className="text-sm font-medium">
                        ⚠️ Por favor, corrija os problemas apontados e envie uma nova nota fiscal.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRejectedAlert(false)}
                >
                  Fechar
                </Button>
                <Button 
                  onClick={() => {
                    setShowRejectedAlert(false);
                    const pagamentoRejeitado = pagamentosPendentes.find(p => p.temNotaRejeitada);
                    if (pagamentoRejeitado) {
                      setSelectedPagamento(pagamentoRejeitado);
                      setShowUploadModal(true);
                    }
                  }}
                >
                  Corrigir Agora
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Alerta para notas pendentes */}
        {pagamentosPendentes.length > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Atenção!</strong> Você possui {pagamentosPendentes.length} pagamento(s) que precisam de nota fiscal para liberação.
                  {pagamentosPendentes.some(p => p.temNotaRejeitada) && (
                    <div className="mt-1 text-sm">
                      ⚠️ Algumas notas foram rejeitadas e precisam ser reenviadas.
                    </div>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
                  onClick={() => {
                    setSelectedPagamento(pagamentosPendentes[0]);
                    setShowUploadModal(true);
                  }}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {pagamentosPendentes.some(p => p.temNotaRejeitada) ? 'Reenviar Nota' : 'Enviar Nota'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Valores por mês */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Valores por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), "Valor"]}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Bar dataKey="valor" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Status das Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de notas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Histórico de Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notas.map((nota) => (
                <div key={nota.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{nota.nome_arquivo}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(nota.created_at).toLocaleDateString('pt-BR')} • 
                        {new Date(nota.pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(nota.status)}
                      </div>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5 text-primary" />
                {selectedPagamento?.temNotaRejeitada ? 'Reenviar Nota Fiscal' : 'Enviar Nota Fiscal'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedPagamento && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Detalhes do Pagamento</h4>
                    {selectedPagamento.temNotaRejeitada && (
                      <Badge variant="destructive" className="text-xs">
                        Nota Rejeitada - Reenvio Necessário
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Competência:</span>
                      <p className="font-medium">
                        {new Date(selectedPagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor:</span>
                      <p className="font-medium text-primary">
                        {formatCurrency(selectedPagamento.valor)}
                      </p>
                    </div>
                  </div>
                  {selectedPagamento.temNotaRejeitada && (
                    <Alert className="mt-3 border-red-200 bg-red-50">
                      <X className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-sm">
                        A nota anterior foi rejeitada. Envie uma nova nota fiscal corrigida.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Arquivo PDF da Nota Fiscal</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelection(file);
                    }
                  }}
                  disabled={uploading}
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Apenas arquivos PDF são aceitos</li>
                    <li>Certifique-se de que todos os dados estão corretos</li>
                    <li>A nota deve corresponder ao valor e período informado</li>
                    {selectedPagamento?.temNotaRejeitada && (
                      <li className="text-red-600 font-medium">Corrija os problemas da nota anterior antes de reenviar</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              {uploading && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Enviando arquivo...</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmação de upload */}
        <Dialog open={showConfirmUpload} onOpenChange={setShowConfirmUpload}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Confirmar Envio
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Arquivo selecionado:</h4>
                <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tamanho: {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : 0} MB
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Confirme antes de enviar:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• O arquivo está correto e completo?</li>
                  <li>• Os dados conferem com o pagamento?</li>
                  <li>• O PDF não possui problemas de visualização?</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowConfirmUpload(false);
                    setSelectedFile(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                >
                  {uploading ? "Enviando..." : "Confirmar e Enviar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}