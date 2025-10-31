import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { notaId } = await req.json();

    console.log('🔔 Forçando notificação de nota pendente:', notaId);

    // Buscar detalhes da nota com pagamento e médico
    const { data: nota, error: notaError } = await supabase
      .from('notas_medicos')
      .select(`
        id,
        status,
        arquivo_url,
        created_at,
        pagamento_id,
        pagamentos (
          id,
          mes_competencia,
          valor,
          empresa_id,
          medicos (
            nome,
            documento,
            numero_whatsapp
          )
        )
      `)
      .eq('id', notaId)
      .single();

    if (notaError || !nota) {
      console.error('Erro ao buscar nota:', notaError);
      throw new Error('Nota não encontrada');
    }

    // Se não é pendente, não notifica
    if (nota.status !== 'pendente') {
      throw new Error(`Nota não está pendente (status: ${nota.status})`);
    }

    const pagamento = Array.isArray(nota.pagamentos) ? nota.pagamentos[0] : nota.pagamentos;
    const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;

    // Buscar gestores com WhatsApp habilitado da mesma empresa
    const { data: gestores, error: gestoresError } = await supabase
      .from('profiles')
      .select('id, name, numero_whatsapp')
      .eq('role', 'gestor')
      .eq('empresa_id', pagamento.empresa_id)
      .eq('whatsapp_notifications_enabled', true)
      .not('numero_whatsapp', 'is', null);

    if (gestoresError || !gestores || gestores.length === 0) {
      throw new Error('Nenhum gestor encontrado para notificar');
    }

    console.log(`Encontrados ${gestores.length} gestores para notificar`);

    // Baixar o PDF do storage
    let pdfBase64: string | undefined;
    let pdfFilename: string | undefined;
    
    if (nota.arquivo_url) {
      try {
        console.log('Baixando PDF:', nota.arquivo_url);
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('notas-medicos')
          .download(nota.arquivo_url);

        if (downloadError || !pdfData) {
          console.error('Erro ao baixar PDF:', downloadError);
        } else {
          const arrayBuffer = await pdfData.arrayBuffer();
          pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          pdfFilename = `nota_${medico.nome.replace(/\s+/g, '_')}_${pagamento.mes_competencia}.pdf`;
          console.log('PDF convertido para base64');
        }
      } catch (e: any) {
        console.error('Erro ao processar PDF:', e);
      }
    }

    // Formatar mensagem
    const mesFormatado = formatMesCompetencia(pagamento.mes_competencia);
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(pagamento.valor);

    const diasAguardando = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));

    const mensagem = `📄 *NOTA PENDENTE - ENVIO FORÇADO*\n\n` +
      `👨‍⚕️ Médico: *${medico.nome}*\n` +
      `📅 Competência: ${mesFormatado}\n` +
      `💰 Valor: ${valorFormatado}\n` +
      `⏱️ Aguardando há ${diasAguardando} dia(s)\n\n` +
      `⚠️ *Aguardando aprovação*\n\n` +
      `Acesse o portal para revisar:\n` +
      `https://hcc.chatconquista.com/aprovar-nota`;

    // Enviar notificação para cada gestor
    const envios = await Promise.allSettled(
      gestores.map(async (gestor) => {
        try {
          console.log(`Enviando para ${gestor.name} (${gestor.numero_whatsapp})`);
          
          const { data, error } = await supabase.functions.invoke('send-notification-gestores', {
            body: {
              phoneNumber: gestor.numero_whatsapp,
              message: mensagem,
              pdf_base64: pdfBase64,
              pdf_filename: pdfFilename
            }
          });

          if (error) throw error;
          
          console.log(`✅ Enviado para ${gestor.name}`);
          return { gestor: gestor.name, success: true };
        } catch (error: any) {
          console.error(`❌ Erro ao enviar para ${gestor.name}:`, error);
          return { gestor: gestor.name, success: false, error: error.message };
        }
      })
    );

    const sucessos = envios.filter(r => r.status === 'fulfilled').length;
    const falhas = envios.filter(r => r.status === 'rejected').length;

    console.log(`✅ Resultado: ${sucessos} enviados, ${falhas} falhas`);

    return new Response(JSON.stringify({
      success: true,
      enviosRealizados: sucessos,
      falhas: falhas,
      gestores: gestores.length,
      nota: {
        id: nota.id,
        medico: medico.nome,
        valor: valorFormatado,
        competencia: mesFormatado
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ Erro ao notificar gestores:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
