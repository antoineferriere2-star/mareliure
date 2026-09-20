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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      build_dossier_access_tokens: {
        Row: {
          created_at: string
          dossier_id: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_dossier_access_tokens_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "build_dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
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
          playbook_version_id: string | null
          session_id: string | null
          status: string
          summary: string | null
          updated_at: string
          visitor_email: string | null
          visitor_email_sent_at: string | null
          visitor_name: string | null
          visitor_summary: Json | null
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
          playbook_version_id?: string | null
          session_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          visitor_email?: string | null
          visitor_email_sent_at?: string | null
          visitor_name?: string | null
          visitor_summary?: Json | null
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
          playbook_version_id?: string | null
          session_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          visitor_email?: string | null
          visitor_email_sent_at?: string | null
          visitor_name?: string | null
          visitor_summary?: Json | null
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
            foreignKeyName: "build_dossiers_playbook_version_id_fkey"
            columns: ["playbook_version_id"]
            isOneToOne: false
            referencedRelation: "build_playbook_versions"
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
          branding: Json
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
          source_onboarding_id: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          audience?: Json
          branding?: Json
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
          source_onboarding_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          audience?: Json
          branding?: Json
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
          source_onboarding_id?: string | null
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
            foreignKeyName: "build_missions_source_onboarding_id_fkey"
            columns: ["source_onboarding_id"]
            isOneToOne: false
            referencedRelation: "build_workspace_onboarding"
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
      build_page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          is_new_session: boolean
          locale: string | null
          path: string
          referrer_host: string | null
          session_hash: string | null
          visitor_hash: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          is_new_session?: boolean
          locale?: string | null
          path: string
          referrer_host?: string | null
          session_hash?: string | null
          visitor_hash?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          is_new_session?: boolean
          locale?: string | null
          path?: string
          referrer_host?: string | null
          session_hash?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
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
      build_public_site_analyses: {
        Row: {
          created_at: string
          error: string | null
          id: string
          ip_hash: string
          request_id: string
          result: Json | null
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          ip_hash: string
          request_id: string
          result?: Json | null
          status: string
          url: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          ip_hash?: string
          request_id?: string
          result?: Json | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      build_runtime_rate: {
        Row: {
          action: string
          created_at: string
          ip_hash: string
          session_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          ip_hash: string
          session_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          ip_hash?: string
          session_id?: string | null
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
          prospect_campaign_id: string | null
          prospect_company_name: string | null
          prospect_last_error: string | null
          prospect_last_error_at: string | null
          prospect_last_step: string | null
          prospect_request_id: string | null
          prospect_status: string
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
          prospect_campaign_id?: string | null
          prospect_company_name?: string | null
          prospect_last_error?: string | null
          prospect_last_error_at?: string | null
          prospect_last_step?: string | null
          prospect_request_id?: string | null
          prospect_status?: string
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
          prospect_campaign_id?: string | null
          prospect_company_name?: string | null
          prospect_last_error?: string | null
          prospect_last_error_at?: string | null
          prospect_last_step?: string | null
          prospect_request_id?: string | null
          prospect_status?: string
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
            isOneToOne: false
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
          notify_on_new_brief: string
          plan: string
          provisioned_for_user_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_active_missions?: number
          monthly_brief_quota?: number
          name: string
          notify_on_new_brief?: string
          plan?: string
          provisioned_for_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_active_missions?: number
          monthly_brief_quota?: number
          name?: string
          notify_on_new_brief?: string
          plan?: string
          provisioned_for_user_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          workspace_type?: string
        }
        Relationships: []
      }
      marketplace_binder_applications: {
        Row: {
          average_annual_revenue_band: string | null
          city: string | null
          converted_binder_id: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          legal_entity_type: string | null
          message: string | null
          phone: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          skills: string[]
          status: string
          website_url: string | null
          workshop_name: string
          years_experience: number | null
        }
        Insert: {
          average_annual_revenue_band?: string | null
          city?: string | null
          converted_binder_id?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          legal_entity_type?: string | null
          message?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skills?: string[]
          status?: string
          website_url?: string | null
          workshop_name: string
          years_experience?: number | null
        }
        Update: {
          average_annual_revenue_band?: string | null
          city?: string | null
          converted_binder_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          legal_entity_type?: string | null
          message?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skills?: string[]
          status?: string
          website_url?: string | null
          workshop_name?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_applications_converted_binder_id_fkey"
            columns: ["converted_binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_billing_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          binder_id: string
          city: string | null
          country: string
          created_at: string
          default_vat_rate_bps: number
          email: string | null
          invoice_notes: string | null
          invoice_prefix: string
          legal_name: string | null
          legal_notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          quote_notes: string | null
          quote_prefix: string
          quote_validity_days: number
          siret: string | null
          updated_at: string
          vat_mention: string | null
          vat_number: string | null
          vat_regime: string | null
          workshop_name: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          binder_id: string
          city?: string | null
          country?: string
          created_at?: string
          default_vat_rate_bps?: number
          email?: string | null
          invoice_notes?: string | null
          invoice_prefix?: string
          legal_name?: string | null
          legal_notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          quote_notes?: string | null
          quote_prefix?: string
          quote_validity_days?: number
          siret?: string | null
          updated_at?: string
          vat_mention?: string | null
          vat_number?: string | null
          vat_regime?: string | null
          workshop_name?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          binder_id?: string
          city?: string | null
          country?: string
          created_at?: string
          default_vat_rate_bps?: number
          email?: string | null
          invoice_notes?: string | null
          invoice_prefix?: string
          legal_name?: string | null
          legal_notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          quote_notes?: string | null
          quote_prefix?: string
          quote_validity_days?: number
          siret?: string | null
          updated_at?: string
          vat_mention?: string | null
          vat_number?: string | null
          vat_regime?: string | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_billing_profiles_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: true
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_clients: {
        Row: {
          address_line1: string | null
          archived_at: string | null
          binder_id: string
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          name: string
          notes: string | null
          organization: string | null
          origin: string
          origin_case_id: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          archived_at?: string | null
          binder_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          origin?: string
          origin_case_id?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          archived_at?: string | null
          binder_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          origin?: string
          origin_case_id?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_clients_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_clients_origin_case_id_fkey"
            columns: ["origin_case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_commercial_terms: {
        Row: {
          binder_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          family_key: string
          id: string
          manual_payout_required: boolean
          payout_multiplier_bps: number
        }
        Insert: {
          binder_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          family_key: string
          id?: string
          manual_payout_required?: boolean
          payout_multiplier_bps?: number
        }
        Update: {
          binder_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          family_key?: string
          id?: string
          manual_payout_required?: boolean
          payout_multiplier_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_commercial_terms_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_document_counters: {
        Row: {
          binder_id: string
          kind: string
          last_value: number
          year: number
        }
        Insert: {
          binder_id: string
          kind: string
          last_value?: number
          year: number
        }
        Update: {
          binder_id?: string
          kind?: string
          last_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_document_counters_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          binder_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          binder_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          binder_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_invitations_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_invoice_items: {
        Row: {
          binder_id: string
          description: string | null
          id: string
          invoice_id: string
          label: string
          position: number
          quantity: number
          service_id: string | null
          total_ht_cents: number
          unit: string | null
          unit_price_cents: number
          vat_rate_bps: number
        }
        Insert: {
          binder_id: string
          description?: string | null
          id?: string
          invoice_id: string
          label: string
          position: number
          quantity?: number
          service_id?: string | null
          total_ht_cents: number
          unit?: string | null
          unit_price_cents: number
          vat_rate_bps: number
        }
        Update: {
          binder_id?: string
          description?: string | null
          id?: string
          invoice_id?: string
          label?: string
          position?: number
          quantity?: number
          service_id?: string | null
          total_ht_cents?: number
          unit?: string | null
          unit_price_cents?: number
          vat_rate_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_invoice_items_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_services"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_invoices: {
        Row: {
          amount_paid_cents: number
          binder_id: string
          book_author: string | null
          book_notes: string | null
          book_title: string | null
          client_address_line1: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          client_postal_code: string | null
          created_at: string
          currency: string
          deposit_cents: number
          deposit_paid_cents: number
          deposit_type: string
          deposit_value: number
          discount_cents: number
          discount_type: string
          discount_value: number
          electronic_invoice_sent_at: string | null
          electronic_invoice_status: string | null
          external_invoice_id: string | null
          external_metadata: Json | null
          external_provider: string | null
          external_status: string | null
          height_mm: number | null
          id: string
          invoice_number: string
          issue_date: string
          issuer: Json
          notes: string | null
          paid_at: string | null
          payment_status: string
          payment_terms: string | null
          quote_id: string
          spine_mm: number | null
          subtotal_cents: number
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
          updated_at: string
          vat_breakdown: Json
          vat_mention: string | null
          vat_regime: string
          width_mm: number | null
        }
        Insert: {
          amount_paid_cents?: number
          binder_id: string
          book_author?: string | null
          book_notes?: string | null
          book_title?: string | null
          client_address_line1?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          client_postal_code?: string | null
          created_at?: string
          currency?: string
          deposit_cents?: number
          deposit_paid_cents?: number
          deposit_type?: string
          deposit_value?: number
          discount_cents?: number
          discount_type?: string
          discount_value?: number
          electronic_invoice_sent_at?: string | null
          electronic_invoice_status?: string | null
          external_invoice_id?: string | null
          external_metadata?: Json | null
          external_provider?: string | null
          external_status?: string | null
          height_mm?: number | null
          id?: string
          invoice_number: string
          issue_date: string
          issuer?: Json
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          payment_terms?: string | null
          quote_id: string
          spine_mm?: number | null
          subtotal_cents: number
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
          updated_at?: string
          vat_breakdown?: Json
          vat_mention?: string | null
          vat_regime: string
          width_mm?: number | null
        }
        Update: {
          amount_paid_cents?: number
          binder_id?: string
          book_author?: string | null
          book_notes?: string | null
          book_title?: string | null
          client_address_line1?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          client_postal_code?: string | null
          created_at?: string
          currency?: string
          deposit_cents?: number
          deposit_paid_cents?: number
          deposit_type?: string
          deposit_value?: number
          discount_cents?: number
          discount_type?: string
          discount_value?: number
          electronic_invoice_sent_at?: string | null
          electronic_invoice_status?: string | null
          external_invoice_id?: string | null
          external_metadata?: Json | null
          external_provider?: string | null
          external_status?: string | null
          height_mm?: number | null
          id?: string
          invoice_number?: string
          issue_date?: string
          issuer?: Json
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          payment_terms?: string | null
          quote_id?: string
          spine_mm?: number | null
          subtotal_cents?: number
          total_ht_cents?: number
          total_ttc_cents?: number
          total_vat_cents?: number
          updated_at?: string
          vat_breakdown?: Json
          vat_mention?: string | null
          vat_regime?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_invoices_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "marketplace_binder_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_members: {
        Row: {
          account_status: string
          binder_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          binder_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          binder_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_members_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_portfolio: {
        Row: {
          after_photo_path: string | null
          before_photo_path: string | null
          binder_id: string
          created_at: string
          description: string | null
          id: string
          materials: string[]
          position: number
          techniques: string[]
          title: string
          year: number | null
        }
        Insert: {
          after_photo_path?: string | null
          before_photo_path?: string | null
          binder_id: string
          created_at?: string
          description?: string | null
          id?: string
          materials?: string[]
          position?: number
          techniques?: string[]
          title: string
          year?: number | null
        }
        Update: {
          after_photo_path?: string | null
          before_photo_path?: string | null
          binder_id?: string
          created_at?: string
          description?: string | null
          id?: string
          materials?: string[]
          position?: number
          techniques?: string[]
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_portfolio_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_quote_items: {
        Row: {
          binder_id: string
          catalog_price_cents: number | null
          description: string | null
          id: string
          label: string
          position: number
          quantity: number
          quote_id: string
          service_id: string | null
          total_ht_cents: number
          unit: string | null
          unit_price_cents: number
          vat_rate_bps: number
        }
        Insert: {
          binder_id: string
          catalog_price_cents?: number | null
          description?: string | null
          id?: string
          label: string
          position: number
          quantity?: number
          quote_id: string
          service_id?: string | null
          total_ht_cents: number
          unit?: string | null
          unit_price_cents: number
          vat_rate_bps: number
        }
        Update: {
          binder_id?: string
          catalog_price_cents?: number | null
          description?: string | null
          id?: string
          label?: string
          position?: number
          quantity?: number
          quote_id?: string
          service_id?: string | null
          total_ht_cents?: number
          unit?: string | null
          unit_price_cents?: number
          vat_rate_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_quote_items_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_quote_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_services"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_quotes: {
        Row: {
          binder_id: string
          book_author: string | null
          book_notes: string | null
          book_title: string | null
          client_address_line1: string | null
          client_city: string | null
          client_country: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          client_postal_code: string | null
          created_at: string
          currency: string
          deposit_cents: number
          deposit_type: string
          deposit_value: number
          discount_cents: number
          discount_type: string
          discount_value: number
          height_mm: number | null
          id: string
          issue_date: string
          issuer: Json
          notes: string | null
          payment_terms: string | null
          quote_number: string
          spine_mm: number | null
          status: string
          subtotal_cents: number
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
          updated_at: string
          valid_until: string
          vat_breakdown: Json
          vat_mention: string | null
          vat_regime: string
          width_mm: number | null
          work_id: string | null
        }
        Insert: {
          binder_id: string
          book_author?: string | null
          book_notes?: string | null
          book_title?: string | null
          client_address_line1?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          client_postal_code?: string | null
          created_at?: string
          currency?: string
          deposit_cents?: number
          deposit_type?: string
          deposit_value?: number
          discount_cents?: number
          discount_type?: string
          discount_value?: number
          height_mm?: number | null
          id?: string
          issue_date: string
          issuer?: Json
          notes?: string | null
          payment_terms?: string | null
          quote_number: string
          spine_mm?: number | null
          status?: string
          subtotal_cents: number
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
          updated_at?: string
          valid_until: string
          vat_breakdown?: Json
          vat_mention?: string | null
          vat_regime: string
          width_mm?: number | null
          work_id?: string | null
        }
        Update: {
          binder_id?: string
          book_author?: string | null
          book_notes?: string | null
          book_title?: string | null
          client_address_line1?: string | null
          client_city?: string | null
          client_country?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          client_postal_code?: string | null
          created_at?: string
          currency?: string
          deposit_cents?: number
          deposit_type?: string
          deposit_value?: number
          discount_cents?: number
          discount_type?: string
          discount_value?: number
          height_mm?: number | null
          id?: string
          issue_date?: string
          issuer?: Json
          notes?: string | null
          payment_terms?: string | null
          quote_number?: string
          spine_mm?: number | null
          status?: string
          subtotal_cents?: number
          total_ht_cents?: number
          total_ttc_cents?: number
          total_vat_cents?: number
          updated_at?: string
          valid_until?: string
          vat_breakdown?: Json
          vat_mention?: string | null
          vat_regime?: string
          width_mm?: number | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_quotes_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_quotes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_works"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_rates: {
        Row: {
          binder_id: string
          complexity_class: string
          created_at: string
          created_by: string | null
          effective_from: string
          estimated_hours: number | null
          id: string
          maximum_payout_cents: number
          minimum_payout_cents: number
          notes: string | null
          provenance: string
          size_class: string
          source: string
          status: string
          typical_payout_cents: number
          verified_at: string | null
          verified_by: string | null
          work_item_key: string
        }
        Insert: {
          binder_id: string
          complexity_class?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          estimated_hours?: number | null
          id?: string
          maximum_payout_cents: number
          minimum_payout_cents: number
          notes?: string | null
          provenance: string
          size_class?: string
          source: string
          status?: string
          typical_payout_cents: number
          verified_at?: string | null
          verified_by?: string | null
          work_item_key: string
        }
        Update: {
          binder_id?: string
          complexity_class?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          estimated_hours?: number | null
          id?: string
          maximum_payout_cents?: number
          minimum_payout_cents?: number
          notes?: string | null
          provenance?: string
          size_class?: string
          source?: string
          status?: string
          typical_payout_cents?: number
          verified_at?: string | null
          verified_by?: string | null
          work_item_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_rates_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_rates_work_item_key_fkey"
            columns: ["work_item_key"]
            isOneToOne: false
            referencedRelation: "marketplace_work_items"
            referencedColumns: ["key"]
          },
        ]
      }
      marketplace_binder_service_categories: {
        Row: {
          binder_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          binder_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          binder_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_service_categories_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_services: {
        Row: {
          archived_at: string | null
          binder_id: string
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          unit: string | null
          unit_price_cents: number
          updated_at: string
          vat_rate_bps: number | null
        }
        Insert: {
          archived_at?: string | null
          binder_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          unit?: string | null
          unit_price_cents?: number
          updated_at?: string
          vat_rate_bps?: number | null
        }
        Update: {
          archived_at?: string | null
          binder_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          unit?: string | null
          unit_price_cents?: number
          updated_at?: string
          vat_rate_bps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_services_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_skills: {
        Row: {
          binder_id: string
          skill_slug: string
        }
        Insert: {
          binder_id: string
          skill_slug: string
        }
        Update: {
          binder_id?: string
          skill_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_skills_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_work_counters: {
        Row: {
          binder_id: string
          last_value: number
          year: number
        }
        Insert: {
          binder_id: string
          last_value?: number
          year: number
        }
        Update: {
          binder_id?: string
          last_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_work_counters_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_work_photos: {
        Row: {
          binder_id: string
          caption: string | null
          created_at: string
          id: string
          stage: string
          storage_path: string
          work_id: string
        }
        Insert: {
          binder_id: string
          caption?: string | null
          created_at?: string
          id?: string
          stage: string
          storage_path: string
          work_id: string
        }
        Update: {
          binder_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          stage?: string
          storage_path?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_work_photos_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_work_photos_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_works"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binder_works: {
        Row: {
          author: string | null
          binder_id: string
          case_id: string | null
          condition_notes: string | null
          contact_id: string | null
          created_at: string
          declared_value_cents: number | null
          description: string | null
          edition_note: string | null
          height_mm: number | null
          id: string
          internal_notes: string | null
          reference: string
          source: string
          status: string
          thickness_mm: number | null
          title: string
          updated_at: string
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          author?: string | null
          binder_id: string
          case_id?: string | null
          condition_notes?: string | null
          contact_id?: string | null
          created_at?: string
          declared_value_cents?: number | null
          description?: string | null
          edition_note?: string | null
          height_mm?: number | null
          id?: string
          internal_notes?: string | null
          reference: string
          source?: string
          status?: string
          thickness_mm?: number | null
          title: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          author?: string | null
          binder_id?: string
          case_id?: string | null
          condition_notes?: string | null
          contact_id?: string | null
          created_at?: string
          declared_value_cents?: number | null
          description?: string | null
          edition_note?: string | null
          height_mm?: number | null
          id?: string
          internal_notes?: string | null
          reference?: string
          source?: string
          status?: string
          thickness_mm?: number | null
          title?: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_binder_works_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_works_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_binder_works_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binder_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_binders: {
        Row: {
          accepted_project_types: string[]
          avatar_path: string | null
          bio: string | null
          capacity_slots: number
          city: string | null
          created_at: string
          display_name: string
          id: string
          is_demo: boolean
          max_project_cents: number | null
          min_project_cents: number | null
          personal_referral_slug: string | null
          postal_code: string | null
          rating_avg: number | null
          rating_count: number
          response_rate: number | null
          status: string
          stripe_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_onboarded_at: string | null
          stripe_connect_payouts_enabled: boolean
          training: string | null
          updated_at: string
          user_id: string | null
          workshop_name: string | null
          years_experience: number | null
        }
        Insert: {
          accepted_project_types?: string[]
          avatar_path?: string | null
          bio?: string | null
          capacity_slots?: number
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_demo?: boolean
          max_project_cents?: number | null
          min_project_cents?: number | null
          personal_referral_slug?: string | null
          postal_code?: string | null
          rating_avg?: number | null
          rating_count?: number
          response_rate?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded_at?: string | null
          stripe_connect_payouts_enabled?: boolean
          training?: string | null
          updated_at?: string
          user_id?: string | null
          workshop_name?: string | null
          years_experience?: number | null
        }
        Update: {
          accepted_project_types?: string[]
          avatar_path?: string | null
          bio?: string | null
          capacity_slots?: number
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_demo?: boolean
          max_project_cents?: number | null
          min_project_cents?: number | null
          personal_referral_slug?: string | null
          postal_code?: string | null
          rating_avg?: number | null
          rating_count?: number
          response_rate?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded_at?: string | null
          stripe_connect_payouts_enabled?: boolean
          training?: string | null
          updated_at?: string
          user_id?: string | null
          workshop_name?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      marketplace_case_matches: {
        Row: {
          accepted_at: string | null
          binder_id: string
          binder_payout_cents: number | null
          case_id: string
          currency: string
          decline_reason: string | null
          decline_reason_code: string | null
          decline_reason_detail: string | null
          declined_at: string | null
          expires_at: string | null
          id: string
          invited_at: string
          match_score: number | null
          minimum_required_payout_cents: number | null
          offered_at: string | null
          responded_at: string | null
          selected_at: string | null
          state: string
        }
        Insert: {
          accepted_at?: string | null
          binder_id: string
          binder_payout_cents?: number | null
          case_id: string
          currency?: string
          decline_reason?: string | null
          decline_reason_code?: string | null
          decline_reason_detail?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invited_at?: string
          match_score?: number | null
          minimum_required_payout_cents?: number | null
          offered_at?: string | null
          responded_at?: string | null
          selected_at?: string | null
          state?: string
        }
        Update: {
          accepted_at?: string | null
          binder_id?: string
          binder_payout_cents?: number | null
          case_id?: string
          currency?: string
          decline_reason?: string | null
          decline_reason_code?: string | null
          decline_reason_detail?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invited_at?: string
          match_score?: number | null
          minimum_required_payout_cents?: number | null
          offered_at?: string | null
          responded_at?: string | null
          selected_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_case_matches_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_case_matches_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cases: {
        Row: {
          acquisition_origin: string
          admin_notes: string | null
          base_service_price_cents: number | null
          binder_payout_cents: number | null
          brand: string
          brand_multiplier_bps: number | null
          claim_method: string | null
          claimed_at: string | null
          created_at: string
          customer_price_cents: number | null
          customer_user_id: string | null
          declared_value_band: string | null
          deposit_cents: number | null
          dossier_id: string
          heritage_flag: boolean
          id: string
          manual_review_required: boolean
          mission_id: string | null
          price_includes: string[]
          pricing_components: Json
          pricing_confidence: string | null
          pricing_currency: string
          pricing_generated_at: string | null
          pricing_high_estimate_cents: number | null
          pricing_low_estimate_cents: number | null
          pricing_mode: string | null
          pricing_price_bound_by: string | null
          pricing_pricebook_reference_cents: number | null
          pricing_reason_codes: string[]
          pricing_reference_count: number
          pricing_rule_version: string | null
          pricing_status: string
          pricing_validated_at: string | null
          pricing_validated_by: string | null
          reference: string
          referred_binder_id: string | null
          service_price_cents: number | null
          status: string
          suggested_binder_payout_cents: number | null
          suggested_customer_price_cents: number | null
          tax_status: string
          triage_flags: string[]
          triaged_at: string | null
          updated_at: string
        }
        Insert: {
          acquisition_origin?: string
          admin_notes?: string | null
          base_service_price_cents?: number | null
          binder_payout_cents?: number | null
          brand?: string
          brand_multiplier_bps?: number | null
          claim_method?: string | null
          claimed_at?: string | null
          created_at?: string
          customer_price_cents?: number | null
          customer_user_id?: string | null
          declared_value_band?: string | null
          deposit_cents?: number | null
          dossier_id: string
          heritage_flag?: boolean
          id?: string
          manual_review_required?: boolean
          mission_id?: string | null
          price_includes?: string[]
          pricing_components?: Json
          pricing_confidence?: string | null
          pricing_currency?: string
          pricing_generated_at?: string | null
          pricing_high_estimate_cents?: number | null
          pricing_low_estimate_cents?: number | null
          pricing_mode?: string | null
          pricing_price_bound_by?: string | null
          pricing_pricebook_reference_cents?: number | null
          pricing_reason_codes?: string[]
          pricing_reference_count?: number
          pricing_rule_version?: string | null
          pricing_status?: string
          pricing_validated_at?: string | null
          pricing_validated_by?: string | null
          reference: string
          referred_binder_id?: string | null
          service_price_cents?: number | null
          status?: string
          suggested_binder_payout_cents?: number | null
          suggested_customer_price_cents?: number | null
          tax_status?: string
          triage_flags?: string[]
          triaged_at?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_origin?: string
          admin_notes?: string | null
          base_service_price_cents?: number | null
          binder_payout_cents?: number | null
          brand?: string
          brand_multiplier_bps?: number | null
          claim_method?: string | null
          claimed_at?: string | null
          created_at?: string
          customer_price_cents?: number | null
          customer_user_id?: string | null
          declared_value_band?: string | null
          deposit_cents?: number | null
          dossier_id?: string
          heritage_flag?: boolean
          id?: string
          manual_review_required?: boolean
          mission_id?: string | null
          price_includes?: string[]
          pricing_components?: Json
          pricing_confidence?: string | null
          pricing_currency?: string
          pricing_generated_at?: string | null
          pricing_high_estimate_cents?: number | null
          pricing_low_estimate_cents?: number | null
          pricing_mode?: string | null
          pricing_price_bound_by?: string | null
          pricing_pricebook_reference_cents?: number | null
          pricing_reason_codes?: string[]
          pricing_reference_count?: number
          pricing_rule_version?: string | null
          pricing_status?: string
          pricing_validated_at?: string | null
          pricing_validated_by?: string | null
          reference?: string
          referred_binder_id?: string | null
          service_price_cents?: number | null
          status?: string
          suggested_binder_payout_cents?: number | null
          suggested_customer_price_cents?: number | null
          tax_status?: string
          triage_flags?: string[]
          triaged_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_cases_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "build_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cases_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "build_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cases_referred_binder_id_fkey"
            columns: ["referred_binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_commercial_proposal_payments: {
        Row: {
          amount_paid_cents: number | null
          created_at: string
          paid_at: string | null
          paid_currency: string | null
          proposal_id: string
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number | null
          created_at?: string
          paid_at?: string | null
          paid_currency?: string | null
          proposal_id: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number | null
          created_at?: string
          paid_at?: string | null
          paid_currency?: string | null
          proposal_id?: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commercial_proposal_payments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "marketplace_commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_commercial_proposals: {
        Row: {
          accepted_at: string | null
          balance_due_cents: number
          billing_country: string | null
          binder_payout_cents: number
          binder_payout_ttc_cents: number | null
          binder_vat_amount_cents: number | null
          binder_vat_rate_bps: number | null
          brand: string
          brand_multiplier_bps: number
          brand_reference_cents: number | null
          business_name: string | null
          business_vat_number: string | null
          business_vat_validation_status: string | null
          case_id: string
          contribution_floor_cents: number
          created_at: string
          created_by: string | null
          currency: string
          customer_service_price_cents: number
          customer_total_ht_cents: number
          customer_total_ttc_cents: number | null
          customer_type: string
          customer_vat_amount_cents: number | null
          customer_vat_rate_bps: number | null
          deposit_amount_cents: number
          deposit_type: string
          deposit_value_bps: number | null
          estimate_max_cents: number | null
          estimate_min_cents: number | null
          id: string
          margin_floor_cents: number
          minimum_contribution_cents: number
          notes: string | null
          price_bound_by: string
          pricebook_provenance: Json | null
          pricebook_reference_cents: number | null
          pricing_mode: string
          pricing_rule_version: string
          shipping_handling_fee_cents: number
          shipping_margin_cents: number
          shipping_other_cents: number
          shipping_outbound_cents: number
          shipping_return_cents: number
          shipping_total_cents: number
          status: string
          superseded_at: string | null
          target_margin_bps: number
          tax_basis: string | null
          tax_country: string | null
          tax_policy: string
          tax_validated_at: string | null
          tax_validated_by: string | null
          tax_validation_source: string | null
          validated_at: string | null
          validated_by: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          balance_due_cents: number
          billing_country?: string | null
          binder_payout_cents: number
          binder_payout_ttc_cents?: number | null
          binder_vat_amount_cents?: number | null
          binder_vat_rate_bps?: number | null
          brand: string
          brand_multiplier_bps: number
          brand_reference_cents?: number | null
          business_name?: string | null
          business_vat_number?: string | null
          business_vat_validation_status?: string | null
          case_id: string
          contribution_floor_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_service_price_cents: number
          customer_total_ht_cents: number
          customer_total_ttc_cents?: number | null
          customer_type?: string
          customer_vat_amount_cents?: number | null
          customer_vat_rate_bps?: number | null
          deposit_amount_cents?: number
          deposit_type?: string
          deposit_value_bps?: number | null
          estimate_max_cents?: number | null
          estimate_min_cents?: number | null
          id?: string
          margin_floor_cents: number
          minimum_contribution_cents?: number
          notes?: string | null
          price_bound_by: string
          pricebook_provenance?: Json | null
          pricebook_reference_cents?: number | null
          pricing_mode: string
          pricing_rule_version: string
          shipping_handling_fee_cents?: number
          shipping_margin_cents?: number
          shipping_other_cents?: number
          shipping_outbound_cents?: number
          shipping_return_cents?: number
          shipping_total_cents?: number
          status?: string
          superseded_at?: string | null
          target_margin_bps: number
          tax_basis?: string | null
          tax_country?: string | null
          tax_policy?: string
          tax_validated_at?: string | null
          tax_validated_by?: string | null
          tax_validation_source?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version: number
        }
        Update: {
          accepted_at?: string | null
          balance_due_cents?: number
          billing_country?: string | null
          binder_payout_cents?: number
          binder_payout_ttc_cents?: number | null
          binder_vat_amount_cents?: number | null
          binder_vat_rate_bps?: number | null
          brand?: string
          brand_multiplier_bps?: number
          brand_reference_cents?: number | null
          business_name?: string | null
          business_vat_number?: string | null
          business_vat_validation_status?: string | null
          case_id?: string
          contribution_floor_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_service_price_cents?: number
          customer_total_ht_cents?: number
          customer_total_ttc_cents?: number | null
          customer_type?: string
          customer_vat_amount_cents?: number | null
          customer_vat_rate_bps?: number | null
          deposit_amount_cents?: number
          deposit_type?: string
          deposit_value_bps?: number | null
          estimate_max_cents?: number | null
          estimate_min_cents?: number | null
          id?: string
          margin_floor_cents?: number
          minimum_contribution_cents?: number
          notes?: string | null
          price_bound_by?: string
          pricebook_provenance?: Json | null
          pricebook_reference_cents?: number | null
          pricing_mode?: string
          pricing_rule_version?: string
          shipping_handling_fee_cents?: number
          shipping_margin_cents?: number
          shipping_other_cents?: number
          shipping_outbound_cents?: number
          shipping_return_cents?: number
          shipping_total_cents?: number
          status?: string
          superseded_at?: string | null
          target_margin_bps?: number
          tax_basis?: string | null
          tax_country?: string | null
          tax_policy?: string
          tax_validated_at?: string | null
          tax_validated_by?: string | null
          tax_validation_source?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commercial_proposals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_conversation_reads: {
        Row: {
          case_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_conversation_reads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_decisions: {
        Row: {
          answer: Json | null
          answered_at: string | null
          answered_by: string | null
          cancelled_at: string | null
          case_id: string
          created_at: string
          id: string
          kind: string
          options: Json
          question: string
          requested_by: string | null
          requested_role: string
          status: string
          superseded_by: string | null
        }
        Insert: {
          answer?: Json | null
          answered_at?: string | null
          answered_by?: string | null
          cancelled_at?: string | null
          case_id: string
          created_at?: string
          id?: string
          kind: string
          options?: Json
          question: string
          requested_by?: string | null
          requested_role: string
          status?: string
          superseded_by?: string | null
        }
        Update: {
          answer?: Json | null
          answered_at?: string | null
          answered_by?: string | null
          cancelled_at?: string | null
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          question?: string
          requested_by?: string | null
          requested_role?: string
          status?: string
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_decisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_decisions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "marketplace_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_events: {
        Row: {
          actor_user_id: string | null
          binder_id: string | null
          case_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_user_id?: string | null
          binder_id?: string | null
          case_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_user_id?: string | null
          binder_id?: string | null
          case_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_events_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_intake_missions: {
        Row: {
          brand: string
          created_at: string
          mission_id: string
          vertical_id: string
        }
        Insert: {
          brand?: string
          created_at?: string
          mission_id: string
          vertical_id?: string
        }
        Update: {
          brand?: string
          created_at?: string
          mission_id?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_intake_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: true
            referencedRelation: "build_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_messages: {
        Row: {
          attachment_paths: string[]
          audience: string
          body: string
          case_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_role: string
          sender_user_id: string | null
        }
        Insert: {
          attachment_paths?: string[]
          audience?: string
          body?: string
          case_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_role: string
          sender_user_id?: string | null
        }
        Update: {
          attachment_paths?: string[]
          audience?: string
          body?: string
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_role?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_pricebook: {
        Row: {
          complexity_class: string
          created_at: string
          customer_price_cents: number
          id: string
          notes: string | null
          pricing_method: string
          reference_binder_payout_cents: number
          reference_count_at_validation: number
          size_class: string
          status: string
          target_margin_bps: number
          target_margin_cents: number
          validated_at: string | null
          validated_by: string | null
          version: number
          work_item_key: string
        }
        Insert: {
          complexity_class?: string
          created_at?: string
          customer_price_cents: number
          id?: string
          notes?: string | null
          pricing_method?: string
          reference_binder_payout_cents: number
          reference_count_at_validation?: number
          size_class?: string
          status?: string
          target_margin_bps: number
          target_margin_cents: number
          validated_at?: string | null
          validated_by?: string | null
          version?: number
          work_item_key: string
        }
        Update: {
          complexity_class?: string
          created_at?: string
          customer_price_cents?: number
          id?: string
          notes?: string | null
          pricing_method?: string
          reference_binder_payout_cents?: number
          reference_count_at_validation?: number
          size_class?: string
          status?: string
          target_margin_bps?: number
          target_margin_cents?: number
          validated_at?: string | null
          validated_by?: string | null
          version?: number
          work_item_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_pricebook_work_item_key_fkey"
            columns: ["work_item_key"]
            isOneToOne: false
            referencedRelation: "marketplace_work_items"
            referencedColumns: ["key"]
          },
        ]
      }
      marketplace_quotes: {
        Row: {
          accepted_at: string | null
          amount_cents: number
          binder_id: string
          binder_payout_cents: number | null
          case_id: string
          caveats: string | null
          created_at: string
          currency: string
          customer_price_cents: number | null
          decline_reason_code: string | null
          decline_reason_detail: string | null
          declined_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          lead_time_weeks: number | null
          materials: string | null
          offered_at: string | null
          options: string | null
          selected_at: string | null
          state: string
          technique: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount_cents: number
          binder_id: string
          binder_payout_cents?: number | null
          case_id: string
          caveats?: string | null
          created_at?: string
          currency?: string
          customer_price_cents?: number | null
          decline_reason_code?: string | null
          decline_reason_detail?: string | null
          declined_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          lead_time_weeks?: number | null
          materials?: string | null
          offered_at?: string | null
          options?: string | null
          selected_at?: string | null
          state?: string
          technique?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount_cents?: number
          binder_id?: string
          binder_payout_cents?: number | null
          case_id?: string
          caveats?: string | null
          created_at?: string
          currency?: string
          customer_price_cents?: number | null
          decline_reason_code?: string | null
          decline_reason_detail?: string | null
          declined_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          lead_time_weeks?: number | null
          materials?: string | null
          offered_at?: string | null
          options?: string | null
          selected_at?: string | null
          state?: string
          technique?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_quotes_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "marketplace_binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_quotes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "marketplace_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_stripe_webhook_events: {
        Row: {
          attempts: number
          id: string
          last_attempt_at: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          received_at: string
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          id: string
          last_attempt_at?: string | null
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          received_at?: string
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          received_at?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      marketplace_work_items: {
        Row: {
          active: boolean
          created_at: string
          family: string
          hint: string | null
          key: string
          label: string
          requires_study: boolean
          role: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          family: string
          hint?: string | null
          key: string
          label: string
          requires_study?: boolean
          role: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          family?: string
          hint?: string | null
          key?: string
          label?: string
          requires_study?: boolean
          role?: string
          sort_order?: number
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
      marketplace_binder_convert_quote_to_invoice: {
        Args: {
          p_binder_id: string
          p_invoice_notes: string
          p_issue_date: string
          p_issuer: Json
          p_quote_id: string
          p_vat_mention?: string
        }
        Returns: string
      }
      marketplace_binder_create_quote: {
        Args: { p_binder_id: string; p_items: Json; p_quote: Json }
        Returns: string
      }
      marketplace_binder_create_work: {
        Args: { p_binder_id: string; p_work: Json }
        Returns: string
      }
      marketplace_binder_next_document_number: {
        Args: { p_binder_id: string; p_kind: string; p_year: number }
        Returns: string
      }
      marketplace_binder_next_work_reference: {
        Args: { p_binder_id: string; p_year: number }
        Returns: string
      }
      marketplace_binder_update_quote: {
        Args: {
          p_binder_id: string
          p_items: Json
          p_quote: Json
          p_quote_id: string
        }
        Returns: string
      }
      marketplace_claim_webhook_event: {
        Args: {
          p_id: string
          p_payload: Json
          p_stale_after_seconds?: number
          p_type: string
        }
        Returns: {
          claim_attempts: number
          claim_outcome: string
        }[]
      }
      marketplace_dossier_ids_for_verified_email: {
        Args: { p_email: string }
        Returns: string[]
      }
      marketplace_ingest_missing_cases: { Args: never; Returns: number }
      marketplace_mark_proposal_paid: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_invoice_id: string
          p_payment_intent_id: string
          p_proposal_id: string
        }
        Returns: string
      }
      marketplace_respond_to_offer: {
        Args: {
          p_accept: boolean
          p_actor_user_id: string
          p_binder_id: string
          p_case_id: string
          p_reason_code: string
          p_reason_detail: string
        }
        Returns: {
          accepted_at: string | null
          amount_cents: number
          binder_id: string
          binder_payout_cents: number | null
          case_id: string
          caveats: string | null
          created_at: string
          currency: string
          customer_price_cents: number | null
          decline_reason_code: string | null
          decline_reason_detail: string | null
          declined_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          lead_time_weeks: number | null
          materials: string | null
          offered_at: string | null
          options: string | null
          selected_at: string | null
          state: string
          technique: string | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marketplace_select_binder_offer: {
        Args: {
          p_actor_user_id: string
          p_binder_id: string
          p_case_id: string
        }
        Returns: {
          accepted_at: string | null
          amount_cents: number
          binder_id: string
          binder_payout_cents: number | null
          case_id: string
          caveats: string | null
          created_at: string
          currency: string
          customer_price_cents: number | null
          decline_reason_code: string | null
          decline_reason_detail: string | null
          declined_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          lead_time_weeks: number | null
          materials: string | null
          offered_at: string | null
          options: string | null
          selected_at: string | null
          state: string
          technique: string | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marketplace_validate_pricing: {
        Args: {
          p_actor_user_id: string
          p_binder_payout_cents: number
          p_case_id: string
          p_customer_price_cents: number
          p_minimum_margin_bps: number
          p_minimum_margin_cents: number
          p_price_includes: string[]
        }
        Returns: {
          acquisition_origin: string
          admin_notes: string | null
          base_service_price_cents: number | null
          binder_payout_cents: number | null
          brand: string
          brand_multiplier_bps: number | null
          claim_method: string | null
          claimed_at: string | null
          created_at: string
          customer_price_cents: number | null
          customer_user_id: string | null
          declared_value_band: string | null
          deposit_cents: number | null
          dossier_id: string
          heritage_flag: boolean
          id: string
          manual_review_required: boolean
          mission_id: string | null
          price_includes: string[]
          pricing_components: Json
          pricing_confidence: string | null
          pricing_currency: string
          pricing_generated_at: string | null
          pricing_high_estimate_cents: number | null
          pricing_low_estimate_cents: number | null
          pricing_mode: string | null
          pricing_price_bound_by: string | null
          pricing_pricebook_reference_cents: number | null
          pricing_reason_codes: string[]
          pricing_reference_count: number
          pricing_rule_version: string | null
          pricing_status: string
          pricing_validated_at: string | null
          pricing_validated_by: string | null
          reference: string
          referred_binder_id: string | null
          service_price_cents: number | null
          status: string
          suggested_binder_payout_cents: number | null
          suggested_customer_price_cents: number | null
          tax_status: string
          triage_flags: string[]
          triaged_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provision_owner_workspace: {
        Args: { _email: string; _user_id: string; _workspace_name: string }
        Returns: string
      }
      publish_workspace_onboarding: {
        Args: {
          p_mission_name: string
          p_onboarding_id?: string
          p_playbook_id: string
          p_published_by: string
          p_validated_draft_schema: Json
          p_workspace_id: string
        }
        Returns: {
          mission_id: string
          playbook_version_id: string
          reused_existing: boolean
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      build_public_request_type: ["audit", "private_beta"],
    },
  },
} as const
