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
      console.log('🔄 Buscando dados da nota antes de aprovar');
      
      // Buscar informações do médico ANTES de processar a aprovação
      const { data: nota, error: notaError } = await supabase
        .from('notas_medicos')
        .select(`
          medico_id,
          pagamento_id
        `)
        .eq('id', notaId)
        .maybeSingle();

      if (notaError || !nota) {
        throw new Error('Nota não encontrada');
      }

      // Buscar nome do médico
      const { data: medico } = await supabase
        .from('medicos')
        .select('nome')
        .eq('id', nota.medico_id)
        .maybeSingle();

      if (medico?.nome) {
        setMedicoNome(medico.nome);
      }

      console.log('🔄 Chamando edge function processar-aprovacao');
      console.log('URL:', `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/processar-aprovacao?nota=${notaId}&action=aprovar&token=${token}`);
      
      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

      try {
        const response = await fetch(
          `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/processar-aprovacao?nota=${notaId}&action=aprovar&token=${token}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);
        console.log('📊 Status da resposta:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro na resposta:', errorText);
          throw new Error(`Erro ao processar aprovação: ${response.status}`);
        }

        setSuccess(true);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        
        if (fetchErr.name === 'AbortError') {
          throw new Error('Tempo limite excedido. Tente novamente.');
        }
        
        console.error('❌ Erro na requisição:', fetchErr);
        throw new Error(`Erro de conexão: ${fetchErr.message}`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao processar:', err);
      setError(err.message || "Erro ao processar aprovação. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Processando aprovação...
          </h1>
          <p className="text-gray-800">Aguarde um momento</p>
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
          <p className="text-gray-800 mb-6">{error}</p>
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
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6 text-left border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400 mb-1">Médico</p>
            <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">{medicoNome}</p>
          </div>
        )}
        <p className="text-gray-800 mb-8">
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
          <span className="text-xs text-gray-600">Desenvolvido por</span>
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
