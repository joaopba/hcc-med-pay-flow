import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verificação inicial do webhook do WhatsApp
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Verificação do webhook WhatsApp:', { mode, token: token ? 'presente' : 'ausente', challenge: challenge ? 'presente' : 'ausente' });

    if (mode === 'subscribe' && token === (Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'webhook_verify_token')) {
      console.log('Verificação do webhook aprovada');
      return new Response(challenge, {
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      });
    } else {
      console.log('Verificação do webhook rejeitada');
      return new Response('Forbidden', { 
        status: 403,
        headers: corsHeaders 
      });
    }
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ===== MODO DEBUG: CAPTURAR TODOS OS DADOS DO WEBHOOK =====
    
    // 1. Capturar headers
    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      headers[key] = value;
    }
    
    // 2. Capturar URL e query params
    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    // 3. Capturar body
    let webhookData;
    let rawBody = '';
    
    try {
      const text = await req.text();
      rawBody = text;
      
      // Tentar parsear como JSON
      try {
        webhookData = JSON.parse(text);
      } catch {
        // Se não for JSON válido, manter como string
        webhookData = text;
      }
    } catch {
      webhookData = 'Erro ao ler body';
    }

    // 4. Log completo de TUDO
    console.log('='.repeat(80));
    console.log('🔍 WEBHOOK DEBUG - CAPTURA COMPLETA');
    console.log('='.repeat(80));
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 Método:', req.method);
    console.log('📍 URL completa:', req.url);
    console.log('📝 Path:', url.pathname);
    console.log('🔗 Query Params:', JSON.stringify(queryParams, null, 2));
    console.log('📋 Headers:', JSON.stringify(headers, null, 2));
    console.log('📦 Raw Body:', rawBody);
    console.log('🎯 Parsed Body:', JSON.stringify(webhookData, null, 2));
    console.log('📏 Content-Length:', headers['content-length'] || 'não informado');
    console.log('📄 Content-Type:', headers['content-type'] || 'não informado');
    console.log('🔒 User-Agent:', headers['user-agent'] || 'não informado');
    console.log('='.repeat(80));
    
    // 5. Salvar no banco para análise posterior
    try {
      await supabase.from('webhook_debug_logs').insert({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: headers,
        query_params: queryParams,
        raw_body: rawBody,
        parsed_body: webhookData,
        user_agent: headers['user-agent'] || null,
        content_type: headers['content-type'] || null
      });
    } catch (dbError) {
      console.log('⚠️ Erro ao salvar no banco (normal se a tabela não existir):', dbError);
    }
    
    // ===== FIM DO MODO DEBUG =====

    // Verificar se é um clique no botão "Encaminhar Nota"
    if (webhookData.msg && webhookData.msg.type === 'button' && 
        webhookData.msg.button && webhookData.msg.button.payload === 'Encaminhar Nota') {
      
      const from = webhookData.ticket?.contact?.number || webhookData.msg.from;
      console.log('Botão "Encaminhar Nota" clicado por:', from);
      
      try {
        // Buscar configurações da API
        const { data: config, error: configError } = await supabase
          .from('configuracoes')
          .select('api_url, auth_token')
          .single();

        if (configError || !config) {
          throw new Error('Configurações não encontradas');
        }

        const messagePayload = {
          body: "Por favor, acesse nosso portal para enviar sua nota fiscal: " + 
                `${req.headers.get('origin') || 'https://nnytrkgsjajsecotasqv.supabase.co'}/notas-medicos\n\n` +
                "Digite seu CPF para localizar seus pagamentos pendentes e anexe o arquivo PDF da nota fiscal.",
          number: from,
          externalKey: `nota_request_button_${Date.now()}`,
          isClosed: false
        };

        console.log('Enviando mensagem de solicitação via botão:', messagePayload);

        const messageResponse = await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.auth_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        const messageResponseData = await messageResponse.json();
        console.log('Resposta da mensagem de solicitação via botão:', messageResponseData);

        // Registrar log da mensagem de solicitação (apenas se houver pagamento associado)
        try {
          const numeroLimpo = String(from || '').replace(/\D/g, '');
          const { data: pagamentosAssoc } = await supabase
            .from('pagamentos')
            .select(`id, status, medicos!inner(numero_whatsapp)`) 
            .in('status', ['pendente','solicitado'])
            .ilike('medicos.numero_whatsapp', `%${numeroLimpo}%`)
            .order('created_at', { ascending: false })
            .limit(1);

          const pagamentoId = pagamentosAssoc?.[0]?.id;
          if (pagamentoId) {
            await supabase
              .from('message_logs')
              .insert([{ 
                pagamento_id: pagamentoId,
                tipo: 'solicitacao_nota',
                payload: messagePayload,
                success: messageResponse.ok,
                response: messageResponseData
              }]);
          } else {
            console.warn('Sem pagamento associado para log de solicitação; pulando insert.');
          }
        } catch (logError) {
          console.warn('Falha ao registrar log de solicitação:', logError);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Mensagem de solicitação enviada via botão'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });

      } catch (error) {
        console.error('Erro ao enviar mensagem via botão:', error);
      }
    }

    // Verificar se é uma mensagem com arquivo PDF (formato atualizado)
    if ((webhookData.msg && webhookData.msg.type === 'document') || 
        (webhookData.msg && webhookData.msg.mediaType === 'document')) {
      const { msg, ticket } = webhookData;
      const document = msg.document;
      const from = ticket?.contact?.number || msg.from;
      const wabaMediaId = msg.wabaMediaId || document?.id;
      
      console.log('Detalhes do documento:', { document, wabaMediaId, from });
      
      // Verificar se temos as informações necessárias
      if (!wabaMediaId) {
        console.log('wabaMediaId não encontrado no documento');
        return new Response(JSON.stringify({ status: 'success', message: 'wabaMediaId não encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Determinar o nome do arquivo
      let filename = 'documento.pdf';
      if (document?.filename) {
        filename = document.filename;
      } else if (msg.body) {
        // Se não tem document.filename, usar o body da mensagem que pode conter o nome
        filename = msg.body;
      }

      if ((document && document.mime_type === 'application/pdf') || 
          (msg.mediaType === 'document' && wabaMediaId)) {
        console.log('PDF recebido de:', from, 'Arquivo:', filename);

        // Buscar pagamento pendente para este número
        const numeroLimpo = from.replace(/\D/g, '');
        console.log('Número limpo extraído:', numeroLimpo);
        
        const { data: pagamentos } = await supabase
          .from('pagamentos')
          .select(`
            id, 
            valor,
            status,
            created_at,
            medicos!inner(numero_whatsapp, nome)
          `)
          .in('status', ['pendente','solicitado'])
          .ilike('medicos.numero_whatsapp', `%${numeroLimpo}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        
        console.log('Pagamentos encontrados:', pagamentos);

        let pagamento: any = (pagamentos && pagamentos.length > 0) ? pagamentos[0] : null;

        // Se não encontrou pelo join, tentar localizar o médico por variações do número (com/sem o 9)
        if (!pagamento) {
          const variants = brPhoneVariants(numeroLimpo);
          let medicoId: string | null = null;
          for (const v of variants) {
            const { data: medicoMatch } = await supabase
              .from('medicos')
              .select('id')
              .ilike('numero_whatsapp', `%${v}%`)
              .limit(1);
            if (medicoMatch && medicoMatch.length > 0) {
              medicoId = medicoMatch[0].id as string;
              break;
            }
          }
          if (medicoId) {
            const { data: payByMedico } = await supabase
              .from('pagamentos')
              .select('id, valor, status, created_at')
              .in('status', ['pendente','solicitado'])
              .eq('medico_id', medicoId)
              .order('created_at', { ascending: false })
              .limit(1);
            if (payByMedico && payByMedico.length > 0) {
              pagamento = payByMedico[0];
            }
          }
        }

        // Fallback final: associar pelo log de solicitação (message_logs)
        if (!pagamento) {
          try {
            const variants = brPhoneVariants(numeroLimpo);
            const { data: logs } = await supabase
              .from('message_logs')
              .select('pagamento_id, payload, created_at')
              .eq('tipo', 'solicitacao_nota')
              .order('created_at', { ascending: false })
              .limit(20);
            const found = (logs || []).find((l: any) => {
              const n = String(l?.payload?.number || '');
              return variants.some(v => n.includes(v));
            });
            const pagamentoId = found?.pagamento_id;
            if (pagamentoId) {
              const { data: pagamentoById } = await supabase
                .from('pagamentos')
                .select('id, valor, status, created_at')
                .eq('id', pagamentoId)
                .maybeSingle();
              if (pagamentoById) pagamento = pagamentoById;
            }
          } catch (assocErr) {
            console.warn('Falha no fallback por logs:', assocErr);
          }
        }

        if (pagamento) {
          
          // Fazer download do arquivo PDF usando o token do webhook
          try {
            const wabaToken = ticket?.whatsapp?.bmToken;
            console.log('Fazendo download do PDF com ID:', document.id, 'Token disponível:', !!wabaToken);
            
            // Primeiro, obter a URL real do arquivo usando o wabaMediaId
            const mediaId = wabaMediaId;
            const mediaInfoUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
            console.log('Buscando informações do arquivo:', mediaInfoUrl, 'Media ID:', mediaId);
            
            const mediaInfoResponse = await fetch(mediaInfoUrl, {
              headers: {
                'Authorization': `Bearer ${wabaToken}`,
              }
            });
            
            if (!mediaInfoResponse.ok) {
              throw new Error(`Erro ao buscar informações do arquivo: ${mediaInfoResponse.status}`);
            }
            
            const mediaInfo = await mediaInfoResponse.json();
            console.log('Informações do arquivo obtidas:', mediaInfo);
            
            // Agora fazer o download do arquivo usando a URL obtida
            const fileResponse = await fetch(mediaInfo.url, {
              headers: {
                'Authorization': `Bearer ${wabaToken}`,
              }
            });
            
            if (fileResponse.ok) {
              const fileData = await fileResponse.arrayBuffer();
              const baseName = filename.endsWith('.pdf') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.pdf`;
              const uniqueName = `${pagamento.id}_${mediaId}_${Date.now()}_${baseName}`;
              const filePath = `${pagamento.id}/${uniqueName}`;
              
              // Fazer upload para o Supabase Storage
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('notas')
                .upload(filePath, fileData, {
                  contentType: 'application/pdf',
                  cacheControl: '3600',
                });

              if (uploadError) {
                console.error('Erro no upload:', uploadError);
                throw uploadError;
              }

              console.log('Arquivo enviado para storage:', uploadData);

              // Tentar extrair valor líquido do PDF usando OCR ou regex
              let valorLiquido = null;
              try {
                // Simulação de extração de valor - implementar OCR real se necessário
                const textContent = await extractTextFromPDF(fileData);
                valorLiquido = extractLiquidValue(textContent);
              } catch (ocrError) {
                console.warn('Erro na extração de texto:', ocrError);
              }

              // Atualizar pagamento
              const updateData: any = {
                status: 'nota_recebida',
                data_resposta: new Date().toISOString(),
                nota_pdf_url: `notas/${filePath}`,
              };

              if (valorLiquido) {
                updateData.valor_liquido = valorLiquido;
              }

              const { error: updateError } = await supabase
                .from('pagamentos')
                .update(updateData)
                .eq('id', pagamento.id);

              if (updateError) {
                console.error('Erro ao atualizar pagamento:', updateError);
                throw updateError;
              }

              console.log('Pagamento atualizado com sucesso');

              // Enviar mensagem de confirmação para o médico
              try {
                const { data: config } = await supabase
                  .from('configuracoes')
                  .select('api_url, auth_token')
                  .single();

                if (config) {
                  const confirmationPayload = {
                    body: `✅ Nota fiscal recebida com sucesso!\n\nSeu documento foi processado e o pagamento está sendo preparado. Você será notificado assim que o pagamento estiver disponível.\n\nObrigado!`,
                    number: from,
                    externalKey: `nota_confirmacao_${pagamento.id}_${Date.now()}`,
                    isClosed: false
                  };

                  console.log('Enviando mensagem de confirmação:', confirmationPayload);

                  const confirmationResponse = await fetch(config.api_url, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${config.auth_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(confirmationPayload),
                  });

                  const confirmationResponseData = await confirmationResponse.json();
                  console.log('Resposta da mensagem de confirmação:', confirmationResponseData);

                  // Registrar log da mensagem de confirmação
                  await supabase
                    .from('message_logs')
                    .insert([{
                      pagamento_id: pagamento.id,
                      tipo: 'confirmacao_nota',
                      payload: confirmationPayload,
                      success: confirmationResponse.ok,
                      response: confirmationResponseData
                    }]);
                }
              } catch (msgError) {
                console.warn('Erro ao enviar mensagem de confirmação:', msgError);
              }

              // Enviar notificação por email (opcional)
              try {
                await supabase.functions.invoke('send-notification', {
                  body: {
                    type: 'nova_nota',
                    pagamentoId: pagamento.id,
                    filePath,
                    valorLiquido
                  }
                });
              } catch (emailError) {
                console.warn('Erro ao enviar notificação:', emailError);
              }

              return new Response(JSON.stringify({
                success: true,
                message: 'Nota processada com sucesso',
                pagamentoId: pagamento.id,
                valorLiquido
              }), {
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders 
                },
              });
            }
          } catch (downloadError) {
            console.error('Erro ao fazer download do PDF:', downloadError);
          }
        } else {
          console.log('Nenhum pagamento pendente encontrado para:', from);
        }
      }
    }

    // Resposta padrão para outros tipos de webhook
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook recebido',
      processed: false
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    
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

// Função auxiliar para normalizar e gerar variações de números BR (com/sem o 9)
function brPhoneVariants(num: string): string[] {
  const digits = (num || '').replace(/\D/g, '');
  const set = new Set<string>();
  if (!digits) return [];
  set.add(digits);
  // Inserir 9 após DDI+DDD (ex: 55 77 -> índice 4)
  if (digits.startsWith('55')) {
    if (digits.length === 12) { // provavelmente sem o 9
      set.add(digits.slice(0, 4) + '9' + digits.slice(4));
    }
    if (digits.length === 13 && digits[4] === '9') { // com 9, gerar sem 9
      set.add(digits.slice(0, 4) + digits.slice(5));
    }
  }
  return Array.from(set);
}

// Função auxiliar para extrair texto do PDF (simulação)
async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string> {
  // Implementação básica - em produção usar uma biblioteca de OCR
  const text = new TextDecoder().decode(pdfData);
  return text;
}

// Função auxiliar para extrair valor líquido
function extractLiquidValue(text: string): number | null {
  // Regex para encontrar valores monetários
  const regexes = [
    /valor\s*líquido[:\s]*r\$?\s*([\d.,]+)/i,
    /líquido[:\s]*r\$?\s*([\d.,]+)/i,
    /total\s*líquido[:\s]*r\$?\s*([\d.,]+)/i,
    /valor\s*final[:\s]*r\$?\s*([\d.,]+)/i,
  ];

  for (const regex of regexes) {
    const match = text.match(regex);
    if (match) {
      const valorStr = match[1].replace(/[^\d,]/g, '').replace(',', '.');
      const valor = parseFloat(valorStr);
      if (!isNaN(valor)) {
        return valor;
      }
    }
  }

  return null;
}