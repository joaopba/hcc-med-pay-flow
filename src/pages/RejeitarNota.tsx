import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function RejeitarNota() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notaInfo, setNotaInfo] = useState<any>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    buscarNota();
  }, []);

  const buscarNota = async () => {
    const notaId = searchParams.get('nota');
    const token = searchParams.get('token');

    if (!notaId || !token) {
      setError("Link inválido ou expirado");
      setLoading(false);
      return;
    }

    try {
      const { data: nota } = await supabase
        .from('notas_medicos')
        .select(`
          id,
          nome_arquivo,
          status,
          created_at,
          pagamento_id,
          pagamentos(
            mes_competencia,
            medicos(nome, numero_whatsapp)
          )
        `)
        .eq('id', notaId)
        .single();

      if (!nota) {
        throw new Error('Nota não encontrada');
      }

      if (nota.status !== 'pendente') {
        setError(`Esta nota já foi ${nota.status === 'aprovado' ? 'aprovada' : 'rejeitada'} anteriormente`);
        setLoading(false);
        return;
      }

      setNotaInfo(nota);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar nota");
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!motivo.trim()) {
      setError("Por favor, informe o motivo da rejeição");
      return;
    }

    const notaId = searchParams.get('nota');
    const token = searchParams.get('token');

    setSubmitting(true);
    setError(null);

    try {
      // Validar token
      const expectedToken = btoa(`${notaId}-${notaInfo.created_at}`).substring(0, 20);
      if (token !== expectedToken) {
        throw new Error('Token inválido ou expirado');
      }

      // Rejeitar nota
      const { error: updateNotaError } = await supabase
        .from('notas_medicos')
        .update({ 
          status: 'rejeitado',
          observacoes: motivo
        })
        .eq('id', notaId);

      if (updateNotaError) throw updateNotaError;

      // Atualizar pagamento
      const { error: updatePagamentoError } = await supabase
        .from('pagamentos')
        .update({ 
          status: 'pendente',
          observacoes: motivo
        })
        .eq('id', notaInfo.pagamento_id);

      if (updatePagamentoError) throw updatePagamentoError;

      // Enviar notificação WhatsApp
      try {
        await supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota_rejeitada',
            medico: {
              nome: notaInfo.pagamentos.medicos.nome,
              numero_whatsapp: notaInfo.pagamentos.medicos.numero_whatsapp
            },
            competencia: notaInfo.pagamentos.mes_competencia,
            motivo: motivo,
            linkPortal: 'https://hcc.chatconquista.com/dashboard-medicos',
            pagamentoId: notaInfo.pagamento_id
          }
        });
      } catch (whatsappError) {
        console.warn('Erro ao enviar WhatsApp:', whatsappError);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao processar rejeição");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Carregando informações...
          </h1>
        </div>
      </div>
    );
  }

  if (error && !notaInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-destructive mb-4">
            Erro
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Voltar ao Sistema
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center animate-in fade-in duration-500">
          <XCircle className="h-20 w-20 text-red-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Nota Fiscal Rejeitada
          </h1>
          <div className="bg-red-50 rounded-lg p-4 mb-6 text-left border-l-4 border-red-500">
            <p className="text-sm text-muted-foreground mb-2">Médico</p>
            <p className="font-semibold mb-3">{notaInfo?.pagamentos?.medicos?.nome}</p>
            <p className="text-sm text-muted-foreground mb-2">Motivo da Rejeição</p>
            <p className="text-sm">{motivo}</p>
          </div>
          <p className="text-muted-foreground mb-8">
            O médico foi notificado via WhatsApp e poderá enviar uma nova nota corrigida.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105"
          >
            Voltar ao Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-red-600 mb-2">
            Rejeitar Nota Fiscal
          </h1>
        </div>

        <div className="bg-amber-50 rounded-lg p-6 mb-6 border-l-4 border-amber-500">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Médico</p>
              <p className="font-semibold">{notaInfo?.pagamentos?.medicos?.nome}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Competência</p>
              <p className="font-semibold">{notaInfo?.pagamentos?.mes_competencia}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground mb-1">Arquivo</p>
              <p className="font-semibold text-sm">{notaInfo?.nome_arquivo}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleRejeitar} className="space-y-6">
          <div>
            <Label htmlFor="motivo" className="text-base font-semibold">
              Motivo da Rejeição *
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Dados incorretos, documento ilegível, valores não conferem..."
              className="mt-2 min-h-[120px]"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Rejeição'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
