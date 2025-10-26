import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para formatar mês de competência
function formatMesCompetencia(mesCompetencia: string): string {
  if (!mesCompetencia || !mesCompetencia.includes('-')) return mesCompetencia;
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  const mesNome = meses[mesIndex] || mes;
  return `${mesNome} - ${ano}`;
}

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada' | 'nota_recebida' | 'nova_mensagem_chat' | 'resposta_financeiro' | 'nota_aprovacao' | 'valor_ajustado' | 'nota_pendente';
  numero?: string;
  nome?: string;
  valor?: string | number;
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
  valorOriginal?: string;
  valorNovo?: string;
  numeroNota?: string;
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
    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId, medico, motivo, linkPortal, numero_destino, medico_nome, mensagem_preview, mensagem, medico_id, nota_id, pdf_base64, pdf_filename, link_aprovar, link_rejeitar, financeiro_numero, valorBruto, valorLiquido, valorOriginal, valorNovo, numeroNota } = requestData;

    // Função para processar o envio em background
    async function processarEnvio() {
      try {
        console.log(`[Background] Processando envio tipo: ${type}`);
        
        // Meta API (templates) - direto pela Meta sem intermediário
        const META_API_URL = 'https://graph.facebook.com/v21.0/468233466375447/messages';
        const META_TOKEN = 'EAAXSNrvzpbABP7jYQp5lgOw48kSOA5UugXYTs2ZBExZBrDtaC1wUr3tCfZATZBT9SAqmGpZA1pAucXVRa8kZC7trtip0rHAERY0ZAcZA6MkxDsosyCI8O35g0mmBpBuoB8lqihDPvhjsmKz6madZCARKbVW5ihUZCWZCmiND50zARf1Tk58ZAuIlzZAfJ9IzHZCXIZC5QZDZD';
        
        // API intermediária (texto e mídia)
        const TEXT_API_URL = 'https://auto.hcchospital.com.br/message/sendText/inovação';
        const TEXT_API_KEY = 'BA6138D0B74C-4AED-8E91-8B3B2C337811';
        const MEDIA_API_URL = 'https://auto.hcchospital.com.br/message/sendMedia/inovação';
        const MEDIA_API_KEY = 'BA6138D0B74C-4AED-8E91-8B3B2C337811';

        let message = '';
        let phoneNumber = numero;

        // Para tipos que usam o objeto médico
        if (medico?.numero_whatsapp) {
          phoneNumber = medico.numero_whatsapp;
        }

        let payload: any;
        let apiUrl = TEXT_API_URL;
        let apiKey = TEXT_API_KEY;
        let useTemplate = false;

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
            // Enviar apenas o template do Facebook com botões
            const within24Hours = medico_id ? await checkLast24Hours(supabase, medico_id) : false;
            
            if (within24Hours) {
              console.log('[Background] Dentro da janela de 24h - enviando mensagem livre');
              message = `🏥 *Solicitação de Nota Fiscal - HCC Hospital*\n\nOlá, ${nome}!\n\nPara darmos sequência ao seu pagamento, precisamos da sua nota fiscal.\n\n💰 Valor: ${valor}\n📅 Competência: ${formatMesCompetencia(competencia || '')}\n\nClique no botão abaixo para receber as instruções de como enviar.`;
              payload = {
                number: phoneNumber,
                text: message
              };
              apiUrl = TEXT_API_URL;
              apiKey = TEXT_API_KEY;
            } else {
              console.log('[Background] Fora da janela de 24h - usando template "nota_hcc" via Meta API');
              payload = {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "template",
                template: {
                  name: "nota_hcc",
                  language: { code: "pt_BR" },
                  components: [
                    {
                      type: "body",
                      parameters: [
                        { type: "text", text: nome },
                        { type: "text", text: valor },
                        { type: "text", text: formatMesCompetencia(competencia || '') }
                      ]
                    }
                  ]
                }
              };
              apiUrl = META_API_URL;
              apiKey = META_TOKEN;
              useTemplate = true;
            }
            break;
          
          case 'nota_pendente':
            // Template de lembrete para notas pendentes (mesmas variáveis do template nota)
            console.log('[Background] Usando template "nota_pendente" para lembrete');
            const valorFormatado = typeof valor === 'number' 
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
              : valor;
            
            payload = {
              messaging_product: "whatsapp",
              to: phoneNumber,
              type: "template",
              template: {
                name: "nota_pendente",
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: medico?.nome || nome },
                      { type: "text", text: valorFormatado },
                      { type: "text", text: formatMesCompetencia(competencia || '') }
                    ]
                  }
                ]
              }
            };
            apiUrl = META_API_URL;
            apiKey = META_TOKEN;
            useTemplate = true;
            break;
          
          case 'pagamento':
            const within24HoursPagamento = medico_id ? await checkLast24Hours(supabase, medico_id) : false;
            
            if (within24HoursPagamento) {
              console.log('[Background] Dentro da janela de 24h - enviando mensagem livre');
              message = `💰 *Pagamento Efetuado*\n\nOlá ${nome}!\n\nSeu pagamento foi efetuado com sucesso em ${dataPagamento}.\n\nObrigado por sua colaboração!`;
              payload = {
                number: phoneNumber,
                text: message
              };
              apiUrl = TEXT_API_URL;
              apiKey = TEXT_API_KEY;
            } else {
              console.log('[Background] Fora da janela de 24h - usando template "pagamento" via Meta API');
              payload = {
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
              };
              apiUrl = META_API_URL;
              apiKey = META_TOKEN;
              useTemplate = true;
            }
            break;
          
          case 'nota_recebida':
            message = `✅ *Nota Fiscal Recebida*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi recebida com sucesso.\n\n📋 Status: Em análise\n⏱️ Prazo: Até 24h úteis\n\nVocê será notificado assim que a análise for concluída.\n\nObrigado!`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          case 'nota_aprovacao':
            phoneNumber = financeiro_numero;
            const shortAprovar = await shortenUrl(link_aprovar || '');
            const shortRejeitar = await shortenUrl(link_rejeitar || '');
            const valorBrutoFormatado = valorBruto ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorBruto) : valor;
            const valorLiquidoFormatado = valorLiquido ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorLiquido) : 'Não informado';
            
            const caption = `📄 *Nova Nota Fiscal para Aprovação*\n\n👨‍⚕️ Médico: ${nome}${numeroNota ? `\n🧾 Nº Nota: ${numeroNota}` : ''}\n💰 Valor Bruto: ${valorBrutoFormatado}\n💵 Valor Líquido: ${valorLiquidoFormatado}\n   ⚠️ *Valor informado pelo médico - VERIFICAR*\n📅 Competência: ${formatMesCompetencia(competencia || '')}\n\n⚡ *IMPORTANTE:* Confira se o valor líquido está correto antes de aprovar!\n\n✅ Aprovar:\n${shortAprovar}\n\n❌ Rejeitar:\n${shortRejeitar}`;
            
            payload = {
              number: phoneNumber,
              caption: caption,
              mediaBase64: pdf_base64,
              filename: pdf_filename || `nota_${(nome || 'medico').replace(/\s+/g, '_')}_${competencia}.pdf`
            };
            apiUrl = MEDIA_API_URL;
            apiKey = MEDIA_API_KEY;
            break;
          
          case 'nota_aprovada':
            message = `✅ *Nota Fiscal Aprovada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi aprovada.\n\nO pagamento está sendo processado e você será notificado quando estiver disponível.\n\nObrigado!`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          case 'nota_rejeitada':
            message = `❌ *Nota Fiscal Rejeitada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi rejeitada.\n\n*Motivo:* ${motivo}\n\nPor favor, corrija o documento e envie novamente através do nosso portal:\n\n🔗 ${linkPortal || 'https://hcc.chatconquista.com/dashboard-medicos'}\n\nPrecisa de ajuda? Entre em contato conosco.`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          case 'nova_mensagem_chat':
            phoneNumber = numero_destino;
            const linkResposta = await shortenUrl(`https://hcc.chatconquista.com/chat?medico=${medico_id || ''}&responder=true`);
            message = `💬 *Nova Mensagem no Chat*\n\n*De:* ${medico_nome}\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Responder agora:\n${linkResposta}\n\nOu acesse o sistema para visualizar o histórico completo.`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          case 'resposta_financeiro':
            phoneNumber = numero_destino;
            const linkChatMedico = await shortenUrl(`https://hcc.chatconquista.com/dashboard-medicos`);
            message = `💬 *Nova Resposta do Financeiro*\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Ver conversa:\n${linkChatMedico}\n\nAcesse seu painel para continuar a conversa.`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          case 'valor_ajustado':
            message = `⚠️ *Valor da Nota Ajustado*\n\nOlá ${medico?.nome}!\n\nO valor líquido da sua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi ajustado.\n\n💰 Valor Original: ${valorOriginal}\n💵 Novo Valor: ${valorNovo}\n\n📝 *Motivo do Ajuste:*\n${motivo}\n\nSe tiver dúvidas, entre em contato conosco.`;
            payload = {
              number: phoneNumber,
              text: message
            };
            apiUrl = TEXT_API_URL;
            apiKey = TEXT_API_KEY;
            break;
          
          default:
            throw new Error('Tipo de mensagem inválido');
        }

        console.log('[Background] Enviando para API WhatsApp:', apiUrl);

        // Enviar mensagem principal
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Usar cabeçalho correto dependendo da API
        if (useTemplate) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        } else {
          headers['x-api-key'] = apiKey;
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
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

        // Se houver número do contador e for uma notificação relevante, enviar também para ele
        if (['nota', 'nota_pendente', 'nota_aprovada', 'nota_rejeitada', 'nota_recebida', 'valor_ajustado'].includes(type) && medico_id) {
          try {
            const { data: medicoCompleto } = await supabase
              .from('medicos')
              .select('numero_whatsapp_contador')
              .eq('id', medico_id)
              .maybeSingle();

            if (medicoCompleto?.numero_whatsapp_contador) {
              console.log('[Background] Enviando também para contador:', medicoCompleto.numero_whatsapp_contador);
              
              // Criar payload para contador
              let payloadContador;
              
              if (useTemplate) {
                payloadContador = { ...payload, to: medicoCompleto.numero_whatsapp_contador };
              } else {
                payloadContador = { ...payload, number: medicoCompleto.numero_whatsapp_contador };
              }
              
              const headersContador: Record<string, string> = {
                'Content-Type': 'application/json'
              };
              
              if (useTemplate) {
                headersContador['Authorization'] = `Bearer ${apiKey}`;
              } else {
                headersContador['x-api-key'] = apiKey;
              }
              
              await fetch(apiUrl, {
                method: 'POST',
                headers: headersContador,
                body: JSON.stringify(payloadContador)
              });
              
              console.log('[Background] Mensagem enviada para contador com sucesso');
            }
          } catch (error) {
            console.error('[Background] Erro ao enviar para contador (não crítico):', error);
          }
        }

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
