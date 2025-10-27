import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Copy, TestTube, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import SystemInfo from "@/components/SystemInfo";

interface Configuracao {
  id: string;
  api_url: string;
  auth_token: string;
  webhook_url: string;
  email_notificacoes: boolean;
  ocr_nfse_habilitado: boolean;
  ocr_nfse_api_key: string;
  permitir_nota_via_whatsapp: boolean;
  horario_envio_relatorios: string;
  intervalo_cobranca_nota_horas: number;
  lembrete_periodico_horas: number;
  modo_manutencao: boolean;
  mensagem_manutencao: string;
  meta_api_url: string;
  meta_token: string;
  meta_phone_number_id: string;
  meta_waba_id: string;
  template_nome: string;
  text_api_url: string;
  text_api_key: string;
  media_api_url: string;
  media_api_key: string;
}

export default function Configuracoes() {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/webhook-handler`;

  useEffect(() => {
    loadConfiguracoes();
    
    // Realtime updates
    const channel = supabase
      .channel('configuracoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => {
        loadConfiguracoes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*")
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      // Se não existe configuração, criar uma padrão
      setConfig({
        id: "",
        api_url: "https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb",
        auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MywicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoyLCJpYXQiOjE3NTgxMjkzMjMsImV4cCI6MTgyMTIwMTMyM30.dEvjbe3ZYLkFn3Bx7N8uKcsw34ZOJoCApJRgAAMmW2w",
        webhook_url: "",
        email_notificacoes: true,
        ocr_nfse_habilitado: false,
        ocr_nfse_api_key: "",
        permitir_nota_via_whatsapp: true,
        horario_envio_relatorios: "08:00",
        intervalo_cobranca_nota_horas: 24,
        lembrete_periodico_horas: 48,
        modo_manutencao: false,
        mensagem_manutencao: "Sistema em manutenção. Voltaremos em breve.",
        meta_api_url: "https://graph.facebook.com/v21.0/468233466375447/messages",
        meta_token: "EAAXSNrvzpbABP7jYQp5lgOw48kSOA5UugXYTs2ZBExZBrDtaC1wUr3tCfZATZBT9SAqmGpZA1pAucXVRa8kZC7trtip0rHAERY0ZAcZA6MkxDsosyCI8O35g0mmBpBuoB8lqihDPvhjsmKz6madZCARKbVW5ihUZCWZCmiND50zARf1Tk58ZAuIlzZAfJ9IzHZCXIZC5QZDZD",
        meta_phone_number_id: "468233466375447",
        meta_waba_id: "421395757718205",
        template_nome: "nota_hcc",
        text_api_url: "https://auto.hcchospital.com.br/message/sendText/inovação",
        text_api_key: "BA6138D0B74C-4AED-8E91-8B3B2C337811",
        media_api_url: "https://auto.hcchospital.com.br/message/sendMedia/inovação",
        media_api_key: "BA6138D0B74C-4AED-8E91-8B3B2C337811",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
        if (config.id) {
          const { error } = await supabase
            .from("configuracoes")
            .update({
              api_url: config.api_url,
              auth_token: config.auth_token,
              webhook_url: config.webhook_url,
              email_notificacoes: config.email_notificacoes,
              ocr_nfse_habilitado: config.ocr_nfse_habilitado,
              ocr_nfse_api_key: config.ocr_nfse_api_key,
              permitir_nota_via_whatsapp: config.permitir_nota_via_whatsapp,
              horario_envio_relatorios: config.horario_envio_relatorios,
              intervalo_cobranca_nota_horas: config.intervalo_cobranca_nota_horas,
              lembrete_periodico_horas: config.lembrete_periodico_horas,
              modo_manutencao: config.modo_manutencao,
              mensagem_manutencao: config.mensagem_manutencao,
              meta_api_url: config.meta_api_url,
              meta_token: config.meta_token,
              meta_phone_number_id: config.meta_phone_number_id,
              meta_waba_id: config.meta_waba_id,
              template_nome: config.template_nome,
              text_api_url: config.text_api_url,
              text_api_key: config.text_api_key,
              media_api_url: config.media_api_url,
              media_api_key: config.media_api_key,
            })
            .eq("id", config.id);

          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("configuracoes")
            .insert([{
              api_url: config.api_url,
              auth_token: config.auth_token,
              webhook_url: config.webhook_url,
              email_notificacoes: config.email_notificacoes,
              ocr_nfse_habilitado: config.ocr_nfse_habilitado,
              ocr_nfse_api_key: config.ocr_nfse_api_key,
              permitir_nota_via_whatsapp: config.permitir_nota_via_whatsapp,
              horario_envio_relatorios: config.horario_envio_relatorios,
              intervalo_cobranca_nota_horas: config.intervalo_cobranca_nota_horas,
              lembrete_periodico_horas: config.lembrete_periodico_horas,
              modo_manutencao: config.modo_manutencao,
              mensagem_manutencao: config.mensagem_manutencao,
              meta_api_url: config.meta_api_url,
              meta_token: config.meta_token,
              meta_phone_number_id: config.meta_phone_number_id,
              meta_waba_id: config.meta_waba_id,
              template_nome: config.template_nome,
              text_api_url: config.text_api_url,
              text_api_key: config.text_api_key,
              media_api_url: config.media_api_url,
              media_api_key: config.media_api_key,
            }])
            .select()
            .single();

          if (error) throw error;
          setConfig({ ...config, id: data.id });
        }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência",
    });
  };

  const testConnection = async () => {
    if (!config) return;

    try {
      const response = await fetch(`${config.api_url}/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.auth_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Conexão com a API funcionando corretamente!",
        });
      } else {
        throw new Error('Falha na conexão');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com a API. Verifique as configurações.",
        variant: "destructive",
      });
    }
  };

  const testEmail = async () => {
    setSendingTestEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-email', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Email de teste enviado!",
        description: "Verifique sua caixa de entrada em suporte@chatconquista.com",
      });
    } catch (error: any) {
      console.error("Erro ao enviar email de teste:", error);
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Falha ao enviar email de teste",
        variant: "destructive",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading || !config) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">
              Configurar integrações e parâmetros do sistema
            </p>
          </div>
          
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>🔧 Modo de Manutenção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="modo_manutencao">Ativar Modo de Manutenção</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, médicos verão um aviso no dashboard
                  </p>
                </div>
                <Switch
                  id="modo_manutencao"
                  checked={config.modo_manutencao}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, modo_manutencao: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem_manutencao">Mensagem de Manutenção</Label>
                <Textarea
                  id="mensagem_manutencao"
                  value={config.mensagem_manutencao}
                  onChange={(e) => setConfig({ ...config, mensagem_manutencao: e.target.value })}
                  rows={3}
                  placeholder="Sistema em manutenção. Voltaremos em breve."
                />
                <p className="text-xs text-muted-foreground">
                  Esta mensagem será exibida no dashboard dos médicos durante a manutenção
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>📱 Configurações Meta WhatsApp (Templates)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_api_url">URL da API Meta</Label>
                  <Input
                    id="meta_api_url"
                    value={config.meta_api_url}
                    onChange={(e) => setConfig({ ...config, meta_api_url: e.target.value })}
                    placeholder="https://graph.facebook.com/v21.0/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_phone_number_id">Phone Number ID</Label>
                  <Input
                    id="meta_phone_number_id"
                    value={config.meta_phone_number_id}
                    onChange={(e) => setConfig({ ...config, meta_phone_number_id: e.target.value })}
                    placeholder="468233466375447"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_waba_id">WhatsApp Business Account ID</Label>
                  <Input
                    id="meta_waba_id"
                    value={config.meta_waba_id}
                    onChange={(e) => setConfig({ ...config, meta_waba_id: e.target.value })}
                    placeholder="421395757718205"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_nome">Nome do Template</Label>
                  <Input
                    id="template_nome"
                    value={config.template_nome}
                    onChange={(e) => setConfig({ ...config, template_nome: e.target.value })}
                    placeholder="nota_hcc"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_token">Token de Acesso Meta</Label>
                <Textarea
                  id="meta_token"
                  value={config.meta_token}
                  onChange={(e) => setConfig({ ...config, meta_token: e.target.value })}
                  rows={3}
                  placeholder="EAAXSNrvzpbABP..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>💬 API de Mensagens de Texto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text_api_url">URL da API</Label>
                <Input
                  id="text_api_url"
                  value={config.text_api_url}
                  onChange={(e) => setConfig({ ...config, text_api_url: e.target.value })}
                  placeholder="https://auto.hcchospital.com.br/message/sendText/inovação"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="text_api_key">Chave da API</Label>
                <Input
                  id="text_api_key"
                  value={config.text_api_key}
                  onChange={(e) => setConfig({ ...config, text_api_key: e.target.value })}
                  placeholder="BA6138D0B74C-4AED-8E91-8B3B2C337811"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📎 API de Envio de Mídia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="media_api_url">URL da API</Label>
                <Input
                  id="media_api_url"
                  value={config.media_api_url}
                  onChange={(e) => setConfig({ ...config, media_api_url: e.target.value })}
                  placeholder="https://auto.hcchospital.com.br/message/sendMedia/inovação"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="media_api_key">Chave da API</Label>
                <Input
                  id="media_api_key"
                  value={config.media_api_key}
                  onChange={(e) => setConfig({ ...config, media_api_key: e.target.value })}
                  placeholder="BA6138D0B74C-4AED-8E91-8B3B2C337811"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API do WhatsApp (Legado)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api_url">URL da API</Label>
                <Input
                  id="api_url"
                  value={config.api_url}
                  onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                  placeholder="https://api.hcchospital.com.br/v2/api/external/..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="auth_token">Token de Autenticação</Label>
                <Textarea
                  id="auth_token"
                  value={config.auth_token}
                  onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>

              <Button onClick={testConnection} variant="outline" className="w-full">
                <TestTube className="h-4 w-4 mr-2" />
                Testar Conexão
              </Button>
              
              <Button 
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('test-webhook');
                    if (error) throw error;
                    toast({
                      title: "Teste do Webhook",
                      description: "Webhook testado com sucesso! Verifique os logs.",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Erro no teste",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline" 
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Testar Webhook
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <p className="text-sm text-muted-foreground">
                  Configure esta URL no seu sistema de WhatsApp para receber notificações de notas:
                </p>
                <div className="flex space-x-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_url">URL de Callback (Opcional)</Label>
                <Input
                  id="webhook_url"
                  value={config.webhook_url}
                  onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  placeholder="https://seudominio.com/webhook"
                />
                <p className="text-xs text-muted-foreground">
                  URL para receber notificações de eventos do sistema
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email_notificacoes">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber emails quando novas notas chegarem e pagamentos forem realizados
                  </p>
                </div>
                <Switch
                  id="email_notificacoes"
                  checked={config.email_notificacoes}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, email_notificacoes: checked })
                  }
                />
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Configuração do Email</h4>
                <div className="space-y-4 mb-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Configuração SMTP Atual:</h5>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Servidor:</strong> smtp.hostinger.com</p>
                      <p><strong>Porta:</strong> 465 (SSL)</p>
                      <p><strong>Usuário:</strong> suporte@chatconquista.com</p>
                      <p><strong>Status:</strong> Configurado ✅</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O sistema está configurado para usar seu servidor SMTP da Hostinger.
                    As notificações serão enviadas do endereço suporte@chatconquista.com.
                  </p>
                </div>
                <div className="space-y-4">
                  <Button 
                    onClick={testEmail}
                    disabled={sendingTestEmail}
                    size="lg"
                    className="w-full"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {sendingTestEmail ? "Enviando Email de Teste..." : "📧 Testar Envio de Email"}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Clique para enviar um email de teste usando o servidor SMTP configurado
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔍 OCR NFS-e (Reconhecimento Automático)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>📝 O que é OCR NFS-e?</strong>
                </p>
                <p className="text-xs text-blue-800">
                  Sistema que extrai automaticamente dados das notas fiscais (número, valor bruto, valor líquido) 
                  e valida se o valor está correto antes de enviar para aprovação. Reduz erros e acelera o processo.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ocr_nfse_habilitado">Habilitar OCR NFS-e</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar reconhecimento automático de dados nas notas fiscais
                  </p>
                </div>
                <Switch
                  id="ocr_nfse_habilitado"
                  checked={config.ocr_nfse_habilitado}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, ocr_nfse_habilitado: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ocr_nfse_api_key">Chave da API OCR</Label>
                <Textarea
                  id="ocr_nfse_api_key"
                  value={config.ocr_nfse_api_key}
                  onChange={(e) => setConfig({ ...config, ocr_nfse_api_key: e.target.value })}
                  rows={4}
                  placeholder="Cole aqui sua chave de API do serviço OCR..."
                  disabled={!config.ocr_nfse_habilitado}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Mantenha esta chave segura. Será usada para processar as notas fiscais.
                </p>
              </div>

              {config.ocr_nfse_habilitado && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900 mb-2">
                    <strong>✅ Quando OCR está ativo:</strong>
                  </p>
                  <ul className="text-xs text-green-800 space-y-1 list-disc list-inside">
                    <li>Sistema extrai automaticamente número da nota, valor bruto e líquido</li>
                    <li>Valida se o valor bruto está correto antes de aprovar</li>
                    <li>Não pede valor líquido ao médico (calcula automaticamente)</li>
                    <li>Rejeita automaticamente notas com valor incorreto</li>
                  </ul>
                </div>
              )}

              {!config.ocr_nfse_habilitado && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>ℹ️ Quando OCR está desativado:</strong>
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    <li>Sistema pergunta ao médico o valor líquido da nota</li>
                    <li>Gestor precisa conferir manualmente os valores na aprovação</li>
                    <li>Processo mais manual, mas sem custos de API OCR</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📱 Upload de Notas via WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="permitir_nota_via_whatsapp">Permitir envio via WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Médicos podem enviar notas direto por mensagem no WhatsApp
                  </p>
                </div>
                <Switch
                  id="permitir_nota_via_whatsapp"
                  checked={config.permitir_nota_via_whatsapp}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, permitir_nota_via_whatsapp: checked })
                  }
                />
              </div>

              {!config.permitir_nota_via_whatsapp && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900">
                    <strong>⚠️ Atenção:</strong> Quando desativado, médicos receberão uma mensagem 
                    informando que devem enviar a nota apenas pelo portal web.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⏰ Agendamento de Relatórios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="horario_envio_relatorios">Horário de Envio aos Gestores</Label>
                <Input
                  id="horario_envio_relatorios"
                  type="time"
                  value={config.horario_envio_relatorios}
                  onChange={(e) => setConfig({ ...config, horario_envio_relatorios: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Horário diário para enviar relatórios via WhatsApp aos gestores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervalo_cobranca">Intervalo Inicial de Cobrança (horas)</Label>
                <Input
                  id="intervalo_cobranca"
                  type="number"
                  min="1"
                  max="72"
                  value={config.intervalo_cobranca_nota_horas}
                  onChange={(e) => setConfig({ ...config, intervalo_cobranca_nota_horas: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Tempo de espera antes da primeira cobrança de nota ao médico (padrão: 24h)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lembrete_periodico">Lembretes Periódicos (horas)</Label>
                <Input
                  id="lembrete_periodico"
                  type="number"
                  min="24"
                  max="168"
                  value={config.lembrete_periodico_horas}
                  onChange={(e) => setConfig({ ...config, lembrete_periodico_horas: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Intervalo para enviar lembretes periódicos de notas pendentes (padrão: 48h)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SystemInfo />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como usar a API de Relatórios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use esta API para alimentar o Google Sheets via Apps Script.
              </p>

              <div>
                <Label>Endpoint</Label>
                <Input
                  readOnly
                  value={"https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/get-relatorio-data"}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Parâmetros opcionais: startDate, endDate (formato ISO). Exemplo:
                </p>
                <Input
                  readOnly
                  value={"...?startDate=2024-01-01&endDate=2024-12-31"}
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div className="p-3 bg-muted/50 rounded">
                <p className="text-xs font-medium mb-2">Resposta (JSON):</p>
                <pre className="text-xs overflow-auto"><code>{`{
  "success": true,
  "solicitacao_de_dados": [ { id, medico_nome, medico_cpf, mes_competencia, valor, data_solicitacao, status } ],
  "dados_resposta": [ { id, medico_nome, medico_cpf, mes_competencia, valor, data_resposta, status, observacoes } ],
  "pagamento_de_dados": [ { id, medico_nome, medico_cpf, mes_competencia, valor_bruto, valor_liquido, data_pagamento, status } ],
  "estatisticas": { total_pagamentos, pagamentos_pagos, pendentes, valor_total_bruto, valor_total_pago },
  "data_geracao": "ISO"
}`}</code></pre>
              </div>

              <div className="p-3 bg-muted/50 rounded">
                <p className="text-xs font-medium mb-2">Exemplo (Apps Script):</p>
                <pre className="text-xs overflow-auto"><code>{`function importarDados() {
  const url = 'https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/get-relatorio-data?startDate=2024-01-01&endDate=2024-12-31';
  const res = UrlFetchApp.fetch(url, { method: 'get', headers: { 'apikey': '${supabase.auth.getSession ? 'SUA_ANON_KEY' : 'SUA_ANON_KEY'}' }});
  const json = JSON.parse(res.getContentText());
  const aba = SpreadsheetApp.getActive().getSheetByName('Relatorio') || SpreadsheetApp.getActive().insertSheet('Relatorio');
  aba.clearContents();
  aba.getRange(1,1,1,7).setValues([[
    'ID','Médico','CPF','Competência','Valor','Data','Status'
  ]]);
  const linhas = json.pagamento_de_dados.map(i => [i.id, i.medico_nome, i.medico_cpf, i.mes_competencia, i.valor_liquido, i.data_pagamento, i.status]);
  if (linhas.length) aba.getRange(2,1,linhas.length,7).setValues(linhas);
}`}</code></pre>
                <p className="text-xs text-muted-foreground mt-2">
                  Dica: use gatilhos do Apps Script para atualizar automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}