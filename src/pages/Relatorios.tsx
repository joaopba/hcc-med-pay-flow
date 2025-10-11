import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoHcc from "@/assets/logo.png";
import logoConquista from "@/assets/conquista-inovacao.png";

interface RelatorioItem {
  medico_nome: string;
  numero_whatsapp: string;
  mes_competencia: string;
  valor: number;
  valor_liquido: number;
  status: string;
  data_solicitacao: string;
  data_resposta: string;
  data_pagamento: string;
}

export default function Relatorios() {
  const [dados, setDados] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    mes_inicio: "",
    mes_fim: "",
    status: "todos",
    medico: "",
  });
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pagamentos")
        .select(`
          valor,
          valor_liquido,
          status,
          mes_competencia,
          data_solicitacao,
          data_resposta,
          data_pagamento,
          medicos (
            nome,
            numero_whatsapp
          )
        `)
        .order("mes_competencia", { ascending: false });

      // Aplicar filtros
      if (filtros.mes_inicio) {
        query = query.gte("mes_competencia", filtros.mes_inicio);
      }
      
      if (filtros.mes_fim) {
        query = query.lte("mes_competencia", filtros.mes_fim);
      }
      
      if (filtros.status !== "todos") {
        query = query.eq("status", filtros.status as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Transformar dados para o formato do relatório
      const dadosFormatados = data?.map(item => {
        // Função para formatar data evitando timezone
        const formatarData = (dataStr: string | null) => {
          if (!dataStr) return '';
          const data = dataStr.split('T')[0]; // Pega apenas a parte da data
          const [ano, mes, dia] = data.split('-');
          return `${dia}/${mes}/${ano}`;
        };

        return {
          medico_nome: item.medicos.nome,
          numero_whatsapp: item.medicos.numero_whatsapp,
          mes_competencia: item.mes_competencia,
          valor: item.valor,
          valor_liquido: item.valor_liquido || 0,
          status: item.status,
          data_solicitacao: formatarData(item.data_solicitacao),
          data_resposta: formatarData(item.data_resposta),
          data_pagamento: formatarData(item.data_pagamento),
        };
      }) || [];

      // Filtrar por médico se especificado
      const dadosFiltrados = filtros.medico 
        ? dadosFormatados.filter(item => 
            item.medico_nome.toLowerCase().includes(filtros.medico.toLowerCase())
          )
        : dadosFormatados;

      setDados(dadosFiltrados);
      
      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${dadosFiltrados.length} registros`,
      });
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = async () => {
    if (dados.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Converter imagens para base64
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = url;
        });
      };

      // Carregar logos
      const logoHccBase64 = await loadImage(logoHcc);
      const logoConquistaBase64 = await loadImage(logoConquista);

      // Header com logo HCC
      doc.addImage(logoHccBase64, 'PNG', 15, 10, 40, 15);
      
      // Título
      doc.setFontSize(20);
      doc.setTextColor(51, 51, 51);
      doc.text("Relatório de Pagamentos", pageWidth / 2, 35, { align: 'center' });
      
      // Data do relatório
      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 42, { align: 'center' });
      
      // Linha decorativa
      doc.setDrawColor(52, 152, 219);
      doc.setLineWidth(0.5);
      doc.line(15, 48, pageWidth - 15, 48);

      // Resumo
      const totalBruto = dados.reduce((sum, item) => sum + item.valor, 0);
      const totalLiquido = dados.reduce((sum, item) => sum + item.valor_liquido, 0);
      
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text(`Total de Registros: ${dados.length}`, 15, 58);
      doc.text(`Valor Total Bruto: ${formatCurrency(totalBruto)}`, 15, 64);
      doc.text(`Valor Total Líquido: ${formatCurrency(totalLiquido)}`, 15, 70);

      // Tabela com os dados
      const tableData = dados.map(item => [
        item.medico_nome,
        item.mes_competencia,
        formatCurrency(item.valor),
        formatCurrency(item.valor_liquido),
        getStatusLabel(item.status),
        item.data_solicitacao,
        item.data_resposta,
        item.data_pagamento
      ]);

      autoTable(doc, {
        startY: 78,
        head: [['Médico', 'Competência', 'Valor Bruto', 'Valor Líquido', 'Status', 'Dt. Solicitação', 'Dt. Resposta', 'Dt. Pagamento']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 51, 51]
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
          7: { cellWidth: 22, halign: 'center' }
        },
        margin: { left: 15, right: 15 }
      });

      // Footer com logo Conquista
      const finalY = (doc as any).lastAutoTable.finalY || 78;
      const footerY = doc.internal.pageSize.height - 25;
      
      // Se a tabela for muito grande, adicionar em nova página
      if (finalY > footerY - 10) {
        doc.addPage();
      }
      
      // Linha decorativa antes do footer
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(15, doc.internal.pageSize.height - 22, pageWidth - 15, doc.internal.pageSize.height - 22);
      
      // Texto "Desenvolvido por"
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      doc.text("Desenvolvido por", pageWidth / 2, doc.internal.pageSize.height - 17, { align: 'center' });
      
      // Logo Conquista Inovação
      doc.addImage(logoConquistaBase64, 'PNG', pageWidth / 2 - 15, doc.internal.pageSize.height - 15, 30, 8);

      // Salvar PDF
      doc.save(`relatorio_pagamentos_${new Date().toISOString().slice(0, 10)}.pdf`);

      toast({
        title: "Sucesso",
        description: "Relatório PDF gerado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportarCSV = () => {
    if (dados.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    const headers = [
      "Médico",
      "WhatsApp",
      "Competência",
      "Valor Bruto",
      "Valor Líquido",
      "Status",
      "Data Solicitação",
      "Data Resposta",
      "Data Pagamento"
    ];

    const csvContent = [
      headers.join(","),
      ...dados.map(item => [
        `"${item.medico_nome}"`,
        `"${item.numero_whatsapp}"`,
        item.mes_competencia,
        item.valor.toFixed(2),
        item.valor_liquido.toFixed(2),
        `"${getStatusLabel(item.status)}"`,
        `"${item.data_solicitacao}"`,
        `"${item.data_resposta}"`,
        `"${item.data_pagamento}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_pagamentos_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Sucesso",
      description: "Relatório exportado com sucesso!",
    });
    
    setExporting(false);
  };

  const exportarGoogleSheets = async () => {
    try {
      // Preparar dados para Google Sheets API
      const sheetData = [
        ["Médico", "WhatsApp", "Competência", "Valor Bruto", "Valor Líquido", "Status", "Data Solicitação", "Data Resposta", "Data Pagamento"],
        ...dados.map(item => [
          item.medico_nome,
          item.numero_whatsapp,
          item.mes_competencia,
          item.valor,
          item.valor_liquido,
          getStatusLabel(item.status),
          item.data_solicitacao,
          item.data_resposta,
          item.data_pagamento
        ])
      ];

      // Chamar edge function para integração com Google Sheets
      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: {
          data: sheetData,
          sheetName: `Pagamentos_${new Date().toISOString().slice(0, 10)}`
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados exportados para Google Sheets!",
      });
      
      if (data?.sheetUrl) {
        window.open(data.sheetUrl, '_blank');
      }
    } catch (error) {
      console.error("Erro ao exportar para Google Sheets:", error);
      toast({
        title: "Erro",
        description: "Falha ao exportar para Google Sheets. Verifique as configurações da API.",
        variant: "destructive",
      });
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-6">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerar relatórios e exportar dados para análise
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="mes_inicio">Mês Início</Label>
                <Input
                  id="mes_inicio"
                  type="month"
                  value={filtros.mes_inicio}
                  onChange={(e) => setFiltros({ ...filtros, mes_inicio: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mes_fim">Mês Fim</Label>
                <Input
                  id="mes_fim"
                  type="month"
                  value={filtros.mes_fim}
                  onChange={(e) => setFiltros({ ...filtros, mes_fim: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="nota_recebida">Nota Recebida</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="medico">Médico</Label>
                <Input
                  id="medico"
                  placeholder="Nome do médico..."
                  value={filtros.medico}
                  onChange={(e) => setFiltros({ ...filtros, medico: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={gerarRelatorio} disabled={loading} className="w-full sm:w-auto">
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              
              {dados.length > 0 && (
                <>
                  <Button onClick={exportarPDF} variant="default" disabled={exporting} className="w-full sm:w-auto">
                    <FileText className="h-4 w-4 mr-2" />
                    {exporting ? "Gerando..." : "Exportar PDF"}
                  </Button>
                  
                  <Button onClick={exportarCSV} variant="outline" disabled={exporting} className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  
                  <Button onClick={exportarGoogleSheets} variant="outline" className="w-full sm:w-auto">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Google Sheets
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {dados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados ({dados.length} registros)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Médico</TableHead>
                      <TableHead className="min-w-[120px]">Competência</TableHead>
                      <TableHead className="min-w-[120px]">Valor Bruto</TableHead>
                      <TableHead className="min-w-[120px]">Valor Líquido</TableHead>
                      <TableHead className="min-w-[130px]">Status</TableHead>
                      <TableHead className="min-w-[130px]">Data Solicitação</TableHead>
                      <TableHead className="min-w-[130px]">Data Resposta</TableHead>
                      <TableHead className="min-w-[130px]">Data Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.medico_nome}</TableCell>
                        <TableCell>{item.mes_competencia}</TableCell>
                        <TableCell>{formatCurrency(item.valor)}</TableCell>
                        <TableCell>{formatCurrency(item.valor_liquido)}</TableCell>
                        <TableCell>{getStatusLabel(item.status)}</TableCell>
                        <TableCell>{item.data_solicitacao}</TableCell>
                        <TableCell>{item.data_resposta}</TableCell>
                        <TableCell>{item.data_pagamento}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}