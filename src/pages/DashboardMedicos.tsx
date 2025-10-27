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
  Building2,
  Moon,
  Sun
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMesCompetencia } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import logo from "@/assets/logo.png";
import ChatWithFinanceiro from "@/components/ChatWithFinanceiro";
import TicketHistory from "@/components/TicketHistory";
import RatingDialog from "@/components/RatingDialog";
import conquistaLogo from "@/assets/conquista-inovacao.png";

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
    data_pagamento?: string;
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
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<any>(null);
  const [valorLiquido, setValorLiquido] = useState("");
  const [ocrHabilitado, setOcrHabilitado] = useState(false);
  const [modoManutencao, setModoManutencao] = useState(false);
  const [mensagemManutencao, setMensagemManutencao] = useState("");
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const formatCPF = (value: string) => {
    const numeros = value.replace(/\D/g, '');
    if (numeros.length === 11) {
      // CPF
      return numeros
        .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        .substr(0, 14);
    } else if (numeros.length === 14) {
      // CNPJ
      return numeros
        .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        .substr(0, 18);
    }
    return value;
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

  const checkPendingRating = async (medicoId: string) => {
    try {
      const { data: ticket } = await supabase
        .from('chat_tickets')
        .select(`
          id,
          rating,
          gestor_id,
          profiles!chat_tickets_gestor_id_fkey(name)
        `)
        .eq('medico_id', medicoId)
        .eq('status', 'finalizado')
        .is('rating', null)
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ticket) {
        setPendingTicket(ticket);
        setRatingDialogOpen(true);
      }
    } catch (error) {
      console.error('Erro ao verificar avaliação pendente:', error);
    }
  };

  const handleSubmitRating = async (rating: number, feedback: string) => {
    if (!pendingTicket) return;

    try {
      const { error } = await supabase
        .from('chat_tickets')
        .update({
          rating,
          feedback_text: feedback
        })
        .eq('id', pendingTicket.id);

      if (error) throw error;

      toast({
        title: "Avaliação Enviada",
        description: "Obrigado pelo seu feedback!",
      });

      setPendingTicket(null);
    } catch (error: any) {
      console.error('Erro ao enviar avaliação:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar avaliação",
        variant: "destructive",
      });
      throw error;
    }
  };

  const buscarDados = async () => {
    if (!cpf || cpf.length < 14) {
      toast({
        title: "Erro",
        description: "Digite um CPF/CNPJ válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const cpfNumeros = cpf.replace(/\D/g, '');

      // Buscar configurações OCR e modo de manutenção
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('ocr_nfse_habilitado, modo_manutencao, mensagem_manutencao')
        .single();
      
      if (configData) {
        setOcrHabilitado(configData.ocr_nfse_habilitado || false);
        setModoManutencao(configData.modo_manutencao || false);
        setMensagemManutencao(configData.mensagem_manutencao || "Sistema em manutenção. Voltaremos em breve.");
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('get-medico-dados', {
        body: { cpf: cpfNumeros }
      });

      if (fnError || !result?.medico) {
        toast({
          title: "CPF/CNPJ não encontrado",
          description: "Não encontramos um médico ativo com este CPF/CNPJ",
          variant: "destructive",
        });
        return;
      }

      const medicoData = result.medico;
      setMedico(medicoData);

      // Verificar se há ticket pendente de avaliação
      checkPendingRating(medicoData.id);

      // Consolidar notas por pagamento para decidir corretamente se ainda precisa enviar
      const notasRaw = result.notas || [];
      const notasPorPagamento = (notasRaw as any[]).reduce((acc: Record<string, { temPendente: boolean; temAprovado: boolean; temRejeitado: boolean }>, nota: any) => {
        const pid = nota.pagamento_id || nota.pagamentos?.id;
        if (!pid) return acc;
        if (!acc[pid]) acc[pid] = { temPendente: false, temAprovado: false, temRejeitado: false };
        if (nota.status === 'pendente') acc[pid].temPendente = true;
        if (nota.status === 'aprovado') acc[pid].temAprovado = true;
        if (nota.status === 'rejeitado') acc[pid].temRejeitado = true;
        return acc;
      }, {} as Record<string, { temPendente: boolean; temAprovado: boolean; temRejeitado: boolean }>)

      const pagamentosPendentesData = result.pagamentos || [];

      const pagamentosPendentesProcessados = pagamentosPendentesData?.filter((p: any) => {
        const s = notasPorPagamento[p.id];
        // Mostrar como pendente quando: não há nota enviada ainda OU houve rejeição
        if (!s) return ['pendente','solicitado'].includes(p.status || 'pendente');
        if (s.temAprovado || s.temPendente) return false; // já enviado/aprovado → não mostrar
        if (s.temRejeitado && !s.temPendente && !s.temAprovado) return true; // precisa reenviar
        return false;
      }).map((p: any) => ({
        id: p.id,
        mes_competencia: p.mes_competencia,
        valor: p.valor,
        status: p.status,
        temNotaRejeitada: !!notasPorPagamento[p.id]?.temRejeitado,
        temNotaPendente: !!notasPorPagamento[p.id]?.temPendente
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
           mes_competencia: nota.pagamentos.mes_competencia,
           data_pagamento: nota.pagamentos.data_pagamento
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

    // Se OCR estiver desativado, validar valor líquido
    if (!ocrHabilitado) {
      if (!valorLiquido || parseFloat(valorLiquido) <= 0) {
        toast({
          title: "Erro",
          description: "Por favor, informe o valor líquido da nota",
          variant: "destructive",
        });
        return;
      }

      const valorLiquidoNum = parseFloat(valorLiquido);
      const valorBrutoNum = selectedPagamento.valor;

      if (valorLiquidoNum > valorBrutoNum) {
        toast({
          title: "Erro",
          description: "O valor líquido não pode ser maior que o valor bruto",
          variant: "destructive",
        });
        return;
      }
    }

    setUploading(true);
    setShowConfirmUpload(false);

    // Mostrar toast informativo de que o envio está em andamento
    toast({
      title: "Enviando...",
      description: ocrHabilitado 
        ? "Aguarde, processando nota fiscal automaticamente..." 
        : "Aguarde, sua nota está sendo enviada. Não feche esta página.",
      duration: 5000,
    });
    
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${selectedPagamento.id}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      // Upload mais otimizado
      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      let numeroNota = null;
      let valorBrutoOCR = null;
      let valorLiquidoOCR = null;
      let ocrProcessado = false;
      let ocrResultado = null;

      // Se OCR estiver habilitado, processar a nota
      if (ocrHabilitado) {
        try {
          // Ler o arquivo como ArrayBuffer
          const arrayBuffer = await selectedFile.arrayBuffer();
          
          // Converter para base64
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Data = btoa(binary);

          // Chamar função OCR
          const { data: ocrData, error: ocrError } = await supabase.functions.invoke('process-ocr-nfse', {
            body: { pdfData: base64Data }
          });

          if (ocrError) {
            console.error('Erro OCR:', ocrError);
            throw new Error('Falha ao processar OCR da nota');
          }

          if (ocrData?.success) {
            numeroNota = ocrData.numeroNota;
            valorBrutoOCR = ocrData.valorBruto;
            valorLiquidoOCR = ocrData.valorLiquido;
            ocrProcessado = true;
            ocrResultado = ocrData;

            // Validar valor bruto
            const valorEsperado = selectedPagamento.valor;
            const diferenca = Math.abs(valorEsperado - (valorBrutoOCR || 0));

            if (diferenca > 0.01) {
              // Remover arquivo do storage
              await supabase.storage.from('notas').remove([filePath]);

              toast({
                title: "❌ Nota Rejeitada",
                description: `O valor bruto da nota (R$ ${valorBrutoOCR?.toFixed(2)}) não corresponde ao valor esperado (R$ ${valorEsperado.toFixed(2)}). Por favor, verifique e envie a nota correta.`,
                variant: "destructive",
                duration: 10000,
              });

              setUploading(false);
              return;
            }

            console.log('✅ OCR processado:', { numeroNota, valorBrutoOCR, valorLiquidoOCR });
          }
        } catch (ocrError) {
          console.error('Erro ao processar OCR:', ocrError);
          // Continuar mesmo com erro de OCR (fallback para fluxo manual)
        }
      }

      // Preparar dados da nota
      const notaInsertData: any = {
        medico_id: medico.id,
        pagamento_id: selectedPagamento.id,
        arquivo_url: filePath,
        nome_arquivo: selectedFile.name,
        status: 'pendente'
      };

      if (ocrProcessado) {
        notaInsertData.numero_nota = numeroNota;
        notaInsertData.valor_bruto = valorBrutoOCR;
        notaInsertData.ocr_processado = true;
        notaInsertData.ocr_resultado = ocrResultado;
      }

      // Preparar dados do pagamento
      const pagamentoUpdate: any = {
        status: "nota_recebida",
        nota_pdf_url: filePath,
        data_resposta: new Date().toISOString()
      };

      // Adicionar valor líquido conforme OCR ou input manual
      if (valorLiquidoOCR) {
        pagamentoUpdate.valor_liquido = valorLiquidoOCR;
      } else if (!ocrHabilitado && valorLiquido) {
        pagamentoUpdate.valor_liquido = parseFloat(valorLiquido);
      }

      // Fazer inserções e atualizações em paralelo
      const [pagamentoUpdateResult, notaInsertResult, pagamentoDataResult] = await Promise.allSettled([
        // Atualizar o pagamento
        supabase
          .from("pagamentos")
          .update(pagamentoUpdate)
          .eq("id", selectedPagamento.id)
          .eq("medico_id", medico.id),
        
        // Registrar na tabela notas_medicos
        supabase
          .from("notas_medicos")
          .insert(notaInsertData)
          .select('id')
          .single(),
        
        // Buscar competência
        supabase
          .from('pagamentos')
          .select('mes_competencia')
          .eq('id', selectedPagamento.id)
          .single()
      ]);

      // Verificar se houve erro no insert da nota
      if (notaInsertResult.status === 'rejected') {
        await supabase.storage.from('notas').remove([filePath]);
        throw new Error('Erro ao registrar nota');
      }

      const notaData = (notaInsertResult as PromiseFulfilledResult<any>).value.data;
      const competencia = (pagamentoDataResult as PromiseFulfilledResult<any>).value?.data?.mes_competencia || selectedPagamento.mes_competencia;

      const valorParaNotificacao = valorLiquidoOCR || (valorLiquido ? parseFloat(valorLiquido) : null);

      // Disparar notificações em background (não bloquear UI)
      Promise.all([
        // WhatsApp
        supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota_recebida',
            medico: {
              nome: medico.nome,
              numero_whatsapp: medico.numero_whatsapp
            },
            competencia: competencia,
            pagamentoId: selectedPagamento.id,
            valorBruto: selectedPagamento.valor,
            valorLiquido: valorParaNotificacao
          }
        }).then(res => console.log('WhatsApp enviado:', res)).catch(err => console.error('Erro WhatsApp:', err)),
        
        // Email
        supabase.functions.invoke('send-email-notification', {
          body: {
            type: 'nova_nota',
            pagamentoId: selectedPagamento.id,
            notaId: notaData.id,
            fileName: selectedFile.name,
            valorLiquido: valorParaNotificacao,
            pdfPath: filePath
          }
        }).then(res => console.log('Email enviado:', res)).catch(err => console.error('Erro email:', err))
      ]).catch(err => console.warn('Erro nas notificações:', err));

      // UI Update imediato
      setShowUploadModal(false);
      setSelectedPagamento(null);
      setSelectedFile(null);
      setValorLiquido("");
      
      // Recarregar dados
      buscarDados();

      // Mensagem de sucesso
      const isReenvio = selectedPagamento?.temNotaRejeitada;
      const successMessage = ocrProcessado 
        ? `Nota fiscal ${isReenvio ? 'reenviada' : 'enviada'} e validada automaticamente! Número: ${numeroNota || 'N/A'}. O gestor será notificado para análise.`
        : isReenvio 
          ? "Nota fiscal reenviada. O gestor será notificado para análise." 
          : "Nota fiscal enviada. O gestor será notificado para análise.";
      
      toast({
        title: "✅ Nota Enviada!",
        description: successMessage,
        duration: 8000,
      });

    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "❌ Erro no Envio",
        description: error.message || "Falha no upload. Tente novamente.",
        variant: "destructive",
        duration: 8000,
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="glass-effect border-border/50 hover:bg-accent/50 transition-all"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card className="glass-effect border-primary/20 shadow-elegant">
              <CardHeader className="text-center pb-6 space-y-6">
                {/* Logo dentro do card */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex justify-center"
                >
                  <img src={logo} alt="HCC Hospital" className="h-20 w-auto" />
                </motion.div>

                <div>
                  <CardTitle className="text-2xl gradient-text mb-2">Dashboard Médicos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Digite seu CPF ou CNPJ para visualizar suas informações
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="text-sm font-medium">CPF ou CNPJ</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      value={cpf}
                      onChange={handleCPFChange}
                      maxLength={18}
                      className="text-lg text-center font-semibold"
                    />
                  </div>
                  <Button 
                    onClick={buscarDados} 
                    disabled={loading}
                    className="w-full shadow-elegant hover:shadow-glow transition-all"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="mr-2"
                        >
                          <BarChart3 className="h-5 w-5" />
                        </motion.div>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-5 w-5 mr-2" />
                        Acessar Dashboard
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
              <div className="px-6 pb-6 pt-4 border-t border-border/30">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs text-muted-foreground">Desenvolvido por</span>
                  <img 
                    src={conquistaLogo} 
                    alt="Conquista Inovação" 
                    className="h-5 opacity-60 hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Aviso de Manutenção */}
        {modoManutencao && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className="border-warning bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <AlertDescription className="text-foreground">
                <strong>Atenção:</strong> {mensagemManutencao}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Seção especial para médicos com notas pendentes */}
        {pagamentosPendentes.length > 0 && (
          <Card className="mb-8 border-warning/30 bg-warning/5">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center">
                  <Upload className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <h3 className="text-base md:text-lg font-semibold text-foreground mb-2 flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                    <span className="break-words">Notas Fiscais Pendentes</span>
                  </h3>
                  <p className="text-sm md:text-base text-muted-foreground mb-4">
                    Você tem <strong className="text-warning">{pagamentosPendentes.length}</strong> pagamento(s) aguardando envio de nota fiscal.
                  </p>
                  <div className="grid gap-3">
                    {pagamentosPendentes.map((pagamento) => (
                      <div
                        key={pagamento.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-all gap-3"
                      >
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-semibold text-foreground text-sm md:text-base break-words">
                              {formatMesCompetencia(pagamento.mes_competencia)}
                            </span>
                            <span className="text-base md:text-lg font-bold text-success">
                              {formatCurrency(pagamento.valor)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pagamento.temNotaRejeitada && (
                              <Badge variant="destructive" className="text-xs">
                                <X className="h-3 w-3 mr-1" />
                                Rejeitada - Reenviar
                              </Badge>
                            )}
                            {pagamento.temNotaPendente && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Aguardando Análise
                              </Badge>
                            )}
                          </div>
                        </div>
                         <Button
                          onClick={() => {
                            setSelectedPagamento(pagamento);
                            setSelectedFile(null);
                            setValorLiquido("");
                            setShowUploadModal(true);
                          }}
                          size="sm"
                          variant={pagamento.temNotaRejeitada ? "destructive" : pagamento.temNotaPendente ? "secondary" : "default"}
                          disabled={pagamento.temNotaPendente && !pagamento.temNotaRejeitada}
                          className="w-full sm:w-auto flex-shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          <span className="text-xs md:text-sm">
                            {pagamento.temNotaRejeitada ? "Reenviar" : 
                             pagamento.temNotaPendente ? "Enviada" : "Enviar Nota"}
                          </span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <Card className="mb-8 glass-effect border-primary/20">
          <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-primary opacity-10 blur-xl rounded-lg" />
                    <img 
                      src={logo} 
                      alt="HCC Hospital" 
                      className="h-12 w-12 md:h-16 md:w-16 object-contain relative z-10 drop-shadow-lg"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-2xl font-bold gradient-text mb-0.5 md:mb-1 truncate">
                      {medico.nome}
                    </h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Portal do Médico • Notas e pagamentos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="glass-effect border-primary/20 flex-shrink-0"
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setMedico(null)}
                    className="glass-effect border-primary/20 flex-shrink-0"
                    size="sm"
                  >
                    Sair
                  </Button>
                </div>
              </div>
          </CardContent>
        </Card>

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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
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
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 w-full sm:w-auto flex-shrink-0"
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

        {/* Histórico de Tickets do Chat */}
        <div className="mb-8">
          <TicketHistory medicoId={medico.id} medicoNome={medico.nome} />
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
                        {formatMesCompetencia(nota.pagamento.mes_competencia)}
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
                     {nota.pagamento.data_pagamento && (
                       <p className="text-sm text-green-600 font-medium">
                         💰 Pago em {new Date(nota.pagamento.data_pagamento).toLocaleDateString('pt-BR')}
                       </p>
                     )}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Upload className="h-5 w-5 text-primary" />
                {selectedPagamento?.temNotaRejeitada ? 'Reenviar Nota Fiscal' : 'Enviar Nota Fiscal'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedPagamento && (
                <div className="p-3 md:p-4 bg-muted/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm md:text-base">Detalhes do Pagamento</h4>
                    {selectedPagamento.temNotaRejeitada && (
                      <Badge variant="destructive" className="text-xs w-fit">
                        Nota Rejeitada - Reenvio Necessário
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Competência:</span>
                      <p className="font-medium">
                        {formatMesCompetencia(selectedPagamento.mes_competencia)}
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
                <Label className="text-sm md:text-base">Arquivo PDF da Nota Fiscal</Label>
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
                  className="text-sm"
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Importante:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
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
                <h4 className="font-medium mb-2 text-sm sm:text-base">Arquivo selecionado:</h4>
                <p className="text-sm text-muted-foreground break-words overflow-hidden">
                  {selectedFile?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tamanho: {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : 0} MB
                </p>
              </div>

              {!ocrHabilitado && (
                <div className="space-y-2">
                  <Label htmlFor="valorLiquido" className="text-sm font-medium">
                    Valor Líquido da Nota *
                  </Label>
                  <Input
                    id="valorLiquido"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={valorLiquido}
                    onChange={(e) => setValorLiquido(e.target.value)}
                    className="text-base"
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o valor líquido que consta na nota fiscal
                  </p>
                </div>
              )}

              {ocrHabilitado && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>✨ OCR Automático Ativado</strong>
                  </p>
                  <p className="text-xs text-blue-800 mt-1">
                    O sistema irá extrair automaticamente o número da nota, valor bruto e valor líquido. 
                    Você não precisa preencher o valor líquido manualmente.
                  </p>
                </div>
              )}

              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  <strong>Confirme antes de enviar:</strong>
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• O arquivo está correto e completo?</li>
                  {!ocrHabilitado && <li>• O valor líquido informado está correto?</li>}
                  <li>• Os dados conferem com o pagamento?</li>
                  <li>• O PDF não possui problemas de visualização?</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowConfirmUpload(false);
                    setSelectedFile(null);
                    setValorLiquido("");
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmUpload}
                  disabled={uploading || (!ocrHabilitado && (!valorLiquido || parseFloat(valorLiquido) <= 0))}
                  className="w-full sm:w-auto"
                >
                  {uploading ? "Enviando..." : "Confirmar e Enviar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Chat Component */}
      {medico && (
        <>
          <ChatWithFinanceiro 
            medicoId={medico.id} 
            medicoNome={medico.nome}
            isGestor={false}
            gestorNome={pendingTicket?.profiles?.name}
          />
          
          {/* Rating Dialog */}
          <RatingDialog
            open={ratingDialogOpen}
            onClose={() => setRatingDialogOpen(false)}
            onSubmit={handleSubmitRating}
            gestorNome={pendingTicket?.profiles?.name}
          />
        </>
      )}

      {/* Footer with Conquista Logo */}
      {medico && (
        <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">Desenvolvido por</span>
          <img 
            src={conquistaLogo} 
            alt="Conquista Inovação" 
            className="h-5 opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      )}
    </div>
  );
}