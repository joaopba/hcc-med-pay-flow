import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada' | 'encaminhar_nota' | 'nota_recebida';
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

    // Idempotência: evitar mensagens duplicadas em curto intervalo
    if (pagamentoId) {
      const since = new Date(Date.now() - 20000).toISOString(); // 20s
      const { data: recent, error: recentError } = await supabase
        .from('message_logs')
        .select('id, created_at')
        .eq('pagamento_id', pagamentoId)
        .eq('tipo', `whatsapp_${type}`)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!recentError && recent && recent.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          data: { skipped: true },
          message: 'Mensagem já enviada recentemente (idempotência)'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });
      }
    }

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
        message = `🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá, ${nome}! Para darmos sequência ao seu pagamento, precisamos da sua nota fiscal.\n\n💰 Valor: R$ ${valor}\n📅 Competência: ${competencia}\n\n🔗 Acesse o portal oficial:\nhttps://hcc.chatconquista.com/dashboard-medicos\n\n📝 Passo a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em "Anexar Nota Fiscal"\n4) Envie o PDF (legível, até 10MB)\n\n⚡ Dicas importantes:\n• Documento completo e sem senha\n• Revise os dados antes de enviar\n\n✅ Após o envio: você receberá confirmação e será avisado sobre a análise.`;
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
      
      case 'nota_recebida':
        message = `✅ *Nota Fiscal Recebida*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi recebida com sucesso.\n\n📋 Status: Em análise\n⏱️ Prazo: Até 24h úteis\n\nVocê será notificado assim que a análise for concluída.\n\nObrigado!`;
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
        message = `❌ *Nota Fiscal Rejeitada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${competencia} foi rejeitada.\n\n*Motivo:* ${motivo}\n\nPor favor, corrija o documento e envie novamente através do nosso portal:\n\n🔗 ${linkPortal || 'https://hcc.chatconquista.com/dashboard-medicos'}\n\nPrecisa de ajuda? Entre em contato conosco.`;
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

    console.log('Adicionando mensagem à fila WhatsApp:', payload);
    console.log('Tipo:', type);

    // Adicionar mensagem à fila ao invés de enviar diretamente
    const { data: queueData, error: queueError } = await supabase
      .from('whatsapp_queue')
      .insert({
        numero_destino: phoneNumber!,
        tipo_mensagem: type === 'nota' ? 'template' : 'text',
        payload: payload,
        prioridade: type === 'nota' ? 1 : type === 'nota_rejeitada' ? 2 : 5 // Priorizar solicitações e rejeições
      })
      .select()
      .single();

    if (queueError) {
      console.error('Erro ao adicionar mensagem à fila:', queueError);
      throw queueError;
    }

    console.log('Mensagem adicionada à fila com sucesso:', queueData.id);

    // Log da mensagem se tiver pagamentoId (registrar como pendente na fila)
    if (pagamentoId) {
      try {
        await supabase
          .from('message_logs')
          .insert([{
            pagamento_id: pagamentoId,
            tipo: `whatsapp_${type}`,
            payload: payload,
            success: false, // Ainda não foi enviado
            response: { status: 'queued', queue_id: queueData.id }
          }]);
      } catch (logError) {
        console.warn('Erro ao registrar log:', logError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: { queue_id: queueData.id, status: 'queued' },
      message: `Mensagem ${type} adicionada à fila com sucesso`
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