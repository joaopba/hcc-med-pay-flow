import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { processarOCRNota, enviarMensagemRejeicaoValor, enviarMensagemApenasPortal } from "./ocr-helper.ts";

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
          .select('api_url, auth_token, ocr_nfse_habilitado, ocr_nfse_api_key, permitir_nota_via_whatsapp')
          .single();

        if (configError || !config) {
          throw new Error('Configurações não encontradas');
        }

        // Enviar mensagem de solicitação com vídeo anexado
        const videoResponse = await fetch('https://hcc.chatconquista.com/videos/tutorial-anexar-nota.mp4');
        const videoBlob = await videoResponse.blob();
        
        const form = new FormData();
        form.append('number', from);
        form.append('body', "🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá! Para agilizar seu pagamento, precisamos da sua nota fiscal.\n\n🔗 Acesse o portal: https://hcc.chatconquista.com/dashboard-medicos\n\nPasso a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em \"Anexar Nota Fiscal\"\n4) Faça upload do PDF (máx. 10MB)\n\nDicas:\n• Envie o documento legível e completo\n• Confira os dados antes de enviar\n\n📹 Veja o vídeo tutorial que enviamos mostrando como anexar sua nota passo a passo!\n\nApós o envio, você receberá confirmação e será avisado sobre a análise.");
        form.append('externalKey', `nota_request_button_${Date.now()}`);
        form.append('isClosed', 'false');
        form.append('media', videoBlob, 'tutorial-anexar-nota.mp4');

        console.log('Enviando mensagem de solicitação com vídeo via botão');

        const messageResponse = await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.auth_token}`
          },
          body: form
        });

        const messageResponseData = await messageResponse.json();
        console.log('Resposta da mensagem com vídeo via botão:', messageResponseData);

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
                payload: { number: from, hasVideo: true },
                success: messageResponse.ok,
                response: messageResponseData
              }]);

            // Atualizar status do pagamento para garantir visibilidade no portal do médico
            await supabase
              .from('pagamentos')
              .update({ status: 'solicitado', data_solicitacao: new Date().toISOString() })
              .eq('id', pagamentoId);
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

    // Verificar se é uma mensagem com texto "Encaminhar Nota"
    if (webhookData.msg && webhookData.msg.text && 
        webhookData.msg.text.body && 
        webhookData.msg.text.body.toLowerCase().includes('encaminhar nota')) {
      
      const from = webhookData.ticket?.contact?.number || webhookData.msg.from;
      console.log('Mensagem "Encaminhar Nota" recebida de:', from);
      
      try {
        // Buscar médico por número de WhatsApp usando variações
        const numeroLimpo = from.replace(/\D/g, '');
        console.log('Número limpo para busca:', numeroLimpo);
        
        // Gerar todas as variações possíveis do número
        const variants = brPhoneVariants(numeroLimpo);
        console.log('Variações do número geradas:', variants);
        
        const { data: medicos, error: medicoError } = await supabase
          .from('medicos')
          .select('id, nome, numero_whatsapp')
          .in('numero_whatsapp', variants)
          .limit(1);

        if (medicoError || !medicos || medicos.length === 0) {
          console.log('Médico não encontrado para número:', numeroLimpo, 'Variações testadas:', variants);
          return new Response(JSON.stringify({
            success: false,
            message: 'Médico não encontrado'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            },
          });
        }

        const medico = medicos[0];
        
        // Buscar pagamento pendente do médico
        const { data: pagamentos, error: pagamentoError } = await supabase
          .from('pagamentos')
          .select('id, valor, mes_competencia')
          .eq('medico_id', medico.id)
          .in('status', ['pendente', 'solicitado'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (pagamentoError || !pagamentos || pagamentos.length === 0) {
          console.log('Nenhum pagamento pendente encontrado para médico:', medico.id);
          return new Response(JSON.stringify({
            success: false,
            message: 'Nenhum pagamento pendente'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            },
          });
        }

        const pagamento = pagamentos[0];
        console.log('Pagamento encontrado:', pagamento);

        // Buscar configurações da API
        const { data: config, error: configError } = await supabase
          .from('configuracoes')
          .select('api_url, auth_token, ocr_nfse_habilitado, ocr_nfse_api_key, permitir_nota_via_whatsapp')
          .single();

        if (configError || !config) {
          throw new Error('Configurações não encontradas');
        }

        // Enviar mensagem com vídeo anexado
        const videoResponse = await fetch('https://hcc.chatconquista.com/videos/tutorial-anexar-nota.mp4');
        const videoBlob = await videoResponse.blob();
        
        const competenciaFormatada = formatMesCompetencia(pagamento.mes_competencia);
        
        const form = new FormData();
        form.append('number', from);
        form.append('body', `🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá ${medico.nome}! Para darmos sequência ao seu pagamento referente a ${competenciaFormatada}, precisamos da sua nota fiscal.\n\n🔗 Acesse o portal oficial:\nhttps://hcc.chatconquista.com/dashboard-medicos\n\n📝 Passo a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em \"Anexar Nota Fiscal\"\n4) Envie o arquivo PDF (legível, até 10MB)\n\n⚡ Dicas importantes:\n• Envie o documento completo e sem senha\n• Revise os dados antes de enviar\n\n📹 Veja o vídeo tutorial que enviamos mostrando como anexar sua nota passo a passo!\n\n✅ Após o envio: você receberá confirmação e será avisado sobre a análise.`);
        form.append('externalKey', `encaminhar_nota_${Date.now()}`);
        form.append('isClosed', 'false');
        form.append('media', videoBlob, 'tutorial-anexar-nota.mp4');

        console.log('Enviando mensagem com vídeo anexado');

        const linkResponse = await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.auth_token}`
          },
          body: form
        });

        const linkResponseData = await linkResponse.json();
        console.log('Resposta da mensagem com vídeo:', linkResponseData);

        // Registrar log da mensagem
        try {
          await supabase
            .from('message_logs')
            .insert([{
              pagamento_id: pagamento.id,
              tipo: 'encaminhar_nota_link',
              payload: { number: from, hasVideo: true },
              success: linkResponse.ok,
              response: linkResponseData
            }]);
        } catch (logError) {
          console.warn('Erro ao registrar log:', logError);
        }

        // Atualizar status do pagamento para garantir visibilidade no portal do médico
        try {
          await supabase
            .from('pagamentos')
            .update({ status: 'solicitado', data_solicitacao: new Date().toISOString() })
            .eq('id', pagamento.id);
        } catch (updateErr) {
          console.warn('Falha ao atualizar status do pagamento:', updateErr);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Link de encaminhamento enviado'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });

      } catch (error) {
        console.error('Erro ao enviar link de encaminhamento:', error);
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

      // Determinar o nome do arquivo e sanitizar
      let filename = 'documento.pdf';
      if (document?.filename) {
        filename = sanitizeFilename(document.filename);
      } else if (msg.body) {
        // Se não tem document.filename, usar o body da mensagem que pode conter o nome
        filename = sanitizeFilename(msg.body);
      }
      
      console.log('Nome do arquivo sanitizado:', filename);

      if ((document && document.mime_type === 'application/pdf') || 
          (msg.mediaType === 'document' && wabaMediaId)) {
        console.log('PDF recebido de:', from, 'Arquivo:', filename);

        // Buscar pagamento pendente para este número
        const numeroLimpo = from.replace(/\D/g, '');
        console.log('📞 Número limpo extraído:', numeroLimpo);
        
        // Gerar variações do número (com e sem o 9)
        const variants = brPhoneVariants(numeroLimpo);
        console.log('🔄 Variações geradas:', variants);
        
        // Buscar médico usando as variações
        const { data: medico } = await supabase
          .from('medicos')
          .select('id, nome, numero_whatsapp')
          .in('numero_whatsapp', variants)
          .limit(1);
        
        console.log('Médico encontrado:', medico);
        
        let pagamento: any = null;
        
        // Se encontrou o médico, buscar pagamento pendente
        if (medico && medico.length > 0) {
          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('id, valor, status, created_at, medico_id, mes_competencia')
            .in('status', ['pendente','solicitado'])
            .eq('medico_id', medico[0].id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (pagamentos && pagamentos.length > 0) {
            pagamento = pagamentos[0];
            console.log('✅ Pagamento encontrado:', pagamento.id);
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
                .select('id, valor, status, created_at, medico_id, mes_competencia')
                .eq('id', pagamentoId)
                .maybeSingle();
              if (pagamentoById) pagamento = pagamentoById;
            }
          } catch (assocErr) {
            console.warn('Falha no fallback por logs:', assocErr);
          }
        }

        if (pagamento) {
          // Buscar configurações
          const { data: config } = await supabase
            .from('configuracoes')
            .select('ocr_nfse_habilitado, ocr_nfse_api_key, permitir_nota_via_whatsapp, api_url, auth_token')
            .single();

          // Verificar se permite upload via WhatsApp
          if (config && !config.permitir_nota_via_whatsapp) {
            console.log('❌ Upload via WhatsApp desativado');
            const { data: medicoData } = await supabase
              .from('medicos')
              .select('nome')
              .eq('id', pagamento.medico_id)
              .single();
            
            await enviarMensagemApenasPortal(supabase, from, medicoData?.nome || 'Médico');
            
            return new Response(JSON.stringify({ success: true, message: 'Upload apenas por portal' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Fazer download do arquivo PDF usando o token do webhook
          try {
            const wabaToken = ticket?.whatsapp?.bmToken;
            console.log('Fazendo download do PDF - Media ID:', wabaMediaId, 'Token disponível:', !!wabaToken);
            
            // Primeiro, obter a URL real do arquivo usando o wabaMediaId
            const mediaInfoUrl = `https://graph.facebook.com/v20.0/${wabaMediaId}`;
            console.log('Buscando informações do arquivo:', mediaInfoUrl);
            
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
              
              // Verificar tamanho do arquivo (máx 10MB)
              const maxSize = 10 * 1024 * 1024; // 10MB em bytes
              if (fileData.byteLength > maxSize) {
                throw new Error(`Arquivo muito grande: ${(fileData.byteLength / 1024 / 1024).toFixed(2)}MB. Máximo permitido: 10MB`);
              }
              
              // Nome do arquivo já está sanitizado
              const uniqueName = `${pagamento.id}_${wabaMediaId}_${Date.now()}_${filename}`;
              const filePath = `${pagamento.id}/${uniqueName}`;
              
              console.log('Preparando upload:', { 
                filePath, 
                size: `${(fileData.byteLength / 1024).toFixed(2)}KB`,
                pagamentoId: pagamento.id 
              });
              
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

              // Processar OCR se habilitado
              let numeroNota = null;
              let valorBruto = null;
              let valorLiquido = null;
              let ocrProcessado = false;
              
              if (config?.ocr_nfse_habilitado && config?.ocr_nfse_api_key) {
                console.log('🔍 OCR habilitado, processando nota...');
                const ocrResult = await processarOCRNota(fileData, config.ocr_nfse_api_key, supabase);
                
                if (ocrResult.success) {
                  numeroNota = ocrResult.numeroNota;
                  valorBruto = ocrResult.valorBruto;
                  valorLiquido = ocrResult.valorLiquido;
                  ocrProcessado = true;
                  
                  // Validar valor bruto
                  const valorEsperado = parseFloat(pagamento.valor);
                  const diferenca = Math.abs(valorEsperado - (valorBruto || 0));
                  
                  if (diferenca > 0.01) {
                    console.log('❌ Valor bruto incorreto, rejeitando nota');
                    const { data: medicoData } = await supabase
                      .from('medicos')
                      .select('nome')
                      .eq('id', pagamento.medico_id)
                      .single();
                    
                    await enviarMensagemRejeicaoValor(
                      supabase, from, medicoData?.nome || 'Médico',
                      valorEsperado, valorBruto || 0, 
                      formatMesCompetencia(pagamento.mes_competencia)
                    );
                    
                    return new Response(JSON.stringify({ 
                      success: false, 
                      message: 'Nota rejeitada - valor incorreto' 
                    }), {
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                  }
                }
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

              // Inserir nota na tabela notas_medicos
              const { data: insertData, error: insertError } = await supabase
                .from('notas_medicos')
                .insert([{
                  medico_id: pagamento.medico_id,
                  pagamento_id: pagamento.id,
                  arquivo_url: filePath,
                  nome_arquivo: filename,
                  status: 'pendente',
                  numero_nota: numeroNota,
                  valor_bruto: valorBruto,
                  ocr_processado: ocrProcessado,
                  ocr_resultado: ocrProcessado ? { numeroNota, valorBruto, valorLiquido } : null
                }])
                .select('*, pagamentos!inner(mes_competencia)')
                .single();

              if (insertError) {
                console.error('Erro ao inserir nota:', insertError);
                throw insertError;
              }

              console.log('Nota inserida com sucesso:', insertData);

              // Buscar dados do médico para enviar notificação
              const { data: medicoData } = await supabase
                .from('medicos')
                .select('nome, numero_whatsapp')
                .eq('id', pagamento.medico_id)
                .single();

              // Enviar notificação via WhatsApp Template
              if (medicoData) {
                try {
                  await supabase.functions.invoke('send-whatsapp-template', {
                    body: {
                      type: 'nota_recebida',
                      medico: {
                        nome: medicoData.nome,
                        numero_whatsapp: medicoData.numero_whatsapp
                      },
                      competencia: insertData.pagamentos.mes_competencia,
                      pagamentoId: pagamento.id
                    }
                  });
                  console.log('Notificação de nota recebida enviada via WhatsApp');
                } catch (whatsappError) {
                  console.warn('Erro ao enviar notificação via WhatsApp:', whatsappError);
                }
              }

              // Enviar PDF com botões de aprovação/rejeição para o financeiro
              try {
                // Buscar configurações do financeiro
                const { data: configFinanceiro } = await supabase
                  .from('profiles')
                  .select('numero_whatsapp')
                  .eq('role', 'gestor')
                  .not('numero_whatsapp', 'is', null)
                  .limit(1)
                  .single();

                if (configFinanceiro?.numero_whatsapp && medicoData) {
                  console.log('Preparando envio de PDF ao financeiro...');
                  
                  // Baixar o PDF do storage
                  const { data: pdfData, error: downloadError } = await supabase.storage
                    .from('notas')
                    .download(filePath);

                  if (downloadError) {
                    console.error('Erro ao baixar PDF:', downloadError);
                    throw downloadError;
                  }

                  console.log('PDF baixado, tamanho:', pdfData.size);

                  // Converter para base64
                  const arrayBuffer = await pdfData.arrayBuffer();
                  const base64 = btoa(
                    new Uint8Array(arrayBuffer)
                      .reduce((data, byte) => data + String.fromCharCode(byte), '')
                  );

                  console.log('PDF convertido para base64, tamanho:', base64.length);

                  // Criar tokens no formato correto (mesmo formato das páginas de aprovação/rejeição)
                  const tokenAprovar = btoa(`${insertData.id}-${insertData.created_at}`).substring(0, 20);
                  const tokenRejeitar = btoa(`${insertData.id}-${insertData.created_at}`).substring(0, 20);
                  const linkAprovar = `https://hcc.chatconquista.com/aprovar?nota=${insertData.id}&token=${tokenAprovar}`;
                  const linkRejeitar = `https://hcc.chatconquista.com/rejeitar?nota=${insertData.id}&token=${tokenRejeitar}`;

                  console.log('Links gerados:', { linkAprovar, linkRejeitar });

                  await supabase.functions.invoke('send-whatsapp-template', {
                    body: {
                      type: 'nota_aprovacao',
                      nome: medicoData.nome,
                      valor: pagamento.valor.toString(),
                      competencia: insertData.pagamentos.mes_competencia,
                      nota_id: insertData.id,
                      pdf_base64: base64,
                      pdf_filename: filename,
                      link_aprovar: linkAprovar,
                      link_rejeitar: linkRejeitar,
                      financeiro_numero: configFinanceiro.numero_whatsapp,
                      pagamentoId: pagamento.id,
                      valorBruto: pagamento.valor,
                      valorLiquido: pagamento.valor_liquido
                    }
                  });
                  console.log('Notificação de aprovação enviada ao financeiro com PDF');
                }
              } catch (financeiroError) {
                console.warn('Erro ao enviar notificação ao financeiro:', financeiroError);
              }

              console.log('Pagamento atualizado com sucesso');

              // Enviar notificação por email com PDF anexado e botões de ação
              try {
                await supabase.functions.invoke('send-email-notification', {
                  body: {
                    type: 'nova_nota',
                    pagamentoId: pagamento.id,
                    notaId: insertData.id,
                    fileName: filename,
                    valorLiquido: valorLiquido,
                    pdfPath: filePath
                  }
                });
                console.log('Email de notificação enviado com PDF anexado e botões de ação');
              } catch (emailError) {
                console.warn('Erro ao enviar notificação por email:', emailError);
              }

              return new Response(JSON.stringify({
                success: true,
                message: 'Nota fiscal processada com sucesso',
                pagamentoId: pagamento.id
              }), {
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders 
                },
              });

            } else {
              console.error('Erro no download do arquivo:', fileResponse.status);
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

// Função para sanitizar nome de arquivo
function sanitizeFilename(filename: string): string {
  // Remove caracteres especiais, espaços e acentos
  let sanitized = filename
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais por _
    .replace(/\.pdf(\.pdf)+$/gi, '.pdf') // Remove múltiplos .pdf
    .replace(/_{2,}/g, '_') // Substitui múltiplos _ por um único
    .toLowerCase();
  
  // Garante que termina com .pdf
  if (!sanitized.endsWith('.pdf')) {
    sanitized = sanitized.replace(/\.[^.]*$/, '') + '.pdf';
  }
  
  // Limita o tamanho do nome
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    const extension = '.pdf';
    sanitized = sanitized.substring(0, maxLength - extension.length) + extension;
  }
  
  return sanitized;
}

// Funções auxiliares para extração de texto (placeholder)
async function extractTextFromPDF(fileData: ArrayBuffer): Promise<string> {
  // Implementar extração de texto real usando uma biblioteca como pdf-parse
  return '';
}

function extractLiquidValue(text: string): number | null {
  // Implementar regex para extrair valor líquido do texto
  const matches = text.match(/valor\s*l[ií]quido[\s:]*r?\$?\s*(\d+[.,]?\d*)/i);
  return matches ? parseFloat(matches[1].replace(',', '.')) : null;
}