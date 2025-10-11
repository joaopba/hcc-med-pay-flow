import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurar cliente SMTP
const client = new SMTPClient({
  connection: {
    hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
    port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
    tls: true,
    auth: {
      username: Deno.env.get("SMTP_USER") || "suporte@chatconquista.com",
      password: Deno.env.get("SMTP_PASSWORD") || "",
    },
  },
});

interface EmailNotificationRequest {
  type: 'nova_nota' | 'pagamento_realizado';
  pagamentoId: string;
  notaId?: string;
  fileName?: string;
  valorLiquido?: number;
  emailDestino?: string;
  pdfPath?: string;
}

// Função para formatar mês de competência
function formatMesCompetencia(mesCompetencia: string): string {
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  return `${meses[mesIndex]} de ${ano}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, pagamentoId, notaId, fileName, valorLiquido, emailDestino, pdfPath }: EmailNotificationRequest = await req.json();

    console.log('Recebendo solicitação de email:', { type, pagamentoId, notaId, pdfPath });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do pagamento
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select(`
        id,
        valor,
        mes_competencia,
        valor_liquido,
        medicos!inner (
          nome,
          especialidade
        )
      `)
      .eq('id', pagamentoId)
      .single();

    if (!pagamento) {
      throw new Error('Pagamento não encontrado');
    }

    console.log('Pagamento encontrado:', pagamento);
    console.log('🗓️ DEBUG Competência - Original:', pagamento.mes_competencia);
    console.log('🗓️ DEBUG Competência - Formatada:', formatMesCompetencia(pagamento.mes_competencia));

    // Buscar configurações para verificar se emails estão habilitados
    const { data: config } = await supabase
      .from('configuracoes')
      .select('email_notificacoes')
      .single();

    if (!config?.email_notificacoes) {
      console.log('Notificações por email estão desabilitadas');
      return new Response(JSON.stringify({
        success: true,
        message: 'Notificações por email estão desabilitadas'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    let subject = '';
    let html = '';
    const destinatario = emailDestino || 'admin@hcchospital.com.br';

    // Se for notificação de nova nota, buscar TODOS os usuários do sistema
    let destinatarios = [destinatario];
    let usuariosWhatsApp: Array<{email: string, numero_whatsapp: string, name: string, role: string}> = [];
    
    if (type === 'nova_nota') {
      try {
        const { data: usuarios } = await supabase
          .from('profiles')
          .select('email, numero_whatsapp, name, role');
        
        if (usuarios && usuarios.length > 0) {
          destinatarios = usuarios.map(u => u.email).filter(Boolean);
          usuariosWhatsApp = usuarios.filter(u => u.numero_whatsapp);
          console.log(`Enviando email para ${destinatarios.length} usuários:`, destinatarios);
          console.log(`Enviando WhatsApp para ${usuariosWhatsApp.length} usuários com número cadastrado`);
        }
      } catch (userError) {
        console.warn('Erro ao buscar usuários, enviando só para admin:', userError);
      }
    }

    if (type === 'nova_nota') {
      // Buscar dados da nota para gerar token de aprovação
      const { data: nota } = await supabase
        .from('notas_medicos')
        .select('id, created_at')
        .eq('id', notaId)
        .single();

      // Gerar token simples e direto (encurtado)
      const token = btoa(`${notaId}-${nota?.created_at}`).substring(0, 12);
      console.log('Token gerado para nota:', notaId, 'token:', token);
      const approveUrl = `https://hcc.chatconquista.com/aprovar?i=${notaId}&t=${token}`;
      const rejectUrl = `https://hcc.chatconquista.com/rejeitar?i=${notaId}&t=${token}`;

      // Gerar URL pública do PDF (válida por 7 dias)
      let pdfDownloadUrl = '';
      if (pdfPath) {
        const { data: urlData } = await supabase.storage
          .from('notas')
          .createSignedUrl(pdfPath, 604800); // 7 dias
        pdfDownloadUrl = urlData?.signedUrl || '';
        console.log('URL pública do PDF gerada:', pdfDownloadUrl);
      }

      subject = `📋 Nova Nota - ${(pagamento.medicos as any)?.nome} - ${formatMesCompetencia(pagamento.mes_competencia)} - HCC Hospital`;
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nova Nota Fiscal</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:40px 20px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)"><tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600">🏥 HCC Hospital</h1><p style="margin:10px 0 0 0;color:#ffffff;font-size:18px;font-weight:400">Nova Nota Fiscal Recebida</p></td></tr><tr><td style="padding:40px 30px"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:30px"><tr><td><h2 style="margin:0 0 20px 0;color:#333;font-size:20px;font-weight:600;border-left:4px solid #667eea;padding-left:12px">📋 Detalhes da Nota</h2><table width="100%" cellpadding="8" cellspacing="0" border="0"><tr><td style="color:#666;font-size:14px"><strong style="color:#333">Médico:</strong></td><td style="color:#333;font-size:14px;text-align:right">${(pagamento.medicos as any)?.nome}</td></tr><tr><td style="color:#666;font-size:14px"><strong style="color:#333">Especialidade:</strong></td><td style="color:#333;font-size:14px;text-align:right">${(pagamento.medicos as any)?.especialidade || 'Não informado'}</td></tr><tr><td style="color:#666;font-size:14px"><strong style="color:#333">Competência:</strong></td><td style="color:#333;font-size:14px;text-align:right">${formatMesCompetencia(pagamento.mes_competencia)}</td></tr><tr><td style="color:#666;font-size:14px"><strong style="color:#333">Valor:</strong></td><td style="color:#10b981;font-size:16px;font-weight:600;text-align:right">R$ ${pagamento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr><tr><td style="color:#666;font-size:14px"><strong style="color:#333">Arquivo:</strong></td><td style="color:#333;font-size:14px;text-align:right">${fileName || 'nota.pdf'}</td></tr></table></td></tr></table><p style="text-align:center;color:#333;font-size:16px;margin:0 0 30px 0;line-height:1.5">A nota fiscal foi recebida e está aguardando sua análise. <br>Clique nos botões abaixo para aprovar ou rejeitar:</p><table width="100%" cellpadding="0" cellspacing="0" border="0">${pdfDownloadUrl ? `<tr><td align="center" style="padding:10px"><a href="${pdfDownloadUrl}" style="display:inline-block;background-color:#667eea;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(102,126,234,0.3)">📎 Baixar PDF da Nota</a></td></tr>` : ''}<tr><td align="center" style="padding:10px"><a href="${approveUrl}" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(16,185,129,0.3)">✅ Aprovar Nota</a></td></tr><tr><td align="center" style="padding:10px"><a href="${rejectUrl}" style="display:inline-block;background-color:#ef4444;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(239,68,68,0.3)">❌ Rejeitar Nota</a></td></tr><tr><td align="center" style="padding:20px 10px 10px 10px"><a href="https://hcc.chatconquista.com" style="display:inline-block;background-color:#667eea;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px">🔗 Acessar Sistema Completo</a></td></tr></table>${pdfDownloadUrl ? '<p style="text-align:center;color:#666;font-size:12px;margin:20px 0 0 0">💡 O PDF também está anexado neste email. Link válido por 7 dias.</p>' : ''}</td></tr><tr><td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb"><p style="margin:0;color:#666;font-size:12px;line-height:1.5">Sistema de Gestão de Pagamentos - HCC Hospital<br>Este é um email automático, não responda.</p></td></tr></table></td></tr></table></body></html>`;
    } else if (type === 'pagamento_realizado') {
      subject = '💰 Pagamento Realizado - HCC Hospital';
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f0fdf4; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #10b981; }
            .success-badge { background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 HCC Hospital</h1>
              <h2>✅ Pagamento Realizado</h2>
            </div>
            <div class="content">
              <div class="info-card">
                <h3>💰 Detalhes do Pagamento</h3>
                <p><strong>Médico:</strong> ${(pagamento.medicos as any)?.nome}</p>
                <p><strong>Especialidade:</strong> ${(pagamento.medicos as any)?.especialidade || 'Não informado'}</p>
                <p><strong>Competência:</strong> ${formatMesCompetencia(pagamento.mes_competencia)}</p>
                <p><strong>Valor Pago:</strong> R$ ${(pagamento.valor_liquido || pagamento.valor).toFixed(2)}</p>
                <p><span class="success-badge">✅ Pago</span></p>
              </div>
              
              <p>O pagamento foi processado com sucesso e a notificação foi enviada ao médico via WhatsApp.</p>
            </div>
            <div class="footer">
              <p>Sistema de Gestão de Pagamentos - HCC Hospital</p>
              <p>Este é um email automático, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    console.log('Enviando email para:', destinatarios);
    console.log('Assunto:', subject);

    // Preparar anexo se houver PDF
    const attachments: any[] = [];
    let pdfBase64: string | null = null;
    if (pdfPath && type === 'nova_nota') {
      try {
        console.log('Baixando PDF para anexar:', pdfPath);
        const { data: pdfData } = await supabase.storage
          .from('notas')
          .download(pdfPath);
        
        if (pdfData) {
          const arrayBuffer = await pdfData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          attachments.push({
            filename: fileName || 'nota.pdf',
            content: uint8Array,
            contentType: 'application/pdf',
          });

          // Gerar base64 para envio via WhatsApp (endpoint de arquivo)
          try {
            pdfBase64 = encodeBase64(arrayBuffer);
          } catch (e) {
            console.warn('Falha ao converter PDF para base64:', e);
          }
          
          console.log('PDF anexado com sucesso');
        }
      } catch (pdfError) {
        console.warn('Erro ao anexar PDF:', pdfError);
      }
    }

    // Enviar email para todos os destinatários
    const resultadosEnvio: Array<{email: string, sucesso: boolean, erro?: string}> = [];
    
    for (const dest of destinatarios) {
      try {
        console.log(`📧 Tentando enviar email para: ${dest}`);
        await client.send({
          from: "HCC Hospital <suporte@chatconquista.com>",
          to: dest,
          subject: subject,
          content: "Versão texto do email",
          html: html,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        console.log(`✅ Email enviado para ${dest} com sucesso`, attachments.length > 0 ? 'com anexo' : '');
        resultadosEnvio.push({ email: dest, sucesso: true });
      } catch (emailError) {
        console.error(`❌ Erro ao enviar para ${dest}:`, emailError);
        resultadosEnvio.push({ email: dest, sucesso: false, erro: String(emailError) });
      }
    }
    
    console.log('📊 Resumo de envios:', resultadosEnvio);

    // Enviar WhatsApp para usuários
    if (type === 'nova_nota' && usuariosWhatsApp.length > 0 && pdfPath) {
      try {
        // Gerar URLs de aprovação/rejeição
        const { data: nota } = await supabase
          .from('notas_medicos')
          .select('id, created_at')
          .eq('id', notaId)
          .single();

        const token = btoa(`${notaId}-${nota?.created_at}`).substring(0, 12);
        console.log('Token gerado para WhatsApp:', notaId, 'token:', token);
        const approveUrl = `https://hcc.chatconquista.com/aprovar?i=${notaId}&t=${token}`;
        const rejectUrl = `https://hcc.chatconquista.com/rejeitar?i=${notaId}&t=${token}`;

        // Separar gestores de outros usuários
        const gestores = usuariosWhatsApp.filter(u => u.role === 'gestor');
        const outrosUsuarios = usuariosWhatsApp.filter(u => u.role !== 'gestor');

        // Enviar para gestores usando nova API
        if (gestores.length > 0 && pdfBase64) {
          console.log(`📧 Enviando para ${gestores.length} gestor(es) via nova API`);
          
          // Gerar URL pública do PDF para incluir na mensagem
          let pdfDownloadUrl = '';
          if (pdfPath) {
            const { data: urlData } = await supabase.storage
              .from('notas')
              .createSignedUrl(pdfPath, 604800); // 7 dias
            pdfDownloadUrl = urlData?.signedUrl || '';
          }
          
          for (const gestor of gestores) {
            try {
              // Gerar URL pública do PDF para incluir na mensagem
              const shortPdfUrl = pdfDownloadUrl || '';
              
              console.log('Links - Aprovar:', approveUrl, 'Rejeitar:', rejectUrl, 'PDF:', shortPdfUrl);
              console.log('🗓️ DEBUG Competência na mensagem:', pagamento.mes_competencia, '->', formatMesCompetencia(pagamento.mes_competencia));
              
              const caption = `📋 Nova Nota - Análise\n\nMédico: ${(pagamento.medicos as any)?.nome}\nCompetência: ${formatMesCompetencia(pagamento.mes_competencia)}\nValor: R$ ${pagamento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n📄 PDF: ${shortPdfUrl}\n\n✅ Aprovar: ${approveUrl}\n❌ Rejeitar: ${rejectUrl}`;

              // Chamar função send-notification-gestores via HTTP direto
              const gestorResponse = await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-gestores`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                  },
                  body: JSON.stringify({
                    phoneNumber: gestor.numero_whatsapp,
                    message: caption,
                    pdf_base64: pdfBase64,
                    pdf_filename: fileName || 'nota.pdf'
                  })
                }
              );

              const gestorResult = await gestorResponse.json();
              console.log(`✅ WhatsApp enviado para gestor ${gestor.name}:`, gestorResult);
            } catch (gestorError) {
              console.error(`❌ Erro ao enviar WhatsApp para gestor ${gestor.name}:`, gestorError);
            }
          }
        }

        // Enviar para outros usuários usando API antiga
        if (outrosUsuarios.length > 0) {
          const { data: configWpp } = await supabase
            .from('configuracoes')
            .select('api_url, auth_token')
            .single();

          if (configWpp?.api_url && configWpp?.auth_token) {
            // Gerar URL pública temporária do PDF (válida por 7 dias)
            const { data: urlData } = await supabase.storage
              .from('notas')
              .createSignedUrl(pdfPath, 604800);

            const pdfPublicUrl = urlData?.signedUrl;

            // Enviar para cada usuário não-gestor
            for (const usuario of outrosUsuarios) {
              try {
                const caption = `📋 Nova Nota Fiscal para Análise\n\nMédico: ${(pagamento.medicos as any)?.nome}\nCompetência: ${formatMesCompetencia(pagamento.mes_competencia)}\nValor: R$ ${pagamento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n✅ Aprovar: ${approveUrl}\n❌ Rejeitar: ${rejectUrl}`;

                if (pdfBase64) {
                  const payloadFile = {
                    number: usuario.numero_whatsapp,
                    caption,
                    file: {
                      data: pdfBase64,
                      fileName: fileName || 'nota.pdf',
                      filename: fileName || 'nota.pdf',
                    },
                    mediaData: {
                      mediaBase64: pdfBase64,
                      caption,
                      fileName: fileName || 'nota.pdf',
                    },
                    externalKey: `nova_nota_usuarios_${notaId}_${usuario.email}_${Date.now()}`,
                  };

                  console.log(`Enviando WhatsApp (arquivo) para ${usuario.name} (${usuario.numero_whatsapp})`);
                  const responseWppFile = await fetch(`${configWpp.api_url}/file`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${configWpp.auth_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payloadFile),
                  });

                  const dataFile = await responseWppFile.json().catch(() => ({}));
                  console.log(`Resposta API WhatsApp (file) para ${usuario.name}:`, dataFile);

                  if (!responseWppFile.ok) {
                    // Fallback: enviar texto com link público
                    const payloadWpp = {
                      number: usuario.numero_whatsapp,
                      body: `${caption}\n\n📎 Baixar PDF: ${pdfPublicUrl ?? ''}`,
                      externalKey: `nova_nota_usuarios_${notaId}_${usuario.email}_${Date.now()}_fallback`,
                      isClosed: false,
                    };

                    const responseWpp = await fetch(configWpp.api_url, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${configWpp.auth_token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(payloadWpp),
                    });

                    const responseDataWpp = await responseWpp.json().catch(() => ({}));
                    console.log(`Resposta API WhatsApp (fallback) para ${usuario.name}:`, responseDataWpp);
                  }
                }
              } catch (wppError) {
                console.error(`Erro ao enviar WhatsApp para ${usuario.name}:`, wppError);
              }
            }
          }
        }
      } catch (wppError) {
        console.error('Erro ao processar envio de WhatsApp:', wppError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificação enviada por email via SMTP',
      type,
      smtpDelivered: true,
      whatsappSent: usuariosWhatsApp.length > 0 && type === 'nova_nota'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro ao enviar email:', error);
    
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