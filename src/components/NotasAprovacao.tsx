import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Eye, Clock, FileText } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [selectedNota, setSelectedNota] = useState<NotaMedico | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadNotas();
  }, []);

  const loadNotas = async () => {
    try {
      const { data, error } = await supabase
        .from("notas_medicos")
        .select(`
          *,
          medicos (
            nome,
            cpf
          ),
          pagamentos (
            mes_competencia,
            valor
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotas(data || []);
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
    setProcessingId(notaId);
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
          valor: nota.pagamentos.valor
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

    setProcessingId(notaId);
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
          motivo: observacoes
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
          Aprovação de Notas Fiscais ({notas.filter(n => n.status === 'pendente').length} pendentes)
        </CardTitle>
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
            {notas.map((nota) => (
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

        {notas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma nota fiscal encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}