import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Eye, Trash2, Users, FileSpreadsheet, Send, Download, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import NotasAprovacao from "@/components/NotasAprovacao";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ExcelImport from "@/components/ExcelImport";
import { Skeleton } from "@/components/ui/skeleton";

interface Medico {
  id: string;
  nome: string;
  numero_whatsapp: string;
}

interface Pagamento {
  id: string;
  medico_id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  data_solicitacao: string;
  data_resposta: string;
  data_pagamento: string;
  valor_liquido: number;
  nota_pdf_url: string;
  comprovante_url: string;
  observacoes: string;
  medicos: Medico;
}

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [mesFilter, setMesFilter] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedPagamentos, setSelectedPagamentos] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    medico_id: "",
    mes_competencia: "",
    valor: "",
  });

  useEffect(() => {
    loadData();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel('pagamentos-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagamentos'
        },
        (payload) => {
          console.log('Atualização em pagamentos:', payload);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas_medicos'
        },
        (payload) => {
          console.log('Atualização em notas_medicos:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      // Carregar pagamentos com dados dos médicos
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from("pagamentos")
        .select(`
          *,
          medicos (
            id,
            nome,
            numero_whatsapp
          )
        `)
        .order("mes_competencia", { ascending: false });

      if (pagamentosError) throw pagamentosError;

      // Carregar médicos ativos para o formulário
      const { data: medicosData, error: medicosError } = await supabase
        .from("medicos")
        .select("id, nome, numero_whatsapp")
        .eq("ativo", true)
        .order("nome");

      if (medicosError) throw medicosError;

      setPagamentos(pagamentosData || []);
      setMedicos(medicosData || []);
      
      // Extrair meses únicos dos pagamentos para o filtro
      const mesesUnicos = [...new Set(pagamentosData?.map(p => p.mes_competencia) || [])]
        .sort((a, b) => b.localeCompare(a)); // Ordenar do mais recente para o mais antigo
      setMesesDisponiveis(mesesUnicos);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Verificar se já existe pagamento para este médico e mês
      const { data: existingPayment } = await supabase
        .from("pagamentos")
        .select("id")
        .eq("medico_id", formData.medico_id)
        .eq("mes_competencia", formData.mes_competencia)
        .single();

      if (existingPayment) {
        toast({
          title: "Erro",
          description: "Já existe um pagamento para este médico neste mês de competência",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("pagamentos")
        .insert([{
          medico_id: formData.medico_id,
          mes_competencia: formData.mes_competencia,
          valor: parseFloat(formData.valor),
        }]);
      
      if (error) {
        // Verificar se é erro de constraint única
        if (error.code === '23505' && error.message.includes('pagamentos_medico_id_mes_competencia_key')) {
          toast({
            title: "Erro",
            description: "Já existe um pagamento para este médico neste mês de competência",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      toast({
        title: "Sucesso",
        description: "Pagamento cadastrado com sucesso!",
      });

      setShowDialog(false);
      setFormData({ medico_id: "", mes_competencia: "", valor: "" });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar pagamento:", error);
      toast({
        title: "Erro",
        description: "Falha ao cadastrar pagamento",
        variant: "destructive",
      });
    }
  };

  const handleSolicitarNotas = async () => {
    if (selectedPagamentos.length === 0) {
      toast({
        title: "Aviso",
        description: "Selecione pelo menos um pagamento",
        variant: "destructive",
      });
      return;
    }

    // Prevenir duplo clique
    const button = document.querySelector('[data-solicitar-notas]') as HTMLButtonElement;
    if (button) {
      button.disabled = true;
      setTimeout(() => {
        button.disabled = false;
      }, 3000);
    }

    try {
      for (const pagamentoId of selectedPagamentos) {
        const pagamento = pagamentos.find(p => p.id === pagamentoId);
        if (!pagamento?.medicos) {
          console.warn('Pagamento sem médico vinculado:', pagamentoId);
          continue;
        }
        await supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota',
            numero: pagamento.medicos.numero_whatsapp,
            nome: pagamento.medicos.nome,
            valor: pagamento.valor.toString(),
            competencia: pagamento.mes_competencia,
            pagamentoId: pagamento.id
          }
        });

        // Atualizar status
        await supabase
          .from("pagamentos")
          .update({ 
            status: "solicitado",
            data_solicitacao: new Date().toISOString()
          })
          .eq("id", pagamento.id);
      }

      toast({
        title: "Sucesso",
        description: `${selectedPagamentos.length} solicitação(ões) enviada(s) via WhatsApp!`,
      });

      setSelectedPagamentos([]);
      loadData();
    } catch (error) {
      console.error("Erro ao enviar solicitações:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar solicitações",
        variant: "destructive",
      });
    }
  };

  const handlePagamento = async (pagamentoId: string, dataPagamento: string) => {
    try {
      const pagamento = pagamentos.find(p => p.id === pagamentoId);
      if (!pagamento) return;

      // Enviar notificação de pagamento
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'pagamento',
          numero: pagamento.medicos.numero_whatsapp,
          nome: pagamento.medicos.nome,
          dataPagamento: dataPagamento,
        }
      });

      // Atualizar status
      await supabase
        .from("pagamentos")
        .update({ 
          status: "pago",
          data_pagamento: dataPagamento
        })
        .eq("id", pagamentoId);

      toast({
        title: "Sucesso",
        description: "Notificação de pagamento enviada!",
      });

      loadData();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      toast({
        title: "Erro",
        description: "Falha ao processar pagamento",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "secondary";
      case "solicitado": return "default";
      case "nota_recebida": return "outline";
      case "pago": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente": return "Pendente";
      case "solicitado": return "Solicitado";
      case "nota_recebida": return "Nota Recebida";
      case "pago": return "Pago";
      default: return status;
    }
  };

  const handleExcelImport = async (data: any[]) => {
    try {
      const pagamentosData = [];
      const duplicados = [];
      
      for (const row of data) {
        // Buscar médico pelo nome
        const medicoNome = row.medico || row.Medico || row.nome_medico;
        const medico = medicos.find(m => m.nome.toLowerCase().includes(medicoNome?.toLowerCase()));
        
        if (!medico) {
          throw new Error(`Médico não encontrado: ${medicoNome}`);
        }

        const mesCompetencia = row.mes_competencia || row.competencia || row.Competencia;
        
        // Verificar se já existe pagamento para este médico e mês
        const { data: existingPayment } = await supabase
          .from("pagamentos")
          .select("id")
          .eq("medico_id", medico.id)
          .eq("mes_competencia", mesCompetencia)
          .single();

        if (existingPayment) {
          duplicados.push(`${medico.nome} - ${mesCompetencia}`);
          continue;
        }

        pagamentosData.push({
          medico_id: medico.id,
          mes_competencia: mesCompetencia,
          valor: parseFloat(row.valor || row.Valor || "0")
        });
      }

      if (pagamentosData.length === 0) {
        throw new Error("Nenhum pagamento válido para importar (todos são duplicados ou inválidos)");
      }

      const { error } = await supabase
        .from("pagamentos")
        .insert(pagamentosData);

      if (error) throw error;

      let successMessage = `${pagamentosData.length} pagamento(s) importado(s) com sucesso!`;
      if (duplicados.length > 0) {
        successMessage += ` ${duplicados.length} duplicado(s) ignorado(s): ${duplicados.join(', ')}`;
      }

      toast({
        title: "Importação Concluída",
        description: successMessage,
      });

      setShowImportDialog(false);
      await loadData();
    } catch (error) {
      console.error("Erro ao importar pagamentos:", error);
      throw error;
    }
  };

  const getTemplateData = () => [
    {
      medico: "Dr. João Silva",
      mes_competencia: "2024-01",
      valor: 5000.00
    },
    {
      medico: "Dra. Maria Santos", 
      mes_competencia: "2024-01",
      valor: 7500.50
    }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredPagamentos = pagamentos.filter((pagamento) => {
    const medicoNome = pagamento.medicos?.nome?.toLowerCase?.() || "";
    const matchesSearch = medicoNome.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || pagamento.status === statusFilter;
    const matchesMes = !mesFilter || pagamento.mes_competencia === mesFilter;
    
    return matchesSearch && matchesStatus && matchesMes;
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
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
            <h1 className="text-3xl font-bold">Pagamentos</h1>
            <p className="text-muted-foreground">
              Gerenciar pagamentos e solicitações de notas
            </p>
          </div>
          
          <div className="flex space-x-2">
            {selectedPagamentos.length > 0 && (
              <Button onClick={handleSolicitarNotas} data-solicitar-notas>
                <Send className="h-4 w-4 mr-2" />
                Solicitar Notas ({selectedPagamentos.length})
              </Button>
            )}

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Pagamentos via Excel</DialogTitle>
                </DialogHeader>
                <ExcelImport
                  onImport={handleExcelImport}
                  templateData={getTemplateData()}
                  templateFilename="modelo-pagamentos.xlsx"
                  expectedColumns={["medico", "mes_competencia", "valor"]}
                  title="Importação de Pagamentos"
                />
              </DialogContent>
            </Dialog>
            
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Pagamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="medico_id">Médico</Label>
                    <Select value={formData.medico_id} onValueChange={(value) => setFormData({ ...formData, medico_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um médico" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicos.map((medico) => (
                          <SelectItem key={medico.id} value={medico.id}>
                            {medico.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mes_competencia">Mês/Ano</Label>
                    <Input
                      id="mes_competencia"
                      type="month"
                      value={formData.mes_competencia}
                      onChange={(e) => setFormData({ ...formData, mes_competencia: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Salvar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

          {/* Seção de Aprovação de Notas */}
          <div className="mb-6">
            <NotasAprovacao />
          </div>

          <Card className="mb-4">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Buscar médicos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="solicitado">Solicitado</SelectItem>
                  <SelectItem value="nota_recebida">Nota Recebida</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os meses</SelectItem>
                  {mesesDisponiveis.map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {new Date(mes + '-01').toLocaleDateString('pt-BR', { 
                        year: 'numeric', 
                        month: 'long' 
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="month"
                value={mesFilter}
                onChange={(e) => setMesFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={selectedPagamentos.length === filteredPagamentos.length && filteredPagamentos.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPagamentos(filteredPagamentos.filter(p => p.status === "pendente").map(p => p.id));
                        } else {
                          setSelectedPagamentos([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Valor Bruto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPagamentos.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPagamentos.includes(pagamento.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPagamentos([...selectedPagamentos, pagamento.id]);
                          } else {
                            setSelectedPagamentos(selectedPagamentos.filter(id => id !== pagamento.id));
                          }
                        }}
                        disabled={pagamento.status !== "pendente"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{pagamento.medicos?.nome || '—'}</TableCell>
                    <TableCell>{pagamento.mes_competencia}</TableCell>
                    <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(pagamento.status)}>
                        {getStatusLabel(pagamento.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pagamento.valor_liquido ? formatCurrency(pagamento.valor_liquido) : "-"}
                    </TableCell>
                    <TableCell>
                      {pagamento.data_pagamento ? 
                        new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR') : 
                        '-'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {pagamento.status === "nota_recebida" && (
                          <>
                            {pagamento.nota_pdf_url && (
                              <Button size="sm" variant="outline">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handlePagamento(pagamento.id, new Date().toISOString().split('T')[0])}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}