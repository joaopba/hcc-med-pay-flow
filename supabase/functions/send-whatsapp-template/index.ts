import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada';
  numero?: string;
  nome?: string;
  valor?: string;
  competencia?: string;
  dataPagamento?: string;
  pagamentoId?: string;
  medico?: {
    nome: string;
    numero_whatsapp: string;
  };
  motivo?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId, medico, motivo }: WhatsAppRequest = await req.json();

    // Buscar configurações da API
    const { data: config, error: configError } = await supabase
      .from('configuracoes')
      .select('api_url, auth_token')
      .single();

    if (configError || !config) {
      throw new Error('Configurações não encontradas');
    }

    let message = '';
    let phoneNumber = numero;

    // Para tipos que usam o objeto médico
    if (medico?.numero_whatsapp) {
      phoneNumber = medico.numero_whatsapp;
    }

    switch (type) {
      case 'nota':
        const baseUrl = `${req.headers.get('origin') || 'https://nnytrkgsjajsecotasqv.supabase.co'}/notas-medicos`;
        message = `🏥 *Solicitação de Nota Fiscal*\n\nOlá ${nome}!\n\nPrecisamos da sua nota fiscal referente ao pagamento de ${competencia} no valor de R$ ${valor}.\n\n📋 *Como enviar sua nota:*\n\n1. Acesse: ${baseUrl}\n2. Digite seu CPF\n3. Localize o pagamento e anexe o arquivo PDF\n\n⚠️ *Importante:* Apenas arquivos PDF são aceitos\n\nPrecisa de ajuda? Entre em contato conosco.`;
        break;
      case 'pagamento':
        message = `💰 *Pagamento Processado*\n\nOlá ${nome}!\n\nSeu pagamento foi processado com sucesso em ${dataPagamento}.\n\nObrigado por sua colaboração!`;
        break;
      case 'nota_aprovada':
        message = `✅ *Nota Fiscal Aprovada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi aprovada.\n\nO pagamento está sendo processado e você será notificado quando estiver disponível.\n\nObrigado!`;
        break;
      case 'nota_rejeitada':
        message = `❌ *Nota Fiscal Rejeitada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi rejeitada.\n\n*Motivo:* ${motivo}\n\nPor favor, corrija o documento e envie novamente através do nosso portal.\n\nPrecisa de ajuda? Entre em contato conosco.`;
        break;
      default:
        throw new Error('Tipo de mensagem inválido');
    }

    const payload = {
      body: message,
      number: phoneNumber,
      externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
      isClosed: false
    };

    console.log('Enviando mensagem WhatsApp:', payload);

    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log('Resposta da API WhatsApp:', responseData);

    // Log da mensagem se tiver pagamentoId
    if (pagamentoId) {
      try {
        await supabase
          .from('message_logs')
          .insert([{
            pagamento_id: pagamentoId,
            tipo: `whatsapp_${type}`,
            payload: payload,
            success: response.ok,
            response: responseData
          }]);
      } catch (logError) {
        console.warn('Erro ao registrar log:', logError);
      }
    }

    return new Response(JSON.stringify({
      success: response.ok,
      data: responseData,
      message: `Mensagem ${type} enviada com sucesso`
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro no envio da mensagem:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});