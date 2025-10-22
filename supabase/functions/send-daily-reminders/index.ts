import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Medico {
  id: string;
  nome: string;
  documento: string;
}

interface Pagamento {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  medico_id: string;
  medicos: Medico;
}

interface NotaPendente {
  id: string;
  pagamento_id: string;
  created_at: string;
  pagamentos: {
    mes_competencia: string;
    valor: number;
    medicos: Medico;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando envio de lembretes diários');

    const { data: gestores, error: gestoresError } = await supabase
      .from('profiles')
      .select('id, name, numero_whatsapp')
      .eq('role', 'gestor')
      .not('numero_whatsapp', 'is', null);

    if (gestoresError) {
      console.error('Erro ao buscar gestores:', gestoresError);
      throw gestoresError;
    }

    if (!gestores || gestores.length === 0) {
      console.log('Nenhum gestor com WhatsApp configurado');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum gestor para enviar lembretes' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Encontrados ${gestores.length} gestor(es)`);

    const { data: notasPendentes, error: notasError } = await supabase
      .from('notas_medicos')
      .select(`
        id,
        pagamento_id,
        created_at,
        pagamentos(
          mes_competencia,
          valor,
          medicos(
            id,
            nome,
            documento
          )
        )
      `)
      .eq('status', 'pendente');

    if (notasError) {
      console.error('Erro ao buscar notas pendentes:', notasError);
    }

    const { data: pagamentosAprovados, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`
        id,
        mes_competencia,
        valor,
        status,
        medico_id,
        medicos(
          id,
          nome,
          documento
        )
      `)
      .in('status', ['aprovado', 'nota_aprovada']);

    if (pagamentosError) {
      console.error('Erro ao buscar pagamentos aprovados:', pagamentosError);
    }

    console.log(`Notas pendentes: ${notasPendentes?.length || 0}`);
    console.log(`Pagamentos aprovados não pagos: ${pagamentosAprovados?.length || 0}`);

    for (const gestor of gestores) {
      try {
        if (notasPendentes && notasPendentes.length > 0) {
          const htmlContent = gerarHTMLNotasPendentes(notasPendentes);
          
          const mensagemNotas = `🏥 *HCC Hospital - Lembretes Diários*\n\n` +
            `📋 *NOTAS PENDENTES DE APROVAÇÃO*\n\n` +
            `Olá ${gestor.name}!\n\n` +
            `Você possui *${notasPendentes.length} nota(s)* aguardando aprovação ou rejeição.\n\n` +
            `Detalhes:\n${gerarTextoNotas(notasPendentes)}\n\n` +
            `🔗 Acesse o portal para análise:\n` +
            `https://hcc.chatconquista.com\n\n` +
            `⚡ Ação necessária para liberar os pagamentos.`;

          await enviarMensagemWhatsApp(
            supabase,
            gestor.numero_whatsapp,
            mensagemNotas
          );

          console.log(`Lembrete de notas pendentes enviado para ${gestor.name}`);
        }

        if (pagamentosAprovados && pagamentosAprovados.length > 0) {
          const htmlContent = gerarHTMLPagamentosAprovados(pagamentosAprovados);
          const totalValor = pagamentosAprovados.reduce((sum, p) => sum + p.valor, 0);
          
          const mensagemPagamentos = `🏥 *HCC Hospital - Lembretes Diários*\n\n` +
            `💰 *PAGAMENTOS APROVADOS PENDENTES*\n\n` +
            `Olá ${gestor.name}!\n\n` +
            `Você possui *${pagamentosAprovados.length} pagamento(s)* aprovado(s) aguardando efetivação.\n\n` +
            `Detalhes:\n${gerarTextoPagamentos(pagamentosAprovados)}\n\n` +
            `💵 *TOTAL: R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
            `🔗 Acesse o portal para processamento:\n` +
            `https://hcc.chatconquista.com/pagamentos\n\n` +
            `✅ Finalize os pagamentos para completar o processo.`;

          await enviarMensagemWhatsApp(
            supabase,
            gestor.numero_whatsapp,
            mensagemPagamentos
          );

          console.log(`Lembrete de pagamentos aprovados enviado para ${gestor.name}`);
        }

        if ((!notasPendentes || notasPendentes.length === 0) && 
            (!pagamentosAprovados || pagamentosAprovados.length === 0)) {
          console.log(`Nenhum lembrete necessário para ${gestor.name}`);
        }

      } catch (error) {
        console.error(`Erro ao enviar lembretes para ${gestor.name}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Lembretes enviados com sucesso',
      gestores: gestores.length,
      notasPendentes: notasPendentes?.length || 0,
      pagamentosAprovados: pagamentosAprovados?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function gerarTextoNotas(notas: any[]): string {
  return notas.slice(0, 5).map((nota, index) => {
    const diasPendente = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `${index + 1}. ${nota.pagamentos.medicos.nome} - ${nota.pagamentos.mes_competencia} - R$ ${nota.pagamentos.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${diasPendente}d)`;
  }).join('\n') + (notas.length > 5 ? `\n... e mais ${notas.length - 5} nota(s)` : '');
}

function gerarTextoPagamentos(pagamentos: any[]): string {
  return pagamentos.slice(0, 5).map((pag, index) => {
    return `${index + 1}. ${pag.medicos.nome} - ${pag.mes_competencia} - R$ ${pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }).join('\n') + (pagamentos.length > 5 ? `\n... e mais ${pagamentos.length - 5} pagamento(s)` : '');
}

function gerarHTMLNotasPendentes(notas: any[]): string {
  const linhas = notas.map((nota, index) => {
    const diasPendente = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">${index + 1}</td>
        <td style="padding: 12px; text-align: left;">${nota.pagamentos.medicos.nome}</td>
        <td style="padding: 12px; text-align: left;">${nota.pagamentos.medicos.documento || '-'}</td>
        <td style="padding: 12px; text-align: left;">${nota.pagamentos.mes_competencia}</td>
        <td style="padding: 12px; text-align: right;">R$ ${nota.pagamentos.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px; text-align: center;">${diasPendente} dia(s)</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Notas Pendentes</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 20px;">
      <h1 style="color: #667eea; text-align: center;">HCC Hospital</h1>
      <h2 style="text-align: center;">Notas Fiscais Pendentes de Aprovação</h2>
      <p style="text-align: center; color: #666;">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #667eea;">
            <th style="padding: 12px; text-align: left;">#</th>
            <th style="padding: 12px; text-align: left;">Médico</th>
            <th style="padding: 12px; text-align: left;">CPF/CNPJ</th>
            <th style="padding: 12px; text-align: left;">Competência</th>
            <th style="padding: 12px; text-align: right;">Valor</th>
            <th style="padding: 12px; text-align: center;">Aguardando</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function gerarHTMLPagamentosAprovados(pagamentos: any[]): string {
  const totalValor = pagamentos.reduce((sum, p) => sum + p.valor, 0);
  
  const linhas = pagamentos.map((pag, index) => {
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">${index + 1}</td>
        <td style="padding: 12px; text-align: left;">${pag.medicos.nome}</td>
        <td style="padding: 12px; text-align: left;">${pag.medicos.documento || '-'}</td>
        <td style="padding: 12px; text-align: left;">${pag.mes_competencia}</td>
        <td style="padding: 12px; text-align: right;">R$ ${pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px; text-align: center;">${pag.status === 'aprovado' ? 'Aprovado' : 'Nota Aprovada'}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Pagamentos Aprovados</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 20px;">
      <h1 style="color: #667eea; text-align: center;">HCC Hospital</h1>
      <h2 style="text-align: center;">Pagamentos Aprovados Pendentes</h2>
      <p style="text-align: center; color: #666;">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #667eea;">
            <th style="padding: 12px; text-align: left;">#</th>
            <th style="padding: 12px; text-align: left;">Médico</th>
            <th style="padding: 12px; text-align: left;">CPF/CNPJ</th>
            <th style="padding: 12px; text-align: left;">Competência</th>
            <th style="padding: 12px; text-align: right;">Valor</th>
            <th style="padding: 12px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
        <tfoot>
          <tr style="background-color: #f3f4f6; border-top: 2px solid #667eea; font-weight: bold;">
            <td colspan="4" style="padding: 12px; text-align: right;">TOTAL:</td>
            <td style="padding: 12px; text-align: right;">R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;
}

async function enviarMensagemWhatsApp(
  supabase: any,
  numero: string,
  mensagem: string
): Promise<void> {
  const { data: config } = await supabase
    .from('configuracoes')
    .select('api_url, auth_token')
    .single();

  if (!config) {
    throw new Error('Configurações não encontradas');
  }

  const form = new FormData();
  form.append('number', numero);
  form.append('body', mensagem);
  form.append('externalKey', `lembrete_diario_${Date.now()}`);
  form.append('isClosed', 'false');

  const response = await fetch(config.api_url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.auth_token}`
    },
    body: form
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao enviar mensagem: ${error}`);
  }
}
