export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      build_dossier_access_tokens: {
        Row: {
          created_at: string;
          dossier_id: string;
          expires_at: string | null;
          id: string;
          last_accessed_at: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          dossier_id: string;
          expires_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          dossier_id?: string;
          expires_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "build_dossier_access_tokens_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "build_dossiers";
            referencedColumns: ["id"];
          },
        ];
      };
      build_dossiers: {
        Row: {
          ai_analyzed_at: string | null;
          ai_insights: Json | null;
          assigned_to_user_id: string | null;
          commercial_notes: string | null;
          commercial_status: string;
          content: Json;
          created_at: string;
          id: string;
          last_activity_at: string;
          mission_id: string | null;
          next_questions: Json;
          playbook_version_id: string | null;
          session_id: string | null;
          status: string;
          summary: string | null;
          updated_at: string;
          visitor_email: string | null;
          visitor_email_sent_at: string | null;
          visitor_name: string | null;
          visitor_summary: Json | null;
          workspace_id: string | null;
        };
        Insert: {
          ai_analyzed_at?: string | null;
          ai_insights?: Json | null;
          assigned_to_user_id?: string | null;
          commercial_notes?: string | null;
          commercial_status?: string;
          content?: Json;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          mission_id?: string | null;
          next_questions?: Json;
          playbook_version_id?: string | null;
          session_id?: string | null;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          visitor_email?: string | null;
          visitor_email_sent_at?: string | null;
          visitor_name?: string | null;
          visitor_summary?: Json | null;
          workspace_id?: string | null;
        };
        Update: {
          ai_analyzed_at?: string | null;
          ai_insights?: Json | null;
          assigned_to_user_id?: string | null;
          commercial_notes?: string | null;
          commercial_status?: string;
          content?: Json;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          mission_id?: string | null;
          next_questions?: Json;
          playbook_version_id?: string | null;
          session_id?: string | null;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          visitor_email?: string | null;
          visitor_email_sent_at?: string | null;
          visitor_name?: string | null;
          visitor_summary?: Json | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "build_dossiers_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "build_missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_dossiers_playbook_version_id_fkey";
            columns: ["playbook_version_id"];
            isOneToOne: false;
            referencedRelation: "build_playbook_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_dossiers_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "build_runtime_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_dossiers_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_knowledge_notes: {
        Row: {
          content: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          status: string;
          tags: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          status?: string;
          tags?: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          status?: string;
          tags?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      build_missions: {
        Row: {
          audience: Json;
          branding: Json;
          created_at: string;
          id: string;
          name: string;
          objective: string | null;
          playbook_id: string | null;
          playbook_name: string | null;
          playbook_version_id: string | null;
          project: Json;
          proposal: Json | null;
          public_token: string | null;
          public_token_revoked_at: string | null;
          published_at: string | null;
          source_onboarding_id: string | null;
          status: string;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          audience?: Json;
          branding?: Json;
          created_at?: string;
          id?: string;
          name: string;
          objective?: string | null;
          playbook_id?: string | null;
          playbook_name?: string | null;
          playbook_version_id?: string | null;
          project?: Json;
          proposal?: Json | null;
          public_token?: string | null;
          public_token_revoked_at?: string | null;
          published_at?: string | null;
          source_onboarding_id?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          audience?: Json;
          branding?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          objective?: string | null;
          playbook_id?: string | null;
          playbook_name?: string | null;
          playbook_version_id?: string | null;
          project?: Json;
          proposal?: Json | null;
          public_token?: string | null;
          public_token_revoked_at?: string | null;
          published_at?: string | null;
          source_onboarding_id?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "build_missions_playbook_version_id_fkey";
            columns: ["playbook_version_id"];
            isOneToOne: false;
            referencedRelation: "build_playbook_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_missions_source_onboarding_id_fkey";
            columns: ["source_onboarding_id"];
            isOneToOne: false;
            referencedRelation: "build_workspace_onboarding";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_missions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_page_views: {
        Row: {
          created_at: string;
          device: string | null;
          id: string;
          is_new_session: boolean;
          locale: string | null;
          path: string;
          referrer_host: string | null;
          session_hash: string | null;
          visitor_hash: string | null;
        };
        Insert: {
          created_at?: string;
          device?: string | null;
          id?: string;
          is_new_session?: boolean;
          locale?: string | null;
          path: string;
          referrer_host?: string | null;
          session_hash?: string | null;
          visitor_hash?: string | null;
        };
        Update: {
          created_at?: string;
          device?: string | null;
          id?: string;
          is_new_session?: boolean;
          locale?: string | null;
          path?: string;
          referrer_host?: string | null;
          session_hash?: string | null;
          visitor_hash?: string | null;
        };
        Relationships: [];
      };
      build_playbook_versions: {
        Row: {
          created_at: string;
          id: string;
          playbook_id: string;
          published_at: string;
          published_by: string | null;
          schema: Json;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          playbook_id: string;
          published_at?: string;
          published_by?: string | null;
          schema: Json;
          version_number: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          playbook_id?: string;
          published_at?: string;
          published_by?: string | null;
          schema?: Json;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "build_playbook_versions_playbook_id_fkey";
            columns: ["playbook_id"];
            isOneToOne: false;
            referencedRelation: "build_playbooks";
            referencedColumns: ["id"];
          },
        ];
      };
      build_playbooks: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          draft_schema: Json;
          id: string;
          is_active: boolean;
          name: string;
          project_type: string | null;
          published_version_id: string | null;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          draft_schema?: Json;
          id?: string;
          is_active?: boolean;
          name: string;
          project_type?: string | null;
          published_version_id?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          draft_schema?: Json;
          id?: string;
          is_active?: boolean;
          name?: string;
          project_type?: string | null;
          published_version_id?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "build_playbooks_published_version_id_fkey";
            columns: ["published_version_id"];
            isOneToOne: false;
            referencedRelation: "build_playbook_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_playbooks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_public_request_rate: {
        Row: {
          created_at: string;
          ip_hash: string;
          request_type: Database["public"]["Enums"]["build_public_request_type"];
        };
        Insert: {
          created_at?: string;
          ip_hash: string;
          request_type: Database["public"]["Enums"]["build_public_request_type"];
        };
        Update: {
          created_at?: string;
          ip_hash?: string;
          request_type?: Database["public"]["Enums"]["build_public_request_type"];
        };
        Relationships: [];
      };
      build_public_requests: {
        Row: {
          audit_analyzed_at: string | null;
          audit_result: Json | null;
          consent: boolean;
          created_at: string;
          id: string;
          ip_hash: string | null;
          payload: Json;
          request_type: Database["public"]["Enums"]["build_public_request_type"];
          source_path: string;
          status: string;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          audit_analyzed_at?: string | null;
          audit_result?: Json | null;
          consent?: boolean;
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          payload: Json;
          request_type: Database["public"]["Enums"]["build_public_request_type"];
          source_path: string;
          status?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          audit_analyzed_at?: string | null;
          audit_result?: Json | null;
          consent?: boolean;
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          payload?: Json;
          request_type?: Database["public"]["Enums"]["build_public_request_type"];
          source_path?: string;
          status?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      build_public_site_analyses: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          ip_hash: string;
          request_id: string;
          result: Json | null;
          status: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          ip_hash: string;
          request_id: string;
          result?: Json | null;
          status: string;
          url: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          ip_hash?: string;
          request_id?: string;
          result?: Json | null;
          status?: string;
          url?: string;
        };
        Relationships: [];
      };
      build_runtime_rate: {
        Row: {
          action: string;
          created_at: string;
          ip_hash: string;
          session_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          ip_hash: string;
          session_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          ip_hash?: string;
          session_id?: string | null;
        };
        Relationships: [];
      };
      build_runtime_sessions: {
        Row: {
          answers: Json;
          created_at: string;
          id: string;
          ip_hash: string | null;
          mission_id: string;
          session_secret_hash: string;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          visitor_hash: string | null;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          mission_id: string;
          session_secret_hash: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          visitor_hash?: string | null;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          mission_id?: string;
          session_secret_hash?: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          visitor_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "build_runtime_sessions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "build_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      build_workspace_ai_runs: {
        Row: {
          action: string;
          created_at: string;
          error: string | null;
          id: string;
          latency_ms: number | null;
          request_id: string | null;
          status: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          request_id?: string | null;
          status: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          request_id?: string | null;
          status?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "build_workspace_ai_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_workspace_members: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "build_workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_workspace_onboarding: {
        Row: {
          analysis: Json | null;
          analyzed_at: string | null;
          branding: Json;
          confirmed_business_type: string | null;
          confirmed_product: string | null;
          created_at: string;
          created_by: string;
          draft_version: number;
          final_url: string | null;
          id: string;
          last_analyze_request_id: string | null;
          last_generate_request_id: string | null;
          mission_id: string | null;
          playbook_id: string | null;
          prospect_campaign_id: string | null;
          prospect_company_name: string | null;
          prospect_last_error: string | null;
          prospect_last_error_at: string | null;
          prospect_last_step: string | null;
          prospect_request_id: string | null;
          prospect_status: string;
          site_url: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          analysis?: Json | null;
          analyzed_at?: string | null;
          branding?: Json;
          confirmed_business_type?: string | null;
          confirmed_product?: string | null;
          created_at?: string;
          created_by: string;
          draft_version?: number;
          final_url?: string | null;
          id?: string;
          last_analyze_request_id?: string | null;
          last_generate_request_id?: string | null;
          mission_id?: string | null;
          playbook_id?: string | null;
          prospect_campaign_id?: string | null;
          prospect_company_name?: string | null;
          prospect_last_error?: string | null;
          prospect_last_error_at?: string | null;
          prospect_last_step?: string | null;
          prospect_request_id?: string | null;
          prospect_status?: string;
          site_url?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          analysis?: Json | null;
          analyzed_at?: string | null;
          branding?: Json;
          confirmed_business_type?: string | null;
          confirmed_product?: string | null;
          created_at?: string;
          created_by?: string;
          draft_version?: number;
          final_url?: string | null;
          id?: string;
          last_analyze_request_id?: string | null;
          last_generate_request_id?: string | null;
          mission_id?: string | null;
          playbook_id?: string | null;
          prospect_campaign_id?: string | null;
          prospect_company_name?: string | null;
          prospect_last_error?: string | null;
          prospect_last_error_at?: string | null;
          prospect_last_step?: string | null;
          prospect_request_id?: string | null;
          prospect_status?: string;
          site_url?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "build_workspace_onboarding_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "build_missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_workspace_onboarding_playbook_id_fkey";
            columns: ["playbook_id"];
            isOneToOne: false;
            referencedRelation: "build_playbooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "build_workspace_onboarding_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "build_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      build_workspaces: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          max_active_missions: number;
          monthly_brief_quota: number;
          name: string;
          notify_on_new_brief: string;
          plan: string;
          provisioned_for_user_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          workspace_type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          max_active_missions?: number;
          monthly_brief_quota?: number;
          name: string;
          notify_on_new_brief?: string;
          plan?: string;
          provisioned_for_user_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          workspace_type?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          max_active_missions?: number;
          monthly_brief_quota?: number;
          name?: string;
          notify_on_new_brief?: string;
          plan?: string;
          provisioned_for_user_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          workspace_type?: string;
        };
        Relationships: [];
      };
      marketplace_binder_rates: {
        Row: {
          binder_id: string;
          complexity_class: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          estimated_hours: number | null;
          id: string;
          maximum_payout_cents: number;
          minimum_payout_cents: number;
          notes: string | null;
          provenance: string;
          size_class: string;
          source: string;
          status: string;
          typical_payout_cents: number;
          verified_at: string | null;
          verified_by: string | null;
          work_item_key: string;
        };
        Insert: {
          binder_id: string;
          complexity_class?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          estimated_hours?: number | null;
          id?: string;
          maximum_payout_cents: number;
          minimum_payout_cents: number;
          notes?: string | null;
          provenance: string;
          size_class?: string;
          source: string;
          status?: string;
          typical_payout_cents: number;
          verified_at?: string | null;
          verified_by?: string | null;
          work_item_key: string;
        };
        Update: {
          binder_id?: string;
          complexity_class?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          estimated_hours?: number | null;
          id?: string;
          maximum_payout_cents?: number;
          minimum_payout_cents?: number;
          notes?: string | null;
          provenance?: string;
          size_class?: string;
          source?: string;
          status?: string;
          typical_payout_cents?: number;
          verified_at?: string | null;
          verified_by?: string | null;
          work_item_key?: string;
        };
        Relationships: [];
      };
      marketplace_price_benchmarks: {
        Row: {
          complexity_class: string | null;
          created_at: string;
          created_by: string | null;
          format_label: string | null;
          high_price_cents: number;
          id: string;
          low_price_cents: number;
          notes: string | null;
          observed_at: string;
          price_basis: string;
          provenance: string;
          size_class: string | null;
          source_excerpt: string;
          source_name: string;
          source_url: string;
          status: string;
          unit_label: string | null;
          work_item_key: string;
        };
        Insert: {
          complexity_class?: string | null;
          created_at?: string;
          created_by?: string | null;
          format_label?: string | null;
          high_price_cents: number;
          id?: string;
          low_price_cents: number;
          notes?: string | null;
          observed_at: string;
          price_basis?: string;
          provenance?: string;
          size_class?: string | null;
          source_excerpt: string;
          source_name: string;
          source_url: string;
          status?: string;
          unit_label?: string | null;
          work_item_key: string;
        };
        Update: {
          complexity_class?: string | null;
          created_at?: string;
          created_by?: string | null;
          format_label?: string | null;
          high_price_cents?: number;
          id?: string;
          low_price_cents?: number;
          notes?: string | null;
          observed_at?: string;
          price_basis?: string;
          provenance?: string;
          size_class?: string | null;
          source_excerpt?: string;
          source_name?: string;
          source_url?: string;
          status?: string;
          unit_label?: string | null;
          work_item_key?: string;
        };
        Relationships: [];
      };
      marketplace_pricebook: {
        Row: {
          change_reason: string | null;
          created_by: string | null;
          customer_price_ttc_cents: number | null;
          included_work_items: string[];
          minimum_margin_cents: number | null;
          price_ht_high_cents: number | null;
          pricing_mode: string;
          public_visible: boolean;
          unit_label: string | null;
          vat_rate_bps: number;
          complexity_class: string;
          created_at: string;
          customer_price_cents: number | null;
          id: string;
          notes: string | null;
          pricing_method: string;
          reference_binder_payout_cents: number | null;
          reference_count_at_validation: number;
          size_class: string;
          status: string;
          target_margin_bps: number;
          target_margin_cents: number | null;
          validated_at: string | null;
          validated_by: string | null;
          version: number;
          work_item_key: string;
        };
        Insert: {
          change_reason?: string | null;
          created_by?: string | null;
          customer_price_ttc_cents?: number | null;
          included_work_items?: string[];
          minimum_margin_cents?: number | null;
          price_ht_high_cents?: number | null;
          pricing_mode?: string;
          public_visible?: boolean;
          unit_label?: string | null;
          vat_rate_bps?: number;
          complexity_class?: string;
          created_at?: string;
          customer_price_cents?: number | null;
          id?: string;
          notes?: string | null;
          pricing_method?: string;
          reference_binder_payout_cents?: number | null;
          reference_count_at_validation?: number;
          size_class?: string;
          status?: string;
          target_margin_bps: number;
          target_margin_cents?: number | null;
          validated_at?: string | null;
          validated_by?: string | null;
          version?: number;
          work_item_key: string;
        };
        Update: {
          change_reason?: string | null;
          created_by?: string | null;
          customer_price_ttc_cents?: number | null;
          included_work_items?: string[];
          minimum_margin_cents?: number | null;
          price_ht_high_cents?: number | null;
          pricing_mode?: string;
          public_visible?: boolean;
          unit_label?: string | null;
          vat_rate_bps?: number;
          complexity_class?: string;
          created_at?: string;
          customer_price_cents?: number | null;
          id?: string;
          notes?: string | null;
          pricing_method?: string;
          reference_binder_payout_cents?: number | null;
          reference_count_at_validation?: number;
          size_class?: string;
          status?: string;
          target_margin_bps?: number;
          target_margin_cents?: number | null;
          validated_at?: string | null;
          validated_by?: string | null;
          version?: number;
          work_item_key?: string;
        };
        Relationships: [];
      };
      marketplace_pricing_modifiers: {
        Row: {
          axis: string;
          class_key: string;
          enabled: boolean;
          fixed_cents: number | null;
          id: string;
          kind: string;
          notes: string | null;
          percent_bps: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          axis: string;
          class_key: string;
          enabled?: boolean;
          fixed_cents?: number | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          percent_bps?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          axis?: string;
          class_key?: string;
          enabled?: boolean;
          fixed_cents?: number | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          percent_bps?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      marketplace_work_items: {
        Row: {
          updated_at: string | null;
          updated_by: string | null;
          active: boolean;
          created_at: string;
          family: string;
          hint: string | null;
          key: string;
          label: string;
          requires_study: boolean;
          role: string;
          sort_order: number;
        };
        Insert: {
          updated_at?: string | null;
          updated_by?: string | null;
          active?: boolean;
          created_at?: string;
          family: string;
          hint?: string | null;
          key: string;
          label: string;
          requires_study?: boolean;
          role: string;
          sort_order?: number;
        };
        Update: {
          updated_at?: string | null;
          updated_by?: string | null;
          active?: boolean;
          created_at?: string;
          family?: string;
          hint?: string | null;
          key?: string;
          label?: string;
          requires_study?: boolean;
          role?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      marketplace_binder_portfolio: {
        Row: {
          after_photo_path: string | null;
          before_photo_path: string | null;
          binder_id: string;
          created_at: string;
          description: string | null;
          id: string;
          materials: string[];
          position: number;
          techniques: string[];
          title: string;
          year: number | null;
        };
        Insert: {
          after_photo_path?: string | null;
          before_photo_path?: string | null;
          binder_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          materials?: string[];
          position?: number;
          techniques?: string[];
          title: string;
          year?: number | null;
        };
        Update: {
          after_photo_path?: string | null;
          before_photo_path?: string | null;
          binder_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          materials?: string[];
          position?: number;
          techniques?: string[];
          title?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      marketplace_binder_skills: {
        Row: {
          binder_id: string;
          skill_slug: string;
        };
        Insert: {
          binder_id: string;
          skill_slug: string;
        };
        Update: {
          binder_id?: string;
          skill_slug?: string;
        };
        Relationships: [];
      };
      marketplace_binders: {
        Row: {
          accepted_project_types: string[];
          avatar_path: string | null;
          bio: string | null;
          capacity_slots: number;
          city: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_demo: boolean;
          max_project_cents: number | null;
          min_project_cents: number | null;
          postal_code: string | null;
          rating_avg: number | null;
          rating_count: number;
          response_rate: number | null;
          status: string;
          stripe_account_id: string | null;
          training: string | null;
          updated_at: string;
          user_id: string | null;
          workshop_name: string | null;
          years_experience: number | null;
        };
        Insert: {
          accepted_project_types?: string[];
          avatar_path?: string | null;
          bio?: string | null;
          capacity_slots?: number;
          city?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          is_demo?: boolean;
          max_project_cents?: number | null;
          min_project_cents?: number | null;
          postal_code?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          response_rate?: number | null;
          status?: string;
          stripe_account_id?: string | null;
          training?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workshop_name?: string | null;
          years_experience?: number | null;
        };
        Update: {
          accepted_project_types?: string[];
          avatar_path?: string | null;
          bio?: string | null;
          capacity_slots?: number;
          city?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_demo?: boolean;
          max_project_cents?: number | null;
          min_project_cents?: number | null;
          postal_code?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          response_rate?: number | null;
          status?: string;
          stripe_account_id?: string | null;
          training?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workshop_name?: string | null;
          years_experience?: number | null;
        };
        Relationships: [];
      };
      marketplace_case_matches: {
        Row: {
          accepted_at: string | null;
          binder_id: string;
          binder_payout_cents: number | null;
          case_id: string;
          currency: string;
          decline_reason: string | null;
          decline_reason_code: string | null;
          decline_reason_detail: string | null;
          declined_at: string | null;
          expires_at: string | null;
          id: string;
          invited_at: string;
          minimum_required_payout_cents?: number | null;
          match_score: number | null;
          offered_at: string | null;
          responded_at: string | null;
          selected_at: string | null;
          state: string;
        };
        Insert: {
          accepted_at?: string | null;
          binder_id: string;
          binder_payout_cents?: number | null;
          case_id: string;
          currency?: string;
          decline_reason?: string | null;
          decline_reason_code?: string | null;
          decline_reason_detail?: string | null;
          declined_at?: string | null;
          expires_at?: string | null;
          id?: string;
          invited_at?: string;
          minimum_required_payout_cents?: number | null;
          match_score?: number | null;
          offered_at?: string | null;
          responded_at?: string | null;
          selected_at?: string | null;
          state?: string;
        };
        Update: {
          accepted_at?: string | null;
          binder_id?: string;
          binder_payout_cents?: number | null;
          case_id?: string;
          currency?: string;
          decline_reason?: string | null;
          decline_reason_code?: string | null;
          decline_reason_detail?: string | null;
          declined_at?: string | null;
          expires_at?: string | null;
          id?: string;
          invited_at?: string;
          minimum_required_payout_cents?: number | null;
          match_score?: number | null;
          offered_at?: string | null;
          responded_at?: string | null;
          selected_at?: string | null;
          state?: string;
        };
        Relationships: [];
      };
      marketplace_cases: {
        Row: {
          customer_price_ttc_cents: number | null;
          pricing_snapshot: Json | null;
          pricing_vat_rate_bps: number | null;
          admin_notes: string | null;
          binder_payout_cents: number | null;
          claim_method: string | null;
          claimed_at: string | null;
          customer_user_id: string | null;
          customer_price_cents: number | null;
          created_at: string;
          declared_value_band: string | null;
          dossier_id: string;
          heritage_flag: boolean;
          id: string;
          manual_review_required: boolean;
          mission_id: string | null;
          price_includes: string[];
          pricing_components?: Json;
          pricing_low_estimate_cents?: number | null;
          pricing_high_estimate_cents?: number | null;
          pricing_reference_count?: number;
          pricing_confidence: string | null;
          pricing_currency: string;
          pricing_generated_at: string | null;
          pricing_reason_codes: string[];
          pricing_rule_version: string | null;
          pricing_status: string;
          pricing_validated_at: string | null;
          pricing_validated_by: string | null;
          reference: string;
          status: string;
          suggested_binder_payout_cents: number | null;
          suggested_customer_price_cents: number | null;
          triage_flags: string[];
          triaged_at: string | null;
          updated_at: string;
        };
        Insert: {
          customer_price_ttc_cents?: number | null;
          pricing_snapshot?: Json | null;
          pricing_vat_rate_bps?: number | null;
          admin_notes?: string | null;
          binder_payout_cents?: number | null;
          claim_method?: string | null;
          claimed_at?: string | null;
          customer_user_id?: string | null;
          customer_price_cents?: number | null;
          created_at?: string;
          declared_value_band?: string | null;
          dossier_id: string;
          heritage_flag?: boolean;
          id?: string;
          manual_review_required?: boolean;
          mission_id?: string | null;
          price_includes?: string[];
          pricing_components?: Json;
          pricing_low_estimate_cents?: number | null;
          pricing_high_estimate_cents?: number | null;
          pricing_reference_count?: number;
          pricing_confidence?: string | null;
          pricing_currency?: string;
          pricing_generated_at?: string | null;
          pricing_reason_codes?: string[];
          pricing_rule_version?: string | null;
          pricing_status?: string;
          pricing_validated_at?: string | null;
          pricing_validated_by?: string | null;
          reference: string;
          status?: string;
          suggested_binder_payout_cents?: number | null;
          suggested_customer_price_cents?: number | null;
          triage_flags?: string[];
          triaged_at?: string | null;
          updated_at?: string;
        };
        Update: {
          customer_price_ttc_cents?: number | null;
          pricing_snapshot?: Json | null;
          pricing_vat_rate_bps?: number | null;
          admin_notes?: string | null;
          binder_payout_cents?: number | null;
          claim_method?: string | null;
          claimed_at?: string | null;
          customer_user_id?: string | null;
          customer_price_cents?: number | null;
          created_at?: string;
          declared_value_band?: string | null;
          dossier_id?: string;
          heritage_flag?: boolean;
          id?: string;
          manual_review_required?: boolean;
          mission_id?: string | null;
          price_includes?: string[];
          pricing_components?: Json;
          pricing_low_estimate_cents?: number | null;
          pricing_high_estimate_cents?: number | null;
          pricing_reference_count?: number;
          pricing_confidence?: string | null;
          pricing_currency?: string;
          pricing_generated_at?: string | null;
          pricing_reason_codes?: string[];
          pricing_rule_version?: string | null;
          pricing_status?: string;
          pricing_validated_at?: string | null;
          pricing_validated_by?: string | null;
          reference?: string;
          status?: string;
          suggested_binder_payout_cents?: number | null;
          suggested_customer_price_cents?: number | null;
          triage_flags?: string[];
          triaged_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_events: {
        Row: {
          actor_user_id: string | null;
          binder_id: string | null;
          case_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          actor_user_id?: string | null;
          binder_id?: string | null;
          case_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          actor_user_id?: string | null;
          binder_id?: string | null;
          case_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      marketplace_intake_missions: {
        Row: {
          created_at: string;
          mission_id: string;
          vertical_id: string;
        };
        Insert: {
          created_at?: string;
          mission_id: string;
          vertical_id?: string;
        };
        Update: {
          created_at?: string;
          mission_id?: string;
          vertical_id?: string;
        };
        Relationships: [];
      };
      marketplace_quotes: {
        Row: {
          accepted_at: string | null;
          amount_cents: number;
          binder_id: string;
          binder_payout_cents: number | null;
          case_id: string;
          caveats: string | null;
          created_at: string;
          currency: string;
          customer_price_cents: number | null;
          decline_reason_code: string | null;
          decline_reason_detail: string | null;
          declined_at: string | null;
          description: string | null;
          expires_at: string | null;
          id: string;
          lead_time_weeks: number | null;
          materials: string | null;
          options: string | null;
          offered_at: string | null;
          selected_at: string | null;
          state: string;
          technique: string | null;
          updated_at: string;
          valid_until: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          amount_cents: number;
          binder_id: string;
          binder_payout_cents?: number | null;
          case_id: string;
          caveats?: string | null;
          created_at?: string;
          currency?: string;
          customer_price_cents?: number | null;
          decline_reason_code?: string | null;
          decline_reason_detail?: string | null;
          declined_at?: string | null;
          description?: string | null;
          id?: string;
          expires_at?: string | null;
          lead_time_weeks?: number | null;
          materials?: string | null;
          options?: string | null;
          offered_at?: string | null;
          selected_at?: string | null;
          state?: string;
          technique?: string | null;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          amount_cents?: number;
          binder_id?: string;
          binder_payout_cents?: number | null;
          case_id?: string;
          caveats?: string | null;
          created_at?: string;
          currency?: string;
          customer_price_cents?: number | null;
          decline_reason_code?: string | null;
          decline_reason_detail?: string | null;
          declined_at?: string | null;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          lead_time_weeks?: number | null;
          materials?: string | null;
          options?: string | null;
          offered_at?: string | null;
          selected_at?: string | null;
          state?: string;
          technique?: string | null;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      marketplace_ingest_missing_cases: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      marketplace_respond_to_offer: {
        Args: {
          p_accept: boolean;
          p_actor_user_id: string;
          p_binder_id: string;
          p_case_id: string;
          p_reason_code: string | null;
          p_reason_detail: string | null;
        };
        Returns: Database["public"]["Tables"]["marketplace_quotes"]["Row"];
      };
      marketplace_select_binder_offer: {
        Args: {
          p_actor_user_id: string;
          p_binder_id: string;
          p_case_id: string;
        };
        Returns: Database["public"]["Tables"]["marketplace_quotes"]["Row"];
      };
      marketplace_publish_pricebook_entry: {
        Args: {
          p_actor_user_id: string;
          p_change_reason: string | null;
          p_complexity_class: string;
          p_customer_price_cents: number | null;
          p_customer_price_ttc_cents: number | null;
          p_included_work_items: string[];
          p_minimum_margin_cents: number | null;
          p_notes: string | null;
          p_price_ht_high_cents: number | null;
          p_pricing_method: string;
          p_pricing_mode: string;
          p_public_visible: boolean;
          p_reference_binder_payout_cents: number | null;
          p_reference_count: number;
          p_size_class: string;
          p_target_margin_bps: number;
          p_unit_label: string | null;
          p_vat_rate_bps: number;
          p_work_item_key: string;
        };
        Returns: Database["public"]["Tables"]["marketplace_pricebook"]["Row"];
      };
      marketplace_validate_pricing_snapshot: {
        Args: {
          p_actor_user_id: string;
          p_binder_payout_cents: number;
          p_case_id: string;
          p_customer_price_cents: number;
          p_customer_price_ttc_cents: number;
          p_overridden: boolean;
          p_price_includes: string[];
          p_snapshot: Json;
          p_vat_rate_bps: number;
        };
        Returns: Database["public"]["Tables"]["marketplace_cases"]["Row"];
      };
      marketplace_validate_pricing: {
        Args: {
          p_actor_user_id: string;
          p_binder_payout_cents: number;
          p_case_id: string;
          p_customer_price_cents: number;
          p_minimum_margin_bps: number;
          p_minimum_margin_cents: number;
          p_price_includes: string[];
        };
        Returns: Database["public"]["Tables"]["marketplace_cases"]["Row"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      provision_owner_workspace: {
        Args: { _email: string; _user_id: string; _workspace_name: string };
        Returns: string;
      };
      publish_workspace_onboarding: {
        Args: {
          p_mission_name: string;
          p_onboarding_id?: string;
          p_playbook_id: string;
          p_published_by: string;
          p_validated_draft_schema: Json;
          p_workspace_id: string;
        };
        Returns: {
          mission_id: string;
          playbook_version_id: string;
          reused_existing: boolean;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "user";
      build_public_request_type: "audit" | "private_beta";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      build_public_request_type: ["audit", "private_beta"],
    },
  },
} as const;
