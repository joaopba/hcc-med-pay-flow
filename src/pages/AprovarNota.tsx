import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import conquistaLogo from "@/assets/conquista-inovacao.png";

export default function AprovarNota() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicoNome, setMedicoNome] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notaData, setNotaData] = useState<any>(null);
  const [valorDigitado, setValorDigitado] = useState("");
  const [valorError, setValorError] = useState(false);

  useEffect(() => {
    carregarDadosNota();
  }, []);

  const carregarDadosNota = async () => {
    const notaId = searchParams.get('i') || searchParams.get('nota');
    const token = searchParams.get('t') || searchParams.get('token');

    if (!notaId || !token) {
      setError("Link inválido ou expirado");
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Buscando dados da nota');
      
      // Buscar informações da nota e pagamento
      const { data: nota, error: notaError } = await supabase
        .from('notas_medicos')
        .select(`
          id,
          medico_id,
          pagamento_id,
          arquivo_url,
          nome_arquivo
        `)
        .eq('id', notaId)
        .maybeSingle();

      if (notaError || !nota) {
        throw new Error('Nota não encontrada');
      }

      // Buscar dados do pagamento
      const { data: pagamento, error: pagamentoError } = await supabase
        .from('pagamentos')
        .select('valor_liquido, mes_competencia, valor')
        .eq('id', nota.pagamento_id)
        .maybeSingle();

      if (pagamentoError || !pagamento) {
        throw new Error('Pagamento não encontrado');
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

      setNotaData({
        ...nota,
        ...pagamento,
        token
      });
      setShowConfirmation(true);

    } catch (err: any) {
      console.error('❌ Erro ao carregar dados:', err);
      setError(err.message || "Erro ao carregar dados da nota.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarAprovacao = async () => {
    if (!notaData) return;

    // Limpar e converter valores para comparação
    const valorInformado = parseFloat(notaData.valor_liquido?.toString().replace(/[^\d,.-]/g, '').replace(',', '.') || '0');
    const valorDigitadoNum = parseFloat(valorDigitado.replace(/[^\d,.-]/g, '').replace(',', '.'));

    if (!valorDigitado || isNaN(valorDigitadoNum)) {
      setValorError(true);
      return;
    }

    // Comparar valores com tolerância de 0.01
    if (Math.abs(valorInformado - valorDigitadoNum) > 0.01) {
      setValorError(true);
      return;
    }

    setValorError(false);
    setLoading(true);

    try {
      const notaId = searchParams.get('i') || searchParams.get('nota');
      const token = notaData.token;

      console.log('🔄 Aprovando nota fiscal');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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

        if (!response.ok) {
          throw new Error(`Erro ao processar aprovação: ${response.status}`);
        }

        setSuccess(true);
        setShowConfirmation(false);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        
        if (fetchErr.name === 'AbortError') {
          throw new Error('Tempo limite excedido. Tente novamente.');
        }
        
        throw new Error(`Erro de conexão: ${fetchErr.message}`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao processar:', err);
      setError(err.message || "Erro ao processar aprovação.");
      setShowConfirmation(false);
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
            Carregando dados...
          </h1>
          <p className="text-gray-900">Aguarde um momento</p>
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
          <p className="text-gray-900 mb-6">{error}</p>
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

  if (showConfirmation && notaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center mb-6">
            <DollarSign className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Confirmar Aprovação da Nota
            </h1>
            <p className="text-gray-800">Verifique o valor líquido antes de aprovar</p>
          </div>

          <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-blue-700 mb-1">Médico</Label>
                <p className="font-semibold text-lg">{medicoNome}</p>
              </div>
              <div>
                <Label className="text-sm text-blue-700 mb-1">Competência</Label>
                <p className="font-semibold text-lg">{notaData.mes_competencia}</p>
              </div>
              <div>
                <Label className="text-sm text-blue-700 mb-1">Valor Bruto</Label>
                <p className="font-semibold text-lg">
                  R$ {notaData.valor ? parseFloat(notaData.valor).toFixed(2).replace('.', ',') : '0,00'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6 bg-amber-50 border-amber-300 border-2">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-amber-900 mb-1">Atenção: Verificação Obrigatória</h3>
                <p className="text-sm text-amber-900">
                  O médico informou o valor líquido abaixo. Por favor, <strong>confira na nota fiscal</strong> se o valor está correto e digite-o no campo abaixo para confirmar.
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-amber-400">
              <Label className="text-sm text-amber-900 mb-1">Valor Líquido Informado pelo Médico</Label>
              <p className="text-3xl font-bold text-amber-900">
                R$ {notaData.valor_liquido ? parseFloat(notaData.valor_liquido).toFixed(2).replace('.', ',') : '0,00'}
              </p>
            </div>
          </Card>

          <div className="mb-6">
            <a 
              href={notaData.arquivo_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium text-sm flex items-center justify-center gap-2 mb-4"
            >
              📄 Abrir Nota Fiscal para Conferência
            </a>

            <Label htmlFor="valorDigitado" className="block mb-2 font-semibold">
              Digite o valor líquido que você vê na nota fiscal:
            </Label>
            <Input
              id="valorDigitado"
              type="text"
              placeholder="Ex: 1234,56"
              value={valorDigitado}
              onChange={(e) => {
                setValorDigitado(e.target.value);
                setValorError(false);
              }}
              className={`text-lg ${valorError ? 'border-red-500 bg-red-50' : ''}`}
            />
            {valorError && (
              <p className="text-red-600 text-sm mt-2 font-semibold">
                ⚠️ O valor digitado não confere com o valor informado pelo médico. Verifique novamente a nota fiscal.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Use vírgula para centavos (Ex: 1234,56)
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleConfirmarAprovacao}
              disabled={!valorDigitado || loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  ✓ Confirmar e Aprovar
                </>
              )}
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="px-8"
            >
              Cancelar
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col items-center gap-2">
            <span className="text-xs text-gray-800">Desenvolvido por</span>
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

  if (success) {
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
              <p className="text-sm text-green-700 dark:text-green-800 mb-1">Médico</p>
              <p className="font-semibold text-lg text-gray-900 dark:text-gray-900">{medicoNome}</p>
            </div>
          )}
          <p className="text-gray-900 mb-8">
            O pagamento será processado em breve e o médico foi notificado via WhatsApp.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105"
          >
            Voltar ao Sistema
          </button>
          
          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col items-center gap-2">
            <span className="text-xs text-gray-800">Desenvolvido por</span>
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

  return null;
}
