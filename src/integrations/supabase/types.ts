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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          avatar_color: string | null
          created_at: string | null
          credits_spent: number | null
          id: string
          is_active: boolean | null
          messages_count: number | null
          model: string | null
          name: string
          position_x: number | null
          position_y: number | null
          role: string
          specialty: string | null
          status: string | null
          system_prompt: string | null
          tasks_completed: number | null
          workspace_id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string | null
          credits_spent?: number | null
          id?: string
          is_active?: boolean | null
          messages_count?: number | null
          model?: string | null
          name: string
          position_x?: number | null
          position_y?: number | null
          role: string
          specialty?: string | null
          status?: string | null
          system_prompt?: string | null
          tasks_completed?: number | null
          workspace_id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string | null
          credits_spent?: number | null
          id?: string
          is_active?: boolean | null
          messages_count?: number | null
          model?: string | null
          name?: string
          position_x?: number | null
          position_y?: number | null
          role?: string
          specialty?: string | null
          status?: string | null
          system_prompt?: string | null
          tasks_completed?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          balance: number | null
          id: string
          reserved: number | null
          total_consumed: number | null
          total_purchased: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          balance?: number | null
          id?: string
          reserved?: number | null
          total_consumed?: number | null
          total_purchased?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          balance?: number | null
          id?: string
          reserved?: number | null
          total_consumed?: number | null
          total_purchased?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      event_logs: {
        Row: {
          actor: string
          created_at: string | null
          description: string
          event_type: string
          id: string
          metadata: Json | null
          target: string | null
          workspace_id: string
        }
        Insert: {
          actor: string
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          target?: string | null
          workspace_id: string
        }
        Update: {
          actor?: string
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          connected_at: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          type: string
          workspace_id: string
        }
        Insert: {
          config?: Json | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          type: string
          workspace_id: string
        }
        Update: {
          config?: Json | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          participants: string[] | null
          started_at: string | null
          status: string | null
          summary: string | null
          title: string
          transcript: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          participants?: string[] | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          title: string
          transcript?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          participants?: string[] | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          title?: string
          transcript?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          credits_used: number | null
          from_agent_id: string | null
          id: string
          meeting_id: string | null
          to_agent_id: string | null
          tokens_used: number | null
          type: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          credits_used?: number | null
          from_agent_id?: string | null
          id?: string
          meeting_id?: string | null
          to_agent_id?: string | null
          tokens_used?: number | null
          type: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          credits_used?: number | null
          from_agent_id?: string | null
          id?: string
          meeting_id?: string | null
          to_agent_id?: string | null
          tokens_used?: number | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          agent_id: string | null
          created_at: string | null
          cron_expression: string | null
          description: string | null
          frequency: string
          id: string
          instruction: string
          is_active: boolean | null
          last_run: string | null
          name: string
          next_run: string | null
          run_count: number | null
          scheduled_days: string[] | null
          scheduled_time: string | null
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          frequency: string
          id?: string
          instruction: string
          is_active?: boolean | null
          last_run?: string | null
          name: string
          next_run?: string | null
          run_count?: number | null
          scheduled_days?: string[] | null
          scheduled_time?: string | null
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          frequency?: string
          id?: string
          instruction?: string
          is_active?: boolean | null
          last_run?: string | null
          name?: string
          next_run?: string | null
          run_count?: number | null
          scheduled_days?: string[] | null
          scheduled_time?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agent_id: string | null
          amount: number
          created_at: string | null
          description: string | null
          id: string
          model: string | null
          tokens_input: number | null
          tokens_output: number | null
          type: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          model?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          type: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          model?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          additional_notes: string | null
          created_at: string | null
          culture: string | null
          id: string
          mission: string | null
          name: string
          plan: string | null
          products: string | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string | null
          culture?: string | null
          id?: string
          mission?: string | null
          name: string
          plan?: string | null
          products?: string | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          created_at?: string | null
          culture?: string | null
          id?: string
          mission?: string | null
          name?: string
          plan?: string | null
          products?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_owner: { Args: { _workspace_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
