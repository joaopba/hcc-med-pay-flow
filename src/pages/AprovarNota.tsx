import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import conquistaLogo from "@/assets/conquista-inovacao.png";

export default function AprovarNota() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicoNome, setMedicoNome] = useState("");

  useEffect(() => {
    processarAprovacao();
  }, []);

  const processarAprovacao = async () => {
    const notaId = searchParams.get('i') || searchParams.get('nota');
    const token = searchParams.get('t') || searchParams.get('token');

    if (!notaId || !token) {
      setError("Link inválido ou expirado");
      setLoading(false);
      return;
    }

    try {
      // Buscar nota completa
      const { data: nota, error: notaError } = await supabase
        .from('notas_medicos')
        .select('id, created_at, status, pagamento_id, medico_id')
        .eq('id', notaId)
        .maybeSingle();

      console.log('🔍 DEBUG - Nota ID recebido:', notaId);
      console.log('🔍 DEBUG - Token recebido:', token);
      console.log('🔍 DEBUG - Nota encontrada:', nota);

      if (notaError) {
        console.error('❌ Erro ao buscar nota:', notaError);
        throw new Error('Erro ao buscar nota no banco de dados');
      }

      if (!nota) {
        console.error('❌ Nota não encontrada no banco - ID:', notaId);
        throw new Error('Nota não encontrada');
      }

      console.log('✅ Nota carregada:', nota);
      console.log('🗓️ Created at da nota:', nota.created_at);

      // Validar token - normalizar created_at removendo T
      const createdAtStr = String(nota.created_at).replace('T', ' ');
      const expected20 = btoa(`${notaId}-${createdAtStr}`).substring(0, 20);
      const expected12 = expected20.substring(0, 12);
      console.log('🔑 Token recebido:', token, `(${token.length} chars)`);
      console.log('🔑 Token esperado 20 chars:', expected20);
      console.log('🔑 Token esperado 12 chars:', expected12);
      console.log('🔑 String usada para gerar token:', `${notaId}-${createdAtStr}`);
      
      if (token !== expected20 && token !== expected12) {
        console.error('❌ Token inválido! Recebido:', token, 'Esperados:', expected20, expected12);
        throw new Error('Token inválido ou expirado');
      }

      console.log('✅ Token validado com sucesso!');

      // Verificar se já foi processada
      if (nota.status !== 'pendente') {
        setError(`Esta nota já foi ${nota.status === 'aprovado' ? 'aprovada' : 'rejeitada'} anteriormente`);
        setLoading(false);
        return;
      }

      // Buscar dados relacionados (sem dependência de relacionamento no SELECT)
      let medicoData: { nome: string; numero_whatsapp: string } | null = null;
      let pagamentoData: { mes_competencia: string } | null = null;

      if (nota.medico_id) {
        const { data: medicoRow, error: medicoErr } = await supabase
          .from('medicos')
          .select('nome, numero_whatsapp')
          .eq('id', nota.medico_id)
          .maybeSingle();
        if (medicoErr) console.warn('Fallback medicos erro:', medicoErr);
        medicoData = medicoRow;
      }

      if (nota.pagamento_id) {
        const { data: pagamentoRow, error: pagErr } = await supabase
          .from('pagamentos')
          .select('mes_competencia')
          .eq('id', nota.pagamento_id)
          .maybeSingle();
        if (pagErr) console.warn('Fallback pagamentos erro:', pagErr);
        pagamentoData = pagamentoRow;
      }
      
      console.log('Médico:', medicoData);
      console.log('Pagamento:', pagamentoData);

      // Aprovar nota
      const { error: updateNotaError } = await supabase
        .from('notas_medicos')
        .update({ status: 'aprovado' })
        .eq('id', notaId);

      if (updateNotaError) throw updateNotaError;

      // Atualizar pagamento para aprovado
      const { error: updatePagamentoError } = await supabase
        .from('pagamentos')
        .update({ 
          status: 'aprovado',
          data_resposta: new Date().toISOString()
        })
        .eq('id', nota.pagamento_id);

      if (updatePagamentoError) throw updatePagamentoError;

      // Enviar notificação WhatsApp
      try {
        await supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota_aprovada',
            medico: {
              nome: medicoData?.nome || '',
              numero_whatsapp: medicoData?.numero_whatsapp || ''
            },
            competencia: pagamentoData?.mes_competencia || '',
            pagamentoId: nota.pagamento_id
          }
        });
      } catch (whatsappError) {
        console.warn('Erro ao enviar WhatsApp:', whatsappError);
      }

      setMedicoNome(medicoData?.nome || '');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao processar aprovação");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Processando aprovação...
          </h1>
          <p className="text-muted-foreground">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-destructive mb-4">
            Erro ao processar
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center animate-in fade-in duration-500">
        <div className="mb-6 animate-bounce">
          <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
        </div>
        <h1 className="text-3xl font-bold text-green-600 mb-4">
          Nota Fiscal Aprovada!
        </h1>
        {medicoNome && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-green-700 dark:text-green-400 mb-1">Médico</p>
            <p className="font-semibold text-lg text-foreground">{medicoNome}</p>
          </div>
        )}
        <p className="text-muted-foreground mb-8">
          O pagamento será processado em breve e o médico foi notificado via WhatsApp.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105"
        >
          Voltar ao Sistema
        </button>
        
        {/* Footer with Conquista Logo */}
        <div className="mt-8 pt-6 border-t border-border/30 flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">Desenvolvido por</span>
          <img 
            src={conquistaLogo} 
            alt="Conquista Inovação" 
            className="h-5 opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
