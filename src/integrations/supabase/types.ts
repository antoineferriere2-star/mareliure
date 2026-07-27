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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      build_dossiers: {
        Row: {
          ai_analyzed_at: string | null
          ai_insights: Json | null
          assigned_to_user_id: string | null
          commercial_notes: string | null
          commercial_status: string
          content: Json
          created_at: string
          id: string
          last_activity_at: string
          mission_id: string | null
          next_questions: Json
          session_id: string | null
          status: string
          summary: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_insights?: Json | null
          assigned_to_user_id?: string | null
          commercial_notes?: string | null
          commercial_status?: string
          content?: Json
          created_at?: string
          id?: string
          last_activity_at?: string
          mission_id?: string | null
          next_questions?: Json
          session_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_insights?: Json | null
          assigned_to_user_id?: string | null
          commercial_notes?: string | null
          commercial_status?: string
          content?: Json
          created_at?: string
          id?: string
          last_activity_at?: string
          mission_id?: string | null
          next_questions?: Json
          session_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_dossiers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "build_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_dossiers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "build_runtime_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_dossiers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_knowledge_notes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          status: string
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      build_missions: {
        Row: {
          audience: Json
          created_at: string
          id: string
          name: string
          objective: string | null
          playbook_id: string | null
          playbook_name: string | null
          playbook_version_id: string | null
          project: Json
          proposal: Json | null
          public_token: string | null
          public_token_revoked_at: string | null
          published_at: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          audience?: Json
          created_at?: string
          id?: string
          name: string
          objective?: string | null
          playbook_id?: string | null
          playbook_name?: string | null
          playbook_version_id?: string | null
          project?: Json
          proposal?: Json | null
          public_token?: string | null
          public_token_revoked_at?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          audience?: Json
          created_at?: string
          id?: string
          name?: string
          objective?: string | null
          playbook_id?: string | null
          playbook_name?: string | null
          playbook_version_id?: string | null
          project?: Json
          proposal?: Json | null
          public_token?: string | null
          public_token_revoked_at?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_missions_playbook_version_id_fkey"
            columns: ["playbook_version_id"]
            isOneToOne: false
            referencedRelation: "build_playbook_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_missions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_playbook_versions: {
        Row: {
          created_at: string
          id: string
          playbook_id: string
          published_at: string
          published_by: string | null
          schema: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          playbook_id: string
          published_at?: string
          published_by?: string | null
          schema: Json
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          playbook_id?: string
          published_at?: string
          published_by?: string | null
          schema?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "build_playbook_versions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "build_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      build_playbooks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          draft_schema: Json
          id: string
          is_active: boolean
          name: string
          project_type: string | null
          published_version_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_schema?: Json
          id?: string
          is_active?: boolean
          name: string
          project_type?: string | null
          published_version_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_schema?: Json
          id?: string
          is_active?: boolean
          name?: string
          project_type?: string | null
          published_version_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_playbooks_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "build_playbook_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_public_request_rate: {
        Row: {
          created_at: string
          ip_hash: string
          request_type: Database["public"]["Enums"]["build_public_request_type"]
        }
        Insert: {
          created_at?: string
          ip_hash: string
          request_type: Database["public"]["Enums"]["build_public_request_type"]
        }
        Update: {
          created_at?: string
          ip_hash?: string
          request_type?: Database["public"]["Enums"]["build_public_request_type"]
        }
        Relationships: []
      }
      build_public_requests: {
        Row: {
          audit_analyzed_at: string | null
          audit_result: Json | null
          consent: boolean
          created_at: string
          id: string
          ip_hash: string | null
          payload: Json
          request_type: Database["public"]["Enums"]["build_public_request_type"]
          source_path: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          audit_analyzed_at?: string | null
          audit_result?: Json | null
          consent?: boolean
          created_at?: string
          id?: string
          ip_hash?: string | null
          payload: Json
          request_type: Database["public"]["Enums"]["build_public_request_type"]
          source_path: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          audit_analyzed_at?: string | null
          audit_result?: Json | null
          consent?: boolean
          created_at?: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          request_type?: Database["public"]["Enums"]["build_public_request_type"]
          source_path?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      build_runtime_rate: {
        Row: {
          action: string
          created_at: string
          ip_hash: string
        }
        Insert: {
          action: string
          created_at?: string
          ip_hash: string
        }
        Update: {
          action?: string
          created_at?: string
          ip_hash?: string
        }
        Relationships: []
      }
      build_runtime_sessions: {
        Row: {
          answers: Json
          created_at: string
          id: string
          ip_hash: string | null
          mission_id: string
          session_secret_hash: string
          status: string
          submitted_at: string | null
          updated_at: string
          visitor_hash: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          ip_hash?: string | null
          mission_id: string
          session_secret_hash: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visitor_hash?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          ip_hash?: string | null
          mission_id?: string
          session_secret_hash?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_runtime_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "build_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      build_workspace_ai_runs: {
        Row: {
          action: string
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          request_id: string | null
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          request_id?: string | null
          status: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          request_id?: string | null
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_workspace_ai_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_workspace_members: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_workspace_onboarding: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          branding: Json
          confirmed_business_type: string | null
          confirmed_product: string | null
          created_at: string
          created_by: string
          draft_version: number
          final_url: string | null
          id: string
          last_analyze_request_id: string | null
          last_generate_request_id: string | null
          mission_id: string | null
          playbook_id: string | null
          site_url: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          branding?: Json
          confirmed_business_type?: string | null
          confirmed_product?: string | null
          created_at?: string
          created_by: string
          draft_version?: number
          final_url?: string | null
          id?: string
          last_analyze_request_id?: string | null
          last_generate_request_id?: string | null
          mission_id?: string | null
          playbook_id?: string | null
          site_url?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          branding?: Json
          confirmed_business_type?: string | null
          confirmed_product?: string | null
          created_at?: string
          created_by?: string
          draft_version?: number
          final_url?: string | null
          id?: string
          last_analyze_request_id?: string | null
          last_generate_request_id?: string | null
          mission_id?: string | null
          playbook_id?: string | null
          site_url?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_workspace_onboarding_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "build_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_workspace_onboarding_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "build_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_workspace_onboarding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "build_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      build_workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          max_active_missions: number
          monthly_brief_quota: number
          name: string
          plan: string
          provisioned_for_user_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_active_missions?: number
          monthly_brief_quota?: number
          name: string
          plan?: string
          provisioned_for_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_active_missions?: number
          monthly_brief_quota?: number
          name?: string
          plan?: string
          provisioned_for_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      provision_owner_workspace: {
        Args: { _email: string; _user_id: string; _workspace_name: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      build_public_request_type: "audit" | "private_beta"
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
      app_role: ["admin", "user"],
      build_public_request_type: ["audit", "private_beta"],
    },
  },
} as const
