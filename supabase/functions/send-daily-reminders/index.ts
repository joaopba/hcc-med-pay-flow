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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Iniciando envio de lembretes diários');

    // Buscar horário configurado
    const { data: config } = await supabase
      .from('configuracoes')
      .select('horario_envio_relatorios')
      .single();

    if (config?.horario_envio_relatorios) {
      // Converter UTC para horário de Brasília (UTC-3)
      const now = new Date();
      const brasiliaOffset = -3; // UTC-3
      const horaAtualBrasilia = (now.getUTCHours() + brasiliaOffset + 24) % 24;
      
      const [horaConfig, minutoConfig] = config.horario_envio_relatorios.split(':').map(Number);
      
      // Verifica se está no horário configurado (mesma hora)
      if (horaAtualBrasilia !== horaConfig) {
        console.log(`Não está no horário configurado. Hora atual (Brasília): ${horaAtualBrasilia}, Hora configurada: ${horaConfig}`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Fora do horário configurado',
          horaAtualBrasilia,
          horaConfig
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ No horário configurado! Hora Brasília: ${horaAtualBrasilia}, Configurado: ${horaConfig}`);
    }

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
      .eq('status', 'aprovado');

    if (pagamentosError) {
      console.error('Erro ao buscar pagamentos aprovados:', pagamentosError);
    }

    // Buscar pagamentos que não tem solicitação de nota (status 'pendente')
    const { data: pagamentosPendentes, error: pagamentosPendentesError } = await supabase
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
      .eq('status', 'pendente');

    if (pagamentosPendentesError) {
      console.error('Erro ao buscar pagamentos pendentes:', pagamentosPendentesError);
    }

    console.log(`Notas pendentes: ${notasPendentes?.length || 0}`);
    console.log(`Pagamentos aprovados não pagos: ${pagamentosAprovados?.length || 0}`);
    console.log(`Pagamentos pendentes sem nota: ${pagamentosPendentes?.length || 0}`);

    for (const gestor of gestores) {
      try {
        const relatorios = [];
        
        // Verificar se há notas pendentes
        if (notasPendentes && notasPendentes.length > 0) {
          relatorios.push(gerarRelatorioNotasPendentes(notasPendentes, gestor.name));
        }

        // Verificar se há pagamentos aprovados
        if (pagamentosAprovados && pagamentosAprovados.length > 0) {
          relatorios.push(gerarRelatorioPagamentosAprovados(pagamentosAprovados, gestor.name));
        }

        // Verificar se há pagamentos sem solicitação
        if (pagamentosPendentes && pagamentosPendentes.length > 0) {
          relatorios.push(gerarRelatorioPagamentosPendentes(pagamentosPendentes, gestor.name));
        }

        // Se tem relatórios, enviar UMA ÚNICA mensagem com todos
        if (relatorios.length > 0) {
          const mensagemCompleta = relatorios.join('\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n');
          await enviarMensagemWhatsApp(supabase, gestor.numero_whatsapp, mensagemCompleta);
          console.log(`Relatório completo enviado para ${gestor.name}`);
        } else {
          // Se não há nada pendente, enviar mensagem de "tudo OK"
          const mensagemTudoOk = `✅ *Relatório Diário - HCC Hospital*\n\n` +
            `📅 ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n\n` +
            `Olá ${gestor.name}!\n\n` +
            `🎉 *Tudo em dia!*\n\n` +
            `Não há notas pendentes de aprovação, pagamentos aguardando processamento ou pagamentos sem nota solicitada.`;
          
          await enviarMensagemWhatsApp(supabase, gestor.numero_whatsapp, mensagemTudoOk);
          console.log(`Mensagem "tudo OK" enviada para ${gestor.name}`);
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
      pagamentosAprovados: pagamentosAprovados?.length || 0,
      pagamentosPendentes: pagamentosPendentes?.length || 0
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

function gerarRelatorioNotasPendentes(notas: any[], nomeGestor: string): string {
  const totalValor = notas.reduce((sum, n) => sum + Number(n.pagamentos.valor), 0);
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  const header = `📋 *RELATÓRIO DE NOTAS PENDENTES*\n` +
    `📅 ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n\n` +
    `Olá ${nomeGestor}!\n\n` +
    `Você tem *${notas.length} nota(s)* aguardando aprovação.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const listaNotas = notas.slice(0, 10).map((nota, idx) => {
    const diasPendente = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `*${idx + 1}. ${nota.pagamentos.medicos.nome}*\n` +
      `   💰 ${formatValor(nota.pagamentos.valor)}\n` +
      `   📅 ${nota.pagamentos.mes_competencia}\n` +
      `   ⏱️ ${diasPendente} dia(s) aguardando\n`;
  }).join('\n');

  const rodape = notas.length > 10 
    ? `\n_...e mais ${notas.length - 10} notas_\n\n`
    : '\n';

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *TOTAL: ${formatValor(totalValor)}*\n\n` +
    `🔗 Acesse o portal:\n` +
    `https://hcc.chatconquista.com\n\n` +
    `⚡ *Ação Necessária* para liberar os pagamentos.`;

  return header + listaNotas + rodape + total;
}

function gerarRelatorioPagamentosAprovados(pagamentos: any[], nomeGestor: string): string {
  const totalValor = pagamentos.reduce((sum, p) => sum + Number(p.valor), 0);
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  const header = `💰 *RELATÓRIO DE PAGAMENTOS APROVADOS*\n` +
    `📅 ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n\n` +
    `Olá ${nomeGestor}!\n\n` +
    `Você tem *${pagamentos.length} pagamento(s)* aprovado(s) aguardando processamento.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const listaPagamentos = pagamentos.slice(0, 10).map((pag, idx) => {
    return `*${idx + 1}. ${pag.medicos.nome}*\n` +
      `   💰 ${formatValor(pag.valor)}\n` +
      `   📅 ${pag.mes_competencia}\n` +
      `   ✅ ${pag.status === 'aprovado' ? 'Aprovado' : 'Nota Aprovada'}\n`;
  }).join('\n');

  const rodape = pagamentos.length > 10 
    ? `\n_...e mais ${pagamentos.length - 10} pagamentos_\n\n`
    : '\n';

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *TOTAL: ${formatValor(totalValor)}*\n\n` +
    `🔗 Acesse o portal:\n` +
    `https://hcc.chatconquista.com/pagamentos\n\n` +
    `✅ *Finalize os pagamentos* para completar o processo.`;

  return header + listaPagamentos + rodape + total;
}

function gerarRelatorioPagamentosPendentes(pagamentos: any[], nomeGestor: string): string {
  const totalValor = pagamentos.reduce((sum, p) => sum + Number(p.valor), 0);
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  const header = `📋 *PAGAMENTOS SEM SOLICITAÇÃO DE NOTA*\n` +
    `📅 ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n\n` +
    `Olá ${nomeGestor}!\n\n` +
    `Você tem *${pagamentos.length} pagamento(s)* que ainda não teve nota solicitada.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const listaPagamentos = pagamentos.slice(0, 10).map((pag, idx) => {
    return `*${idx + 1}. ${pag.medicos.nome}*\n` +
      `   💰 ${formatValor(pag.valor)}\n` +
      `   📅 ${pag.mes_competencia}\n` +
      `   ⏳ Aguardando Solicitação\n`;
  }).join('\n');

  const rodape = pagamentos.length > 10 
    ? `\n_...e mais ${pagamentos.length - 10} pagamentos_\n\n`
    : '\n';

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *TOTAL: ${formatValor(totalValor)}*\n\n` +
    `🔗 Acesse o portal:\n` +
    `https://hcc.chatconquista.com/pagamentos\n\n` +
    `⚡ *Solicite as notas* para iniciar o processo de pagamento.`;

  return header + listaPagamentos + rodape + total;
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
