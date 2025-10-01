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
    const action = url.searchParams.get('action'); // 'aprovar' ou 'rejeitar'
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

    // Validar token (simples hash baseado no ID)
    const expectedToken = btoa(`${notaId}-${nota.created_at}`).substring(0, 20);
    if (token !== expectedToken) {
      return new Response('Token inválido', { status: 403 });
    }

    // Verificar se já foi processada
    if (nota.status !== 'pendente') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nota já processada</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .warning { color: #ff9800; font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="warning">⚠️</div>
            <h2>Nota já processada</h2>
            <p>Esta nota fiscal já foi ${nota.status === 'aprovado' ? 'aprovada' : 'rejeitada'} anteriormente.</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
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
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nota Aprovada</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #4caf50; font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h2>Nota Fiscal Aprovada!</h2>
            <p><strong>Médico:</strong> ${nota.pagamentos.medicos.nome}</p>
            <p><strong>Competência:</strong> ${nota.pagamentos.mes_competencia}</p>
            <p>O pagamento será processado em breve.</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });

    } else if (action === 'rejeitar') {
      // Página de rejeição com formulário para motivo
      if (req.method === 'GET') {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Rejeitar Nota Fiscal</title>
            <style>
              body { font-family: Arial; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #f44336; font-size: 48px; text-align: center; }
              h2 { text-align: center; }
              textarea { width: 100%; min-height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: Arial; font-size: 14px; }
              button { background: #f44336; color: white; border: none; padding: 12px 30px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 16px; margin-top: 15px; }
              button:hover { background: #d32f2f; }
              .info { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">❌</div>
              <h2>Rejeitar Nota Fiscal</h2>
              <div class="info">
                <strong>Médico:</strong> ${nota.pagamentos.medicos.nome}<br>
                <strong>Competência:</strong> ${nota.pagamentos.mes_competencia}<br>
                <strong>Arquivo:</strong> ${nota.nome_arquivo}
              </div>
              <form method="POST" action="?nota=${notaId}&action=rejeitar&token=${token}">
                <label><strong>Motivo da rejeição:</strong></label>
                <textarea name="motivo" required placeholder="Ex: Dados incorretos, documento ilegível, valores não conferem..."></textarea>
                <button type="submit">Confirmar Rejeição</button>
              </form>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
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
          <html>
          <head>
            <meta charset="utf-8">
            <title>Nota Rejeitada</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #f44336; font-size: 48px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">❌</div>
              <h2>Nota Fiscal Rejeitada</h2>
              <p><strong>Médico:</strong> ${nota.pagamentos.medicos.nome}</p>
              <p><strong>Motivo:</strong> ${motivo}</p>
              <p>O médico foi notificado via WhatsApp.</p>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
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
