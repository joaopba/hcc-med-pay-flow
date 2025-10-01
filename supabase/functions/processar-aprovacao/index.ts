import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const notaId = url.searchParams.get('nota');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!notaId || !action || !token) {
      return new Response('Parâmetros inválidos', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar nota e validar token
    const { data: nota, error: notaError } = await supabase
      .from('notas_medicos')
      .select(`
        *,
        pagamentos!inner (
          id,
          valor,
          mes_competencia,
          medico_id,
          medicos!inner (
            nome,
            numero_whatsapp
          )
        )
      `)
      .eq('id', notaId)
      .single();

    if (notaError || !nota) {
      throw new Error('Nota não encontrada');
    }

    // Validar token
    const expectedToken = btoa(`${notaId}-${nota.created_at}`).substring(0, 20);
    if (token !== expectedToken) {
      return new Response('Token inválido', { status: 403 });
    }

    // Verificar se já foi processada
    if (nota.status !== 'pendente') {
      return new Response(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="google" content="notranslate">
          <title>Nota já processada</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container { 
              background: white;
              padding: 60px 40px;
              border-radius: 16px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            .icon { font-size: 72px; margin-bottom: 24px; }
            h1 { color: #ff9800; font-size: 28px; margin-bottom: 16px; font-weight: 600; }
            p { color: #666; font-size: 16px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⚠️</div>
            <h1>Nota já processada</h1>
            <p>Esta nota fiscal já foi ${nota.status === 'aprovado' ? 'aprovada' : 'rejeitada'} anteriormente.</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (action === 'aprovar') {
      // Aprovar nota
      await supabase
        .from('notas_medicos')
        .update({ status: 'aprovado' })
        .eq('id', notaId);

      // Atualizar pagamento
      await supabase
        .from('pagamentos')
        .update({ status: 'aprovado' })
        .eq('id', nota.pagamento_id);

      // Enviar notificação WhatsApp
      try {
        await supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota_aprovada',
            medico: {
              nome: nota.pagamentos.medicos.nome,
              numero_whatsapp: nota.pagamentos.medicos.numero_whatsapp
            },
            competencia: nota.pagamentos.mes_competencia,
            pagamentoId: nota.pagamento_id
          }
        });
      } catch (whatsappError) {
        console.warn('Erro ao enviar WhatsApp:', whatsappError);
      }

      return new Response(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="google" content="notranslate">
          <title>Nota Aprovada</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container { 
              background: white;
              padding: 60px 40px;
              border-radius: 16px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            .icon { 
              font-size: 72px;
              margin-bottom: 24px;
              animation: bounce 1s ease;
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            h1 { 
              color: #10b981;
              font-size: 28px;
              margin-bottom: 24px;
              font-weight: 600;
            }
            .info { 
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
            }
            .info p { 
              color: #333;
              font-size: 16px;
              margin: 10px 0;
              line-height: 1.6;
            }
            .info strong { color: #667eea; }
            .message {
              color: #666;
              font-size: 16px;
              margin-top: 20px;
            }
            .btn {
              display: inline-block;
              margin-top: 30px;
              padding: 14px 32px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              transition: all 0.3s;
            }
            .btn:hover {
              background: #5568d3;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Nota Fiscal Aprovada!</h1>
            <div class="info">
              <p><strong>Médico:</strong> ${nota.pagamentos.medicos.nome}</p>
              <p><strong>Competência:</strong> ${nota.pagamentos.mes_competencia}</p>
              <p><strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">Aprovado</span></p>
            </div>
            <p class="message">O pagamento será processado em breve e o médico foi notificado via WhatsApp.</p>
            <a href="https://hcc.chatconquista.com" class="btn">Voltar ao Sistema</a>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });

    } else if (action === 'rejeitar') {
      // Formulário de rejeição
      if (req.method === 'GET') {
        return new Response(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="google" content="notranslate">
            <title>Rejeitar Nota Fiscal</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container { 
                background: white;
                padding: 40px;
                border-radius: 16px;
                max-width: 600px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              }
              .icon { font-size: 72px; text-align: center; margin-bottom: 20px; }
              h1 { color: #ef4444; font-size: 28px; margin-bottom: 20px; text-align: center; font-weight: 600; }
              .info { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
              .info p { color: #333; font-size: 14px; margin: 8px 0; line-height: 1.6; }
              .info strong { color: #ff9800; }
              label { display: block; color: #333; font-weight: 600; margin-bottom: 8px; font-size: 15px; }
              textarea { 
                width: 100%;
                min-height: 120px;
                padding: 12px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
                transition: border-color 0.3s;
              }
              textarea:focus {
                outline: none;
                border-color: #667eea;
              }
              button { 
                background: #ef4444;
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 8px;
                cursor: pointer;
                width: 100%;
                font-size: 16px;
                font-weight: 600;
                margin-top: 20px;
                transition: all 0.3s;
              }
              button:hover { 
                background: #dc2626;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">❌</div>
              <h1>Rejeitar Nota Fiscal</h1>
              <div class="info">
                <p><strong>Médico:</strong> ${nota.pagamentos.medicos.nome}</p>
                <p><strong>Competência:</strong> ${nota.pagamentos.mes_competencia}</p>
                <p><strong>Arquivo:</strong> ${nota.nome_arquivo}</p>
              </div>
              <form method="POST" action="?nota=${notaId}&action=rejeitar&token=${token}">
                <label for="motivo">Motivo da rejeição:</label>
                <textarea name="motivo" id="motivo" required placeholder="Ex: Dados incorretos, documento ilegível, valores não conferem..."></textarea>
                <button type="submit">Confirmar Rejeição</button>
              </form>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } else if (req.method === 'POST') {
        const formData = await req.formData();
        const motivo = formData.get('motivo') as string;

        if (!motivo) {
          return new Response('Motivo é obrigatório', { status: 400 });
        }

        // Rejeitar nota
        await supabase
          .from('notas_medicos')
          .update({ 
            status: 'rejeitado',
            observacoes: motivo
          })
          .eq('id', notaId);

        // Atualizar pagamento
        await supabase
          .from('pagamentos')
          .update({ 
            status: 'nota_rejeitada',
            observacoes: motivo
          })
          .eq('id', nota.pagamento_id);

        // Enviar notificação WhatsApp
        try {
          await supabase.functions.invoke('send-whatsapp-template', {
            body: {
              type: 'nota_rejeitada',
              medico: {
                nome: nota.pagamentos.medicos.nome,
                numero_whatsapp: nota.pagamentos.medicos.numero_whatsapp
              },
              competencia: nota.pagamentos.mes_competencia,
              motivo: motivo,
              linkPortal: 'https://hcc.chatconquista.com/dashboard-medicos',
              pagamentoId: nota.pagamento_id
            }
          });
        } catch (whatsappError) {
          console.warn('Erro ao enviar WhatsApp:', whatsappError);
        }

        return new Response(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="google" content="notranslate">
            <title>Nota Rejeitada</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container { 
                background: white;
                padding: 60px 40px;
                border-radius: 16px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
              }
              .icon { font-size: 72px; margin-bottom: 24px; }
              h1 { color: #ef4444; font-size: 28px; margin-bottom: 24px; font-weight: 600; }
              .info { background: #fee; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; border-left: 4px solid #ef4444; }
              .info p { color: #333; font-size: 16px; margin: 10px 0; line-height: 1.6; }
              .info strong { color: #ef4444; }
              .message { color: #666; font-size: 16px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">❌</div>
              <h1>Nota Fiscal Rejeitada</h1>
              <div class="info">
                <p><strong>Médico:</strong> ${nota.pagamentos.medicos.nome}</p>
                <p><strong>Motivo:</strong> ${motivo}</p>
              </div>
              <p class="message">O médico foi notificado via WhatsApp e poderá enviar uma nova nota corrigida.</p>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }

    return new Response('Ação inválida', { status: 400 });

  } catch (error: any) {
    console.error('Erro ao processar aprovação:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
