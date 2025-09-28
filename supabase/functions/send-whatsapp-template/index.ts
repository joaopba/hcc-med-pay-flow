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
    console.log('Recebendo requisição WhatsApp...');
    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId }: WhatsAppRequest = await req.json();
    console.log('Dados recebidos:', { type, numero, nome, valor, competencia, dataPagamento, pagamentoId });

    // Buscar configurações da API
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Env vars check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey 
    });

    const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '');

    console.log('Buscando configurações...');
    const { data: config, error: configError } = await supabase
      .from('configuracoes')
      .select('api_url, auth_token')
      .single();

    if (configError) {
      console.error('Erro ao buscar configurações:', configError);
      throw new Error(`Erro ao buscar configurações: ${configError.message}`);
    }

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

    if (payload) {
      logData.payload = payload;
    }

    console.log('Enviando mensagem WhatsApp:', {
      template: templateName,
      numero,
      payload,
      apiUrl: `${config.api_url}/template`
    });

    console.log('Config encontrada:', {
      apiUrl: config.api_url,
      hasToken: !!config.auth_token
    });

    // Enviar para a API do WhatsApp
    console.log('Fazendo requisição para:', `${config.api_url}/template`);
    const response = await fetch(`${config.api_url}/template`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const responseData = await response.json();
    console.log('Response data:', responseData);
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

    // Se a resposta contém "Encaminhar Nota", enviar mensagem pedindo a nota
    if (type === 'nota' && responseData && 
        (JSON.stringify(responseData).toLowerCase().includes('encaminhar nota') || 
         JSON.stringify(responseData).toLowerCase().includes('encaminhar_nota'))) {
      
      console.log('Detectada resposta "Encaminhar Nota", enviando mensagem de solicitação...');
      
      try {
        const messagePayload = {
          body: "Por gentileza, encaminhe a nota fiscal em PDF para prosseguir com o pagamento. Aguardo o documento para finalizar o processo.",
          number: numero,
          externalKey: `nota_request_${pagamentoId}_${Date.now()}`,
          isClosed: false
        };

        console.log('Enviando mensagem de solicitação:', messagePayload);

        const messageResponse = await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.auth_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        const messageResponseData = await messageResponse.json();
        console.log('Resposta da mensagem de solicitação:', messageResponseData);

        // Registrar log da mensagem de solicitação
        await supabase
          .from('message_logs')
          .insert([{
            pagamento_id: pagamentoId,
            tipo: 'solicitacao_nota',
            payload: messagePayload,
            success: messageResponse.ok,
            response: messageResponseData
          }]);

        console.log('Mensagem de solicitação enviada com sucesso');
      } catch (messageError) {
        console.error('Erro ao enviar mensagem de solicitação:', messageError);
      }
    }

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
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});