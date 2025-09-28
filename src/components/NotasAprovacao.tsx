import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Eye, Clock, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface NotaMedico {
  id: string;
  medico_id: string;
  pagamento_id: string;
  arquivo_url: string;
  nome_arquivo: string;
  status: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
  medicos: {
    nome: string;
    cpf: string;
  };
  pagamentos: {
    mes_competencia: string;
    valor: number;
  };
}

export default function NotasAprovacao() {
  const [notas, setNotas] = useState<NotaMedico[]>([]);
  const [notasFiltradas, setNotasFiltradas] = useState<NotaMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [selectedNota, setSelectedNota] = useState<NotaMedico | null>(null);
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const { toast } = useToast();

  useEffect(() => {
    loadNotas();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel('notas-aprovacao-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas_medicos'
        },
        (payload) => {
          console.log('Nova atualização em notas_medicos:', payload);
          loadNotas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = notas;

    if (filtroMes !== "todos") {
      filtered = filtered.filter(nota => nota.pagamentos.mes_competencia === filtroMes);
    }

    if (filtroStatus !== "todos") {
      filtered = filtered.filter(nota => nota.status === filtroStatus);
    }

    setNotasFiltradas(filtered);
  }, [notas, filtroMes, filtroStatus]);

  const getMesesDisponiveis = () => {
    const meses = Array.from(new Set(notas.map(nota => nota.pagamentos.mes_competencia)));
    return meses.sort().reverse();
  };

  const loadNotas = async () => {
    try {
      // 1) Buscar notas sem joins
      const { data: notasBase, error: notasError } = await supabase
        .from("notas_medicos")
        .select("*")
        .order("created_at", { ascending: false });

      if (notasError) throw notasError;

      const medicoIds = Array.from(new Set((notasBase || []).map(n => n.medico_id)));
      const pagamentoIds = Array.from(new Set((notasBase || []).map(n => n.pagamento_id)));

      // 2) Buscar médicos e pagamentos necessários
      const [medicosRes, pagamentosRes] = await Promise.all([
        medicoIds.length
          ? supabase.from("medicos").select("id, nome, cpf").in("id", medicoIds)
          : Promise.resolve({ data: [], error: null } as any),
        pagamentoIds.length
          ? supabase.from("pagamentos").select("id, mes_competencia, valor").in("id", pagamentoIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (medicosRes.error) throw medicosRes.error;
      if (pagamentosRes.error) throw pagamentosRes.error;

      const medicosMap: Map<string, any> = new Map((medicosRes.data || []).map((m: any) => [m.id, m]));
      const pagamentosMap: Map<string, any> = new Map((pagamentosRes.data || []).map((p: any) => [p.id, p]));

      // 3) Enriquecer estrutura esperada pelo componente
      const enriquecidas = (notasBase || []).map((n: any) => ({
        ...n,
        medicos: {
          nome: medicosMap.get(n.medico_id)?.nome || '—',
          cpf: medicosMap.get(n.medico_id)?.cpf || ''
        },
        pagamentos: {
          mes_competencia: pagamentosMap.get(n.pagamento_id)?.mes_competencia || '',
          valor: pagamentosMap.get(n.pagamento_id)?.valor || 0
        }
      }));

      setNotas(enriquecidas as any);
      setNotasFiltradas(enriquecidas as any);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar notas para aprovação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (notaId: string) => {
    if (processingId) return; // Prevenir duplo clique
    setProcessingId(notaId);
    
    // Dobrar proteção contra duplo clique
    const buttonKey = `aprovar_${notaId}`;
    if (localStorage.getItem(buttonKey)) return;
    localStorage.setItem(buttonKey, 'processing');
    
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      // Atualizar status da nota
      const { error: updateError } = await supabase
        .from("notas_medicos")
        .update({ 
          status: 'aprovado',
          observacoes: observacoes || null
        })
        .eq("id", notaId);

      if (updateError) throw updateError;

      // Atualizar status do pagamento
      const { error: pagamentoError } = await supabase
        .from("pagamentos")
        .update({ 
          status: 'nota_recebida',
          data_resposta: new Date().toISOString(),
          nota_pdf_url: nota.arquivo_url
        })
        .eq("id", nota.pagamento_id);

      if (pagamentoError) throw pagamentoError;

      // Buscar dados completos do médico
      const { data: medicoData } = await supabase
        .from("medicos")
        .select("*")
        .eq("id", nota.medico_id)
        .single();

      // Enviar notificação via WhatsApp
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'nota_aprovada',
          medico: {
            nome: nota.medicos.nome,
            numero_whatsapp: medicoData?.numero_whatsapp
          },
          competencia: nota.pagamentos.mes_competencia,
          valor: nota.pagamentos.valor,
          pagamentoId: nota.pagamento_id
        }
      });

      toast({
        title: "Sucesso",
        description: "Nota aprovada e médico notificado!",
      });

      setObservacoes("");
      loadNotas();
    } catch (error) {
      console.error("Erro ao aprovar nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao aprovar nota",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setTimeout(() => {
        localStorage.removeItem(buttonKey);
      }, 2000);
    }
  };

  const handleRejeitar = async (notaId: string) => {
    if (!observacoes.trim()) {
      toast({
        title: "Erro",
        description: "É necessário informar o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }

    if (processingId) return; // Prevenir duplo clique
    setProcessingId(notaId);
    
    // Dobrar proteção contra duplo clique
    const buttonKey = `rejeitar_${notaId}`;
    if (localStorage.getItem(buttonKey)) return;
    localStorage.setItem(buttonKey, 'processing');
    
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      // Atualizar status da nota
      const { error: updateError } = await supabase
        .from("notas_medicos")
        .update({ 
          status: 'rejeitado',
          observacoes: observacoes
        })
        .eq("id", notaId);

      if (updateError) throw updateError;

      // Buscar dados completos do médico
      const { data: medicoData } = await supabase
        .from("medicos")
        .select("*")
        .eq("id", nota.medico_id)
        .single();

      // Enviar notificação via WhatsApp
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'nota_rejeitada',
          medico: {
            nome: nota.medicos.nome,
            numero_whatsapp: medicoData?.numero_whatsapp
          },
          competencia: nota.pagamentos.mes_competencia,
          motivo: observacoes,
          linkPortal: 'https://hcc-med-pay-flow.lovable.app/dashboard-medicos',
          pagamentoId: nota.pagamento_id
        }
      });

      toast({
        title: "Sucesso",
        description: "Nota rejeitada e médico notificado!",
      });

      setObservacoes("");
      loadNotas();
    } catch (error) {
      console.error("Erro ao rejeitar nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao rejeitar nota",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setTimeout(() => {
        localStorage.removeItem(buttonKey);
      }, 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const downloadFile = async (arquivoUrl: string, nomeArquivo: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('notas')
        .download(arquivoUrl);

      if (error) throw error;

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      toast({
        title: "Erro",
        description: "Falha ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Carregando notas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Aprovação de Notas Fiscais ({notasFiltradas.filter(n => n.status === 'pendente').length} pendentes)
        </CardTitle>
        
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Label htmlFor="filtro-mes">Filtrar por Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {getMesesDisponiveis().map(mes => (
                  <SelectItem key={mes} value={mes}>
                    {new Date(mes + '-01').toLocaleDateString('pt-BR', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Label htmlFor="filtro-status">Filtrar por Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Médico</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Envio</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notasFiltradas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell className="font-medium">{nota.medicos.nome}</TableCell>
                <TableCell>
                  {nota.medicos.cpf ? 
                    nota.medicos.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') 
                    : 'N/A'
                  }
                </TableCell>
                <TableCell>
                  {new Date(nota.pagamentos.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </TableCell>
                <TableCell>{formatCurrency(nota.pagamentos.valor)}</TableCell>
                <TableCell>{getStatusBadge(nota.status)}</TableCell>
                <TableCell>
                  {new Date(nota.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(nota.arquivo_url, nota.nome_arquivo)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {nota.status === 'pendente' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedNota(nota)}
                          >
                            Avaliar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Avaliar Nota Fiscal</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p><strong>Médico:</strong> {nota.medicos.nome}</p>
                              <p><strong>Competência:</strong> {new Date(nota.pagamentos.mes_competencia + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                              <p><strong>Valor:</strong> {formatCurrency(nota.pagamentos.valor)}</p>
                              <p><strong>Arquivo:</strong> {nota.nome_arquivo}</p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="observacoes">Observações</Label>
                              <Textarea
                                id="observacoes"
                                placeholder="Digite observações sobre a aprovação/rejeição..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                rows={3}
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => handleRejeitar(nota.id)}
                                disabled={processingId === nota.id}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                              <Button
                                variant="default"
                                onClick={() => handleAprovar(nota.id)}
                                disabled={processingId === nota.id}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {nota.observacoes && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Badge variant="outline" className="cursor-pointer">
                            Ver obs.
                          </Badge>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Observações</DialogTitle>
                          </DialogHeader>
                          <p>{nota.observacoes}</p>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {notasFiltradas.length === 0 && notas.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma nota encontrada com os filtros aplicados
          </div>
        )}

        {notas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma nota fiscal encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}