import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada' | 'encaminhar_nota';
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
  linkPortal?: string;
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

    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId, medico, motivo, linkPortal }: WhatsAppRequest = await req.json();

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

    let payload: any;
    let apiUrl = config.api_url;

    switch (type) {
      case 'nota':
        // Usar template estruturado para solicitação de nota
        payload = {
          number: phoneNumber,
          isClosed: false,
          templateData: {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "template",
            template: {
              name: "nota",
              language: { code: "pt_BR" },
              components: [
                { 
                  type: "body", 
                  parameters: [
                    { type: "text", text: nome }, // nome do médico
                    { type: "text", text: valor }, // valor da solicitação
                    { type: "text", text: competencia } // Competência de pagamento
                  ]
                }
              ]
            }
          }
        };
        // Usar endpoint /template para templates
        apiUrl = config.api_url + '/template';
        break;
      
      case 'encaminhar_nota':
        message = `🏥 *Portal de Notas Fiscais - HCC Hospital*\n\n👋 Olá, ${nome}!\n\n📋 Você tem um pagamento pendente que precisa da sua nota fiscal para ser processado.\n\n💰 **Valor:** R$ ${valor}\n📅 **Competência:** ${competencia}\n\n🔗 **Acesse nosso portal oficial:**\nhttps://hcc-med-pay-flow.lovable.app/dashboard-medicos\n\n📝 **Passo a passo simples:**\n1️⃣ Digite seu CPF no sistema\n2️⃣ Localize este pagamento na lista\n3️⃣ Clique em "Anexar Nota Fiscal"\n4️⃣ Faça o upload do arquivo PDF\n5️⃣ Confirme o envio\n\n⚡ **Informações importantes:**\n• Apenas arquivos PDF são aceitos\n• Tamanho máximo: 10MB\n• A nota deve estar legível e completa\n• Verifique todos os dados antes de enviar\n\n📞 **Precisa de ajuda?**\nNossa equipe está disponível para auxiliá-lo durante o horário comercial.\n\n✅ **Após o envio:** Você receberá uma confirmação e será notificado sobre o status da análise.\n\n🚀 **Processamento rápido:** Notas corretas são aprovadas em até 24h úteis!`;
        payload = {
          body: message,
          number: phoneNumber,
          externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
          isClosed: false
        };
        break;
      
      case 'pagamento':
        message = `💰 *Pagamento Efetuado*\n\nOlá ${nome}!\n\nSeu pagamento foi efetuado com sucesso em ${dataPagamento}.\n\nObrigado por sua colaboração!`;
        payload = {
          body: message,
          number: phoneNumber,
          externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
          isClosed: false
        };
        break;
      
      case 'nota_aprovada':
        message = `✅ *Nota Fiscal Aprovada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi aprovada.\n\nO pagamento está sendo processado e você será notificado quando estiver disponível.\n\nObrigado!`;
        payload = {
          body: message,
          number: phoneNumber,
          externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
          isClosed: false
        };
        break;
      
      case 'nota_rejeitada':
        message = `❌ *Nota Fiscal Rejeitada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi rejeitada.\n\n*Motivo:* ${motivo}\n\nPor favor, corrija o documento e envie novamente através do nosso portal:\n\n🔗 ${linkPortal || 'https://hcc-med-pay-flow.lovable.app/dashboard-medicos'}\n\nPrecisa de ajuda? Entre em contato conosco.`;
        payload = {
          body: message,
          number: phoneNumber,
          externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
          isClosed: false
        };
        break;
      
      default:
        throw new Error('Tipo de mensagem inválido');
    }

    console.log('Enviando mensagem WhatsApp:', payload);
    console.log('URL da API:', apiUrl);

    const response = await fetch(apiUrl, {
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