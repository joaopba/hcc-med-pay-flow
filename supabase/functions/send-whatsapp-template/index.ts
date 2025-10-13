import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada' | 'encaminhar_nota' | 'nota_recebida' | 'nova_mensagem_chat' | 'resposta_financeiro' | 'nota_aprovacao';
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
  numero_destino?: string;
  medico_nome?: string;
  mensagem_preview?: string;
  mensagem?: string;
  medico_id?: string;
  nota_id?: string;
  pdf_base64?: string;
  pdf_filename?: string;
  link_aprovar?: string;
  link_rejeitar?: string;
  financeiro_numero?: string;
  valorBruto?: number;
  valorLiquido?: number;
}

// Função auxiliar para encurtar URL
async function shortenUrl(url: string): Promise<string> {
  try {
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      const shortUrl = await response.text();
      return shortUrl.trim();
    }
  } catch (error) {
    console.warn('Erro ao encurtar URL, usando original:', error);
  }
  return url;
}

// Função para verificar janela de 24h
async function checkLast24Hours(supabase: any, medicoId: string): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('medico_id', medicoId)
    .eq('sender_type', 'medico')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1);
  
  return recentMessages && recentMessages.length > 0;
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

    const requestData: WhatsAppRequest = await req.json();
    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId, medico, motivo, linkPortal, numero_destino, medico_nome, mensagem_preview, mensagem, medico_id, nota_id, pdf_base64, pdf_filename, link_aprovar, link_rejeitar, financeiro_numero, valorBruto, valorLiquido } = requestData;

    // Função para processar o envio em background
    async function processarEnvio() {
      try {
        console.log(`[Background] Processando envio tipo: ${type}`);
        
        // Buscar configurações da API
        const { data: config, error: configError } = await supabase
          .from('configuracoes')
          .select('api_url, auth_token')
          .maybeSingle();

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
          const { data: recent } = await supabase
            .from('message_logs')
            .select('id, created_at')
            .eq('pagamento_id', pagamentoId)
            .eq('tipo', `whatsapp_${type}`)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recent && recent.length > 0) {
            console.log('[Background] Mensagem já enviada recentemente (idempotência)');
            return;
          }
        }

        switch (type) {
          case 'nota':
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
                        { type: "text", text: nome },
                        { type: "text", text: valor },
                        { type: "text", text: competencia }
                      ]
                    }
                  ]
                }
              }
            };
            apiUrl = config.api_url + '/template';
            
            // Enviar vídeo tutorial após o template
            try {
              const videoPayload = {
                number: phoneNumber,
                body: "🎥 Vídeo Tutorial - Como Anexar Nota Fiscal",
                mediaData: {
                  mediaUrl: "https://hcc.chatconquista.com/videos/tutorial-anexar-nota.MOV",
                  caption: "📹 Tutorial: Como anexar sua nota fiscal no portal"
                }
              };
              
              await fetch(config.api_url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.auth_token}`
                },
                body: JSON.stringify(videoPayload)
              });
              console.log('[Background] Vídeo tutorial enviado após template');
            } catch (videoError) {
              console.warn('[Background] Erro ao enviar vídeo:', videoError);
            }
            break;
          
          case 'encaminhar_nota':
            message = `🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá, ${nome}! Para darmos sequência ao seu pagamento, precisamos da sua nota fiscal.\n\n💰 Valor: R$ ${valor}\n📅 Competência: ${competencia}\n\n🔗 Acesse o portal oficial:\nhttps://hcc.chatconquista.com/dashboard-medicos\n\n📝 Passo a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em "Anexar Nota Fiscal"\n4) Envie o PDF (legível, até 10MB)\n\n⚡ Dicas importantes:\n• Documento completo e sem senha\n• Revise os dados antes de enviar\n\n📹 Enviamos um vídeo explicativo mostrando como anexar sua nota passo a passo!\n\n✅ Após o envio: você receberá confirmação e será avisado sobre a análise.`;
            
            // Primeiro enviar o vídeo
            const videoPayload = {
              number: phoneNumber,
              body: "🎥 Vídeo Tutorial - Como Anexar Nota Fiscal",
              mediaData: {
                mediaUrl: "https://hcc.chatconquista.com/videos/tutorial-anexar-nota.MOV",
                caption: "📹 Tutorial: Como anexar sua nota fiscal no portal"
              }
            };
            
            try {
              await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.auth_token}`
                },
                body: JSON.stringify(videoPayload)
              });
              console.log('[Background] Vídeo tutorial enviado');
            } catch (videoError) {
              console.warn('[Background] Erro ao enviar vídeo:', videoError);
            }
            
            payload = {
              body: message,
              number: phoneNumber,
              externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
              isClosed: false
            };
            break;
          
          case 'pagamento':
            const within24Hours = medico_id ? await checkLast24Hours(supabase, medico_id) : false;
            
            if (within24Hours) {
              console.log('[Background] Dentro da janela de 24h - enviando mensagem livre');
              message = `💰 *Pagamento Efetuado*\n\nOlá ${nome}!\n\nSeu pagamento foi efetuado com sucesso em ${dataPagamento}.\n\nObrigado por sua colaboração!`;
              payload = {
                body: message,
                number: phoneNumber,
                externalKey: `${type}_${pagamentoId || medico?.nome || Date.now()}_${Date.now()}`,
                isClosed: false
              };
            } else {
              console.log('[Background] Fora da janela de 24h - usando template "pagamento"');
              payload = {
                number: phoneNumber,
                isClosed: false,
                templateData: {
                  messaging_product: "whatsapp",
                  to: phoneNumber,
                  type: "template",
                  template: {
                    name: "pagamento",
                    language: { code: "pt_BR" },
                    components: [
                      { 
                        type: "body", 
                        parameters: [
                          { type: "text", text: nome },
                          { type: "text", text: dataPagamento || new Date().toLocaleDateString('pt-BR') }
                        ]
                      }
                    ]
                  }
                }
              };
              apiUrl = config.api_url + '/template';
            }
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
          
          case 'nota_aprovacao':
            phoneNumber = financeiro_numero;
            const shortAprovar = await shortenUrl(link_aprovar || '');
            const shortRejeitar = await shortenUrl(link_rejeitar || '');
            const valorBrutoFormatado = valorBruto ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorBruto) : valor;
            const valorLiquidoFormatado = valorLiquido ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorLiquido) : 'Não informado';
            
            const caption = `📄 *Nova Nota Fiscal para Aprovação*\n\n👨‍⚕️ Médico: ${nome}\n💰 Valor Bruto: ${valorBrutoFormatado}\n💵 Valor Líquido: ${valorLiquidoFormatado}\n📅 Competência: ${competencia}\n\n✅ Aprovar:\n${shortAprovar}\n\n❌ Rejeitar:\n${shortRejeitar}`;
            const derivedFileName = (pdf_filename || `nota_${(nome || 'medico').replace(/\s+/g, '_')}_${competencia}.pdf`);
            
            payload = {
              number: phoneNumber,
              body: caption,
              mediaData: {
                mediaBase64: pdf_base64,
                caption,
                fileName: derivedFileName
              },
              file: {
                data: pdf_base64,
                fileName: derivedFileName,
                filename: derivedFileName
              }
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
          
          case 'nova_mensagem_chat':
            phoneNumber = numero_destino;
            const linkResposta = await shortenUrl(`https://hcc.chatconquista.com/chat?medico=${medico_id || ''}&responder=true`);
            message = `💬 *Nova Mensagem no Chat*\n\n*De:* ${medico_nome}\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Responder agora:\n${linkResposta}\n\nOu acesse o sistema para visualizar o histórico completo.`;
            payload = {
              body: message,
              number: phoneNumber,
              externalKey: `chat_${medico_id}_${Date.now()}`,
              isClosed: false
            };
            break;
          
          case 'resposta_financeiro':
            phoneNumber = numero_destino;
            const linkChatMedico = await shortenUrl(`https://hcc.chatconquista.com/dashboard-medicos`);
            message = `💬 *Nova Resposta do Financeiro*\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Ver conversa:\n${linkChatMedico}\n\nAcesse seu painel para continuar a conversa.`;
            payload = {
              body: message,
              number: phoneNumber,
              externalKey: `chat_resp_${Date.now()}`,
              isClosed: false
            };
            break;
          
          default:
            throw new Error('Tipo de mensagem inválido');
        }

        console.log('[Background] Enviando para API WhatsApp:', apiUrl);

        // Enviar mensagem
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
          },
          body: JSON.stringify(payload)
        });

        console.log('[Background] Status da resposta:', response.status);

        const contentType = response.headers.get('content-type');
        let responseData: any;
        
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          const textResponse = await response.text();
          console.error('[Background] Resposta não é JSON:', textResponse.substring(0, 500));
          throw new Error(`API retornou resposta não-JSON (${response.status})`);
        }
        
        console.log('[Background] Resposta da API:', responseData);

        // Verificar erros
        const isDuplicateContactError = responseData.message && 
          (responseData.message.includes('SequelizeUniqueConstraintError') ||
           responseData.message.includes('contacts_number_tenantid'));
        
        const hasError = !response.ok || 
                         responseData.error || 
                         (responseData.message && (
                           responseData.message.includes('error') ||
                           responseData.message.includes('Error') ||
                           responseData.message.toLowerCase().includes('sent error')
                         ));
        
        if (hasError && !isDuplicateContactError) {
          const errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
          console.error('[Background] Erro ao enviar:', errorMsg);
          throw new Error(`Erro ao enviar WhatsApp: ${errorMsg}`);
        }
        
        if (isDuplicateContactError) {
          console.warn('[Background] Contato duplicado ignorado');
        }

        // Log da mensagem
        if (pagamentoId) {
          try {
            await supabase
              .from('message_logs')
              .insert([{
                pagamento_id: pagamentoId,
                tipo: `whatsapp_${type}`,
                payload: payload,
                success: true,
                response: responseData
              }]);
          } catch (logError) {
            console.warn('[Background] Erro ao registrar log:', logError);
          }
        }

        console.log('[Background] Envio concluído com sucesso');
      } catch (error: any) {
        console.error('[Background] Erro no processamento:', error);
      }
    }

    // Iniciar processamento em background
    // @ts-ignore - EdgeRuntime.waitUntil exists in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(processarEnvio());
    } else {
      // Fallback para desenvolvimento local
      processarEnvio();
    }

    // Retornar resposta imediata
    return new Response(JSON.stringify({
      success: true,
      message: `Mensagem ${type} está sendo processada em segundo plano`,
      queued: true
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro ao processar requisição:', error);
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
