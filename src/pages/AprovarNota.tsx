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
      setError(err.message || "Erro ao carregar dados da nota.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarAprovacao = async () => {
    if (!notaData) return;
    const valorInformado = parseFloat(notaData.valor_liquido?.toString().replace(/[^\d,.-]/g, '').replace(',', '.') || '0');
    const valorDigitadoNum = parseFloat(valorDigitado.replace(/[^\d,.-]/g, '').replace(',', '.'));

    if (!valorDigitado || isNaN(valorDigitadoNum)) {
      setValorError(true);
      return;
    }

    if (Math.abs(valorInformado - valorDigitadoNum) > 0.01) {
      setValorError(true);
      return;
    }

    setValorError(false);
    setLoading(true);

    try {
      const notaId = searchParams.get('i') || searchParams.get('nota');
      const token = notaData.token;

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
      setError(err.message || "Erro ao processar aprovação.");
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Carregando dados...
          </h1>
          <p className="text-gray-900 text-base">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive to-red-700 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-destructive mb-2">
            Erro ao processar
          </h1>
          <p className="text-gray-900 mb-4 text-base">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors w-full"
          >
            Voltar ao Sistema
          </button>
        </div>
      </div>
    );
  }

  if (showConfirmation && notaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-sm w-full">
          <div className="text-center mb-6">
            <DollarSign className="h-10 w-10 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Confirmar Aprovação da Nota
            </h1>
            <p className="text-gray-800 text-base">Verifique o valor líquido antes de aprovar</p>
          </div>

          <Card className="p-4 mb-4 bg-blue-50 border-blue-200 text-gray-900 rounded-xl">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-blue-900 mb-1">Médico</Label>
                <p className="font-semibold text-base">{medicoNome}</p>
              </div>
              <div>
                <Label className="text-xs text-blue-900 mb-1">Competência</Label>
                <p className="font-semibold text-base">{notaData.mes_competencia}</p>
              </div>
              <div>
                <Label className="text-xs text-blue-900 mb-1">Valor Bruto</Label>
                <p className="font-semibold text-base">
                  R$ {notaData.valor ? parseFloat(notaData.valor).toFixed(2).replace('.', ',') : '0,00'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 mb-4 bg-amber-50 border-amber-300 border rounded-xl">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-amber-900 mb-1 text-base">Atenção: Verificação Obrigatória</h3>
                <p className="text-xs text-amber-900">
                  O médico informou o valor líquido abaixo. Por favor, <strong>confira na nota fiscal</strong> se o valor está correto e digite-o abaixo para confirmar.
                </p>
              </div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-amber-400">
              <Label className="text-xs text-amber-900 mb-1">Valor Líquido Informado pelo Médico</Label>
              <p className="text-2xl font-bold text-amber-900">
                R$ {notaData.valor_liquido ? parseFloat(notaData.valor_liquido).toFixed(2).replace('.', ',') : '0,00'}
              </p>
            </div>
          </Card>

          <div className="mb-4">
            <a 
              href={notaData.arquivo_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-900 hover:text-blue-800 underline font-medium text-xs flex items-center justify-center gap-1 mb-2"
            >
              📄 <span className="text-blue-900">Abrir Nota Fiscal para Conferência</span>
            </a>

            <Label htmlFor="valorDigitado" className="block mb-2 font-semibold text-gray-900 text-base">
              Digite o valor líquido que você vê na nota fiscal:
            </Label>
            <Input
              id="valorDigitado"
              type="text"
              inputMode="decimal"
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              placeholder="Ex: 1234,56"
              value={valorDigitado}
              onChange={(e) => {
                setValorDigitado(e.target.value);
                setValorError(false);
              }}
              className={`text-lg text-gray-900 bg-white border-gray-300 rounded-lg px-4 py-2 w-full ${valorError ? 'border-red-500 bg-red-50' : ''}`}
            />
            {valorError && (
              <p className="text-red-600 text-sm mt-2 font-semibold">
                ⚠️ O valor digitado não confere com o valor informado pelo médico. Verifique novamente a nota fiscal.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Use vírgula para centavos (Ex: 1234,56)
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={handleConfirmarAprovacao}
              disabled={!valorDigitado || loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-lg rounded-lg"
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
              className="w-full px-6 py-4 rounded-lg text-lg"
            >
              Cancelar
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 flex flex-col items-center gap-1">
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
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center animate-in fade-in duration-500">
          <div className="mb-4 animate-bounce">
            <CheckCircle className="h-14 w-14 text-green-600 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">
            Nota Fiscal Aprovada!
          </h1>
          {medicoNome && (
            <div className="bg-green-50 rounded-lg p-2 mb-4 text-left border border-green-200">
              <p className="text-xs text-green-700 mb-1">Médico</p>
              <p className="font-semibold text-base text-gray-900">{medicoNome}</p>
            </div>
          )}
          <p className="text-gray-900 mb-4 text-base">
            O pagamento será processado em breve e o médico foi notificado via WhatsApp.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105 w-full"
          >
            Voltar ao Sistema
          </button>
          <div className="mt-6 pt-4 border-t border-border/30 flex flex-col items-center gap-1">
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
