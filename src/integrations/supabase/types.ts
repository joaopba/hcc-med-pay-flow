export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          medico_id: string
          message: string
          read: boolean
          sender_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medico_id: string
          message: string
          read?: boolean
          sender_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medico_id?: string
          message?: string
          read?: boolean
          sender_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tickets: {
        Row: {
          closed_at: string | null
          created_at: string
          feedback_text: string | null
          gestor_id: string | null
          id: string
          medico_id: string
          opened_at: string
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          feedback_text?: string | null
          gestor_id?: string | null
          id?: string
          medico_id: string
          opened_at?: string
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          feedback_text?: string | null
          gestor_id?: string | null
          id?: string
          medico_id?: string
          opened_at?: string
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tickets_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tickets_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          api_url: string
          auth_token: string
          created_at: string
          email_notificacoes: boolean
          id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_url?: string
          auth_token: string
          created_at?: string
          email_notificacoes?: boolean
          id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_url?: string
          auth_token?: string
          created_at?: string
          email_notificacoes?: boolean
          id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      disparos_notas: {
        Row: {
          created_at: string
          id: string
          numero: string
          pagamento_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero: string
          pagamento_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          numero?: string
          pagamento_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      medicos: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          especialidade: string | null
          id: string
          nome: string
          numero_whatsapp: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          especialidade?: string | null
          id?: string
          nome: string
          numero_whatsapp: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          especialidade?: string | null
          id?: string
          nome?: string
          numero_whatsapp?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_locks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          numero: string
          tipo: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          numero: string
          tipo: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          numero?: string
          tipo?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          created_at: string
          id: string
          pagamento_id: string
          payload: Json
          response: Json | null
          success: boolean
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          pagamento_id: string
          payload: Json
          response?: Json | null
          success?: boolean
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          pagamento_id?: string
          payload?: Json
          response?: Json | null
          success?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_medicos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          medico_id: string
          nome_arquivo: string
          observacoes: string | null
          pagamento_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          medico_id: string
          nome_arquivo: string
          observacoes?: string | null
          pagamento_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          medico_id?: string
          nome_arquivo?: string
          observacoes?: string | null
          pagamento_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_medicos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_medicos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: true
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          data_resposta: string | null
          data_solicitacao: string | null
          id: string
          medico_id: string
          mes_competencia: string
          nota_pdf_url: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_resposta?: string | null
          data_solicitacao?: string | null
          id?: string
          medico_id: string
          mes_competencia: string
          nota_pdf_url?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_resposta?: string | null
          data_solicitacao?: string | null
          id?: string
          medico_id?: string
          mes_competencia?: string
          nota_pdf_url?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          numero_whatsapp: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          whatsapp_notifications_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          numero_whatsapp?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          whatsapp_notifications_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          numero_whatsapp?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          whatsapp_notifications_enabled?: boolean | null
        }
        Relationships: []
      }
      webhook_debug_logs: {
        Row: {
          content_type: string | null
          created_at: string
          headers: Json | null
          id: string
          method: string
          parsed_body: Json | null
          query_params: Json | null
          raw_body: string | null
          timestamp: string
          url: string
          user_agent: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          method: string
          parsed_body?: Json | null
          query_params?: Json | null
          raw_body?: string | null
          timestamp?: string
          url: string
          user_agent?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          method?: string
          parsed_body?: Json | null
          query_params?: Json | null
          raw_body?: string | null
          timestamp?: string
          url?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          created_at: string | null
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          max_tentativas: number | null
          numero_destino: string
          payload: Json
          prioridade: number | null
          proximo_envio: string | null
          status: string | null
          tentativas: number | null
          tipo_mensagem: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          max_tentativas?: number | null
          numero_destino: string
          payload: Json
          prioridade?: number | null
          proximo_envio?: string | null
          status?: string | null
          tentativas?: number | null
          tipo_mensagem: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          max_tentativas?: number | null
          numero_destino?: string
          payload?: Json
          prioridade?: number | null
          proximo_envio?: string | null
          status?: string | null
          tentativas?: number | null
          tipo_mensagem?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_rate_limit: {
        Row: {
          created_at: string | null
          id: string
          janela_tempo: string
          limite_por_janela: number | null
          mensagens_enviadas: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          janela_tempo: string
          limite_por_janela?: number | null
          mensagens_enviadas?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          janela_tempo?: string
          limite_por_janela?: number | null
          mensagens_enviadas?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_whatsapp_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_old_whatsapp_queue: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      increment_whatsapp_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_gestor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_manager: {
        Args: { user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      payment_status:
        | "pendente"
        | "solicitado"
        | "nota_recebida"
        | "pago"
        | "aprovado"
        | "nota_rejeitada"
      user_role: "gestor" | "usuario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: [
        "pendente",
        "solicitado",
        "nota_recebida",
        "pago",
        "aprovado",
        "nota_rejeitada",
      ],
      user_role: ["gestor", "usuario"],
    },
  },
} as const
