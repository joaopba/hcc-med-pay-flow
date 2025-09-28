import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
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

interface Medico {
  id: string;
  nome: string;
  numero_whatsapp: string;
  especialidade: string;
  ativo: boolean;
}

export default function Medicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    numero_whatsapp: "",
    especialidade: "",
  });

  useEffect(() => {
    loadMedicos();
  }, []);

  const loadMedicos = async () => {
    try {
      const { data, error } = await supabase
        .from("medicos")
        .select("*")
        .order("nome");

      if (error) throw error;
      setMedicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar médicos:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingMedico) {
        const { error } = await supabase
          .from("medicos")
          .update(formData)
          .eq("id", editingMedico.id);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("medicos")
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico cadastrado com sucesso!",
        });
      }

      setShowDialog(false);
      setEditingMedico(null);
      setFormData({ nome: "", numero_whatsapp: "", especialidade: "" });
      loadMedicos();
    } catch (error) {
      console.error("Erro ao salvar médico:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar médico",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (medico: Medico) => {
    setEditingMedico(medico);
    setFormData({
      nome: medico.nome,
      numero_whatsapp: medico.numero_whatsapp,
      especialidade: medico.especialidade || "",
    });
    setShowDialog(true);
  };

  const toggleStatus = async (medico: Medico) => {
    try {
      const { error } = await supabase
        .from("medicos")
        .update({ ativo: !medico.ativo })
        .eq("id", medico.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Médico ${!medico.ativo ? "ativado" : "desativado"} com sucesso!`,
      });

      loadMedicos();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status do médico",
        variant: "destructive",
      });
    }
  };

  const handleExcelImport = async (data: any[]) => {
    try {
      const medicosData = data.map(row => ({
        nome: row.nome || row.Nome,
        numero_whatsapp: row.numero_whatsapp || row.WhatsApp || row.whatsapp,
        especialidade: row.especialidade || row.Especialidade || ""
      }));

      const { error } = await supabase
        .from("medicos")
        .insert(medicosData);

      if (error) throw error;

      setShowImportDialog(false);
      await loadMedicos();
    } catch (error) {
      console.error("Erro ao importar médicos:", error);
      throw error;
    }
  };

  const getTemplateData = () => [
    {
      nome: "Dr. João Silva",
      numero_whatsapp: "5511999999999",
      especialidade: "Cardiologia"
    },
    {
      nome: "Dra. Maria Santos",
      numero_whatsapp: "5511888888888", 
      especialidade: "Pediatria"
    }
  ];

  const filteredMedicos = medicos.filter((medico) =>
    medico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medico.especialidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Médicos</h1>
            <p className="text-muted-foreground">
              Gerenciar cadastro de médicos do hospital
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Médicos via Excel</DialogTitle>
                </DialogHeader>
                <ExcelImport
                  onImport={handleExcelImport}
                  templateData={getTemplateData()}
                  templateFilename="modelo-medicos.xlsx"
                  expectedColumns={["nome", "numero_whatsapp"]}
                  title="Importação de Médicos"
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingMedico(null);
                  setFormData({ nome: "", numero_whatsapp: "", especialidade: "" });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Médico
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMedico ? "Editar Médico" : "Novo Médico"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_whatsapp">Número WhatsApp</Label>
                  <Input
                    id="numero_whatsapp"
                    value={formData.numero_whatsapp}
                    onChange={(e) => setFormData({ ...formData, numero_whatsapp: e.target.value })}
                    placeholder="5511999999999"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingMedico ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Buscar médicos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicos.map((medico) => (
                  <TableRow key={medico.id}>
                    <TableCell className="font-medium">{medico.nome}</TableCell>
                    <TableCell>{medico.numero_whatsapp}</TableCell>
                    <TableCell>{medico.especialidade || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={medico.ativo ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(medico)}
                      >
                        {medico.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(medico)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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