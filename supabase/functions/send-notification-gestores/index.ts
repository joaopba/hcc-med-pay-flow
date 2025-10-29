import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GESTOR_API_URL = 'https://api.hcchospital.com.br/v2/api/external/f2fe5527-b359-4b70-95d5-935b8e6674de';
const GESTOR_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjo0LCJpYXQiOjE3NjAxMjEwMjUsImV4cCI6MTgyMzE5MzAyNX0.Orgp1-GE1XncbiDih8SwLqnnwkyJmrL42FfKkUWt8OU';

interface GestorRequest {
  phoneNumber: string;
  message: string;
  pdf_base64?: string;
  pdf_filename?: string;
}

serve(async (req) => {
  // Versão: 2025-10-29-16:27-FORCE
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message, pdf_base64, pdf_filename }: GestorRequest = await req.json();

    console.log('📧 Enviando notificação para gestor:', phoneNumber);

    // Montar multipart/form-data conforme cURL do cliente
    const form = new FormData();
    form.append('number', phoneNumber);
    form.append('body', message);
    form.append('externalKey', `gestor_${phoneNumber}_${Date.now()}`);
    form.append('isClosed', 'false');

    if (pdf_base64 && pdf_filename) {
      try {
        console.log(`📎 Anexando PDF: ${pdf_filename} (${pdf_base64.length} chars base64)`);
        // Converter base64 para Uint8Array usando decode do Deno
        const pdfBytes = decodeBase64(pdf_base64);
        console.log(`✅ PDF decodificado: ${pdfBytes.length} bytes`);
        
        // Criar Blob do PDF - Uint8Array é BlobPart válido
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
        console.log(`✅ Blob criado: ${blob.size} bytes`);
        
        // Adicionar ao FormData com nome 'media'
        form.append('media', blob, pdf_filename);
        console.log(`✅ PDF anexado ao FormData como 'media'`);
      } catch (e: any) {
        console.error('❌ Falha ao montar arquivo PDF para multipart:', e);
        throw new Error(`Erro ao processar PDF: ${e?.message || String(e)}`);
      }
    } else {
      console.log('⚠️ Nenhum PDF para anexar');
    }

    console.log('📤 Enviando multipart/form-data para API dos gestores...');

    const response = await fetch(GESTOR_API_URL, {
      method: 'POST',
      headers: {
        // NÃO defina Content-Type manualmente; o fetch define o boundary automaticamente
        'Authorization': `Bearer ${GESTOR_AUTH_TOKEN}`
      },
      body: form
    });

    console.log('✅ Status da resposta:', response.status);

    const contentType = response.headers.get('content-type');
    let responseData: any;
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      const textResponse = await response.text();
      console.error('Resposta não é JSON:', textResponse.substring(0, 500));
      throw new Error(`API retornou resposta não-JSON (${response.status})`);
    }
    
    console.log('📊 Resposta da API:', responseData);

    // Ignorar erros de contato duplicado
    const isDuplicateContactError = responseData.message && 
      (responseData.message.includes('SequelizeUniqueConstraintError') ||
       responseData.message.includes('contacts_number_tenantid'));
    
    const hasError = !response.ok || 
                     responseData.error || 
                     (responseData.message && (
                       responseData.message.includes('error') ||
                       responseData.message.includes('Error') ||
                       responseData.message.toLowerCase().includes('sent error')
                     ));
    
    if (hasError && !isDuplicateContactError) {
      const errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      console.error('❌ Erro ao enviar mensagem:', errorMsg);
      throw new Error(`Erro ao enviar WhatsApp (${response.status}): ${errorMsg}`);
    }
    
    if (isDuplicateContactError) {
      console.warn('⚠️ Aviso: API retornou erro de contato duplicado, mas mensagem foi enviada');
    }

    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      message: 'Notificação enviada para gestor com sucesso'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('❌ Erro no envio:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});
