import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Using fetch instead of Resend package to avoid import issues

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: 'nova_nota' | 'pagamento_realizado';
  pagamentoId: string;
  fileName?: string;
  valorLiquido?: number;
  emailDestino?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, pagamentoId, fileName, valorLiquido, emailDestino }: EmailNotificationRequest = await req.json();

    console.log('Recebendo solicitação de email:', { type, pagamentoId });

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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

    if (type === 'nova_nota') {
      subject = '📋 Nova Nota Fiscal Recebida - HCC Hospital';
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #667eea; }
            .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 HCC Hospital</h1>
              <h2>Nova Nota Fiscal Recebida</h2>
            </div>
            <div class="content">
              <div class="info-card">
                <h3>📋 Detalhes da Nota</h3>
                <p><strong>Médico:</strong> ${(pagamento.medicos as any)?.nome}</p>
                <p><strong>Especialidade:</strong> ${(pagamento.medicos as any)?.especialidade || 'Não informado'}</p>
                <p><strong>Competência:</strong> ${pagamento.mes_competencia}</p>
                <p><strong>Valor Bruto:</strong> R$ ${pagamento.valor.toFixed(2)}</p>
                ${valorLiquido ? `<p><strong>Valor Líquido:</strong> R$ ${valorLiquido.toFixed(2)}</p>` : ''}
                <p><strong>Arquivo:</strong> ${fileName || 'nota.pdf'}</p>
              </div>
              
              <p>A nota fiscal foi recebida e está disponível no sistema para download e processamento de pagamento.</p>
              
              <a href="${Deno.env.get('SUPABASE_URL')}" class="button">
                🔗 Acessar Sistema
              </a>
            </div>
            <div class="footer">
              <p>Sistema de Gestão de Pagamentos - HCC Hospital</p>
              <p>Este é um email automático, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `;
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
                <p><strong>Competência:</strong> ${pagamento.mes_competencia}</p>
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

    console.log('Enviando email para:', destinatario);
    console.log('Assunto:', subject);

    // Send email using Resend API directly
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HCC Hospital <onboarding@resend.dev>',
        to: [destinatario],
        subject: subject,
        html: html,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log('Email enviado com sucesso:', emailResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificação enviada por email',
      type,
      emailId: emailResult.id
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