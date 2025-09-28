import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const webhookData = await req.json();
    console.log('Webhook recebido:', JSON.stringify(webhookData, null, 2));

    // Verificar se é uma mensagem com arquivo PDF
    if (webhookData.message && webhookData.message.type === 'document') {
      const { message } = webhookData;
      const { document, from } = message;
      
      if (document && document.mime_type === 'application/pdf') {
        console.log('PDF recebido de:', from, 'Arquivo:', document.filename);

        // Buscar pagamento pendente para este número
        const numeroLimpo = from.replace(/\D/g, '');
        
        const { data: pagamentos } = await supabase
          .from('pagamentos')
          .select(`
            id, 
            valor,
            medicos!inner(numero_whatsapp)
          `)
          .eq('status', 'solicitado')
          .like('medicos.numero_whatsapp', `%${numeroLimpo}%`)
          .limit(1);

        if (pagamentos && pagamentos.length > 0) {
          const pagamento = pagamentos[0];
          
          // Fazer download do arquivo PDF
          try {
            const fileResponse = await fetch(document.url || document.link, {
              headers: {
                'Authorization': `Bearer ${Deno.env.get('WHATSAPP_TOKEN') || ''}`,
              }
            });
            
            if (fileResponse.ok) {
              const fileData = await fileResponse.arrayBuffer();
              const fileName = `nota_${pagamento.id}_${Date.now()}.pdf`;
              
              // Fazer upload para o Supabase Storage
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('notas')
                .upload(fileName, fileData, {
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
                nota_pdf_url: `notas/${fileName}`,
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

              // Enviar notificação por email (opcional)
              try {
                await supabase.functions.invoke('send-notification', {
                  body: {
                    type: 'nova_nota',
                    pagamentoId: pagamento.id,
                    fileName,
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
      error: error.message,
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});

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