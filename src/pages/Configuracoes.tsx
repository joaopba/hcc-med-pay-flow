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

interface Configuracao {
  id: string;
  api_url: string;
  auth_token: string;
  webhook_url: string;
  email_notificacoes: boolean;
}

export default function Configuracoes() {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `${window.location.origin}/api/webhook`;

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
          <Card>
            <CardHeader>
              <CardTitle>API do WhatsApp</CardTitle>
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
              <CardTitle>Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Versão:</p>
                  <p className="font-medium">1.3.2</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último backup:</p>
                  <p className="font-medium">Não configurado</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de médicos:</p>
                  <p className="font-medium">-</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de pagamentos:</p>
                  <p className="font-medium">-</p>
                </div>
              </div>
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