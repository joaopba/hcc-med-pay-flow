import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  type: 'nota' | 'pagamento';
  numero: string;
  nome: string;
  valor?: string;
  competencia?: string;
  dataPagamento?: string;
  pagamentoId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId }: WhatsAppRequest = await req.json();

    // Buscar configurações da API
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: config } = await supabase
      .from('configuracoes')
      .select('api_url, auth_token')
      .single();

    if (!config) {
      throw new Error('Configurações não encontradas');
    }

    let payload;
    let templateName;
    let logData = {
      pagamento_id: pagamentoId,
      tipo: type,
      payload: {},
      success: false,
      response: {}
    };

    if (type === 'nota') {
      templateName = 'nota';
      payload = {
        number: numero,
        isClosed: false,
        templateData: {
          messaging_product: "whatsapp",
          to: numero,
          type: "template",
          template: {
            name: "nota",
            language: { code: "pt_BR" },
            components: [
              { type: "body", parameters: [
                { type: "text", text: nome },
                { type: "text", text: valor },
                { type: "text", text: competencia }
              ]}
            ]
          }
        }
      };
    } else if (type === 'pagamento') {
      templateName = 'pagamento';
      payload = {
        number: numero,
        isClosed: false,
        templateData: {
          messaging_product: "whatsapp",
          to: numero,
          type: "template",
          template: {
            name: "pagamento",
            language: { code: "pt_BR" },
            components: [
              { type: "body", parameters: [
                { type: "text", text: nome },
                { type: "text", text: dataPagamento }
              ]}
            ]
          }
        }
      };
    }

    logData.payload = payload;

    console.log('Enviando mensagem WhatsApp:', {
      template: templateName,
      numero,
      payload
    });

    // Enviar para a API do WhatsApp
    const response = await fetch(`${config.api_url}/template`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    logData.response = responseData;

    if (!response.ok) {
      throw new Error(`Erro da API: ${response.status} - ${JSON.stringify(responseData)}`);
    }

    logData.success = true;

    // Registrar log
    if (pagamentoId) {
      await supabase
        .from('message_logs')
        .insert([logData]);
    }

    console.log('Mensagem enviada com sucesso:', responseData);

    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      message: 'Mensagem enviada com sucesso'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});