import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

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
    const notaId = searchParams.get('nota');
    const token = searchParams.get('token');

    if (!notaId || !token) {
      setError("Link inválido ou expirado");
      setLoading(false);
      return;
    }

    try {
      // Chamar edge function via URL completa
      const response = await fetch(
        `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/processar-aprovacao?nota=${notaId}&action=aprovar&token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao processar aprovação');
      }

      // Buscar nome do médico
      const { data: nota } = await supabase
        .from('notas_medicos')
        .select('pagamentos(medicos(nome))')
        .eq('id', notaId)
        .single();

      if (nota?.pagamentos?.medicos?.nome) {
        setMedicoNome(nota.pagamentos.medicos.nome);
      }

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
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-muted-foreground mb-1">Médico</p>
            <p className="font-semibold text-lg">{medicoNome}</p>
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
      </div>
    </div>
  );
}
