(node:19016) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_sets: {
        Row: {
          bid_strategy: string | null
          billing_event: string | null
          campaign_id: string
          clicks: number | null
          company_id: string | null
          created_at: string | null
          daily_budget: number | null
          destination_type: string | null
          effective_status: string | null
          end_time: string | null
          external_id: string
          id: string
          impressions: number | null
          learning_stage: string | null
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          platform: string
          spend: number | null
          start_time: string | null
          status: string
          targeting: Json | null
          updated_at: string | null
        }
        Insert: {
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id: string
          clicks?: number | null
          company_id?: string | null
          created_at?: string | null
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id: string
          id?: string
          impressions?: number | null
          learning_stage?: string | null
          lifetime_budget?: number | null
          name: string
          optimization_goal?: string | null
          platform: string
          spend?: number | null
          start_time?: string | null
          status: string
          targeting?: Json | null
          updated_at?: string | null
        }
        Update: {
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id?: string
          clicks?: number | null
          company_id?: string | null
          created_at?: string | null
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id?: string
          id?: string
          impressions?: number | null
          learning_stage?: string | null
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          platform?: string
          spend?: number | null
          start_time?: string | null
          status?: string
          targeting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_campaigns_id_fk"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      adsets: {
        Row: {
          bid_strategy: string | null
          billing_event: string | null
          budget_remaining: number | null
          campaign_external_id: string | null
          campaign_id: string | null
          company_id: string
          created_at: string | null
          daily_budget: number | null
          deleted_at: string | null
          effective_status: string | null
          end_time: string | null
          external_id: string
          id: string
          integration_id: string | null
          last_scanned_at: string | null
          lifetime_budget: number | null
          name: string | null
          optimization_goal: string | null
          platform: string | null
          promoted_object: Json | null
          start_time: string | null
          status: string | null
          targeting: Json | null
          updated_at: string | null
        }
        Insert: {
          bid_strategy?: string | null
          billing_event?: string | null
          budget_remaining?: number | null
          campaign_external_id?: string | null
          campaign_id?: string | null
          company_id: string
          created_at?: string | null
          daily_budget?: number | null
          deleted_at?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id: string
          id?: string
          integration_id?: string | null
          last_scanned_at?: string | null
          lifetime_budget?: number | null
          name?: string | null
          optimization_goal?: string | null
          platform?: string | null
          promoted_object?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
        }
        Update: {
          bid_strategy?: string | null
          billing_event?: string | null
          budget_remaining?: number | null
          campaign_external_id?: string | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string | null
          daily_budget?: number | null
          deleted_at?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id?: string
          id?: string
          integration_id?: string | null
          last_scanned_at?: string | null
          lifetime_budget?: number | null
          name?: string | null
          optimization_goal?: string | null
          platform?: string | null
          promoted_object?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adsets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adsets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adsets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_name: string
          company_id: string | null
          completion_tokens: number | null
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          latency_ms: number | null
          message_id: string | null
          metadata: Json | null
          model: string | null
          prompt_tokens: number | null
          started_at: string
          status: string
          tools_used: Json | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          agent_name?: string
          company_id?: string | null
          completion_tokens?: number | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          started_at?: string
          status?: string
          tools_used?: Json | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          company_id?: string | null
          completion_tokens?: number | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          started_at?: string
          status?: string
          tools_used?: Json | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          api_key: string | null
          compliance_system_prompt: string | null
          compliance_user_prompt_template: string | null
          created_at: string | null
          id: string
          max_tokens: number
          model: string
          performance_system_prompt: string | null
          performance_user_prompt_template: string | null
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          compliance_system_prompt?: string | null
          compliance_user_prompt_template?: string | null
          created_at?: string | null
          id?: string
          max_tokens?: number
          model?: string
          performance_system_prompt?: string | null
          performance_user_prompt_template?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          compliance_system_prompt?: string | null
          compliance_user_prompt_template?: string | null
          created_at?: string | null
          id?: string
          max_tokens?: number
          model?: string
          performance_system_prompt?: string | null
          performance_user_prompt_template?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approvals: {
        Row: {
          action_type: string
          company_id: string
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          executed_at: string | null
          execution_error: string | null
          execution_result: Json | null
          expires_at: string
          human_summary: string
          id: string
          message_id: string | null
          payload: Json
          plan_id: string | null
          plan_step_order: number | null
          requested_by_agent: string
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          company_id: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          execution_error?: string | null
          execution_result?: Json | null
          expires_at?: string
          human_summary: string
          id?: string
          message_id?: string | null
          payload: Json
          plan_id?: string | null
          plan_step_order?: number | null
          requested_by_agent?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          execution_error?: string | null
          execution_result?: Json | null
          expires_at?: string
          human_summary?: string
          id?: string
          message_id?: string | null
          payload?: Json
          plan_id?: string | null
          plan_step_order?: number | null
          requested_by_agent?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_insights: {
        Row: {
          abs_top_of_page_rate: number | null
          campaign_name: string | null
          company_id: string
          created_at: string | null
          date: string | null
          device: string | null
          display_domain: string
          id: string
          impression_share: number | null
          outranking_share: number | null
          overlap_rate: number | null
          position_above_rate: number | null
          top_of_page_rate: number | null
        }
        Insert: {
          abs_top_of_page_rate?: number | null
          campaign_name?: string | null
          company_id: string
          created_at?: string | null
          date?: string | null
          device?: string | null
          display_domain: string
          id?: string
          impression_share?: number | null
          outranking_share?: number | null
          overlap_rate?: number | null
          position_above_rate?: number | null
          top_of_page_rate?: number | null
        }
        Update: {
          abs_top_of_page_rate?: number | null
          campaign_name?: string | null
          company_id?: string
          created_at?: string | null
          date?: string | null
          device?: string | null
          display_domain?: string
          id?: string
          impression_share?: number | null
          outranking_share?: number | null
          overlap_rate?: number | null
          position_above_rate?: number | null
          top_of_page_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_insights_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_actions: {
        Row: {
          action: string
          audit_id: string
          company_id: string | null
          created_at: string | null
          executed_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          action: string
          audit_id: string
          company_id?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          action?: string
          audit_id?: string
          company_id?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_actions_audit_id_audits_id_fk"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_actions_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          ai_analysis: Json | null
          company_id: string | null
          compliance_score: number
          created_at: string | null
          creative_id: string
          id: string
          issues: Json | null
          performance_score: number
          policy_id: string | null
          recommendations: Json | null
          status: string
        }
        Insert: {
          ai_analysis?: Json | null
          company_id?: string | null
          compliance_score: number
          created_at?: string | null
          creative_id: string
          id?: string
          issues?: Json | null
          performance_score: number
          policy_id?: string | null
          recommendations?: Json | null
          status: string
        }
        Update: {
          ai_analysis?: Json | null
          company_id?: string | null
          compliance_score?: number
          created_at?: string | null
          creative_id?: string
          id?: string
          issues?: Json | null
          performance_score?: number
          policy_id?: string | null
          recommendations?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_creative_id_creatives_id_fk"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_policy_id_policies_id_fk"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_rules: {
        Row: {
          company_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_enabled: boolean
          last_applied_at: string | null
          learned_from_message_id: string | null
          name: string
          original_text: string | null
          proposal_status: string
          scope: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_enabled?: boolean
          last_applied_at?: string | null
          learned_from_message_id?: string | null
          name: string
          original_text?: string | null
          proposal_status?: string
          scope?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          last_applied_at?: string | null
          learned_from_message_id?: string | null
          name?: string
          original_text?: string | null
          proposal_status?: string
          scope?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_rules_learned_from_message_id_fkey"
            columns: ["learned_from_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_configurations: {
        Row: {
          accent_color: string | null
          brand_guidelines: string | null
          brand_name: string
          company_id: string | null
          created_at: string | null
          font_family: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name: string
          company_id?: string | null
          created_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string
          company_id?: string | null
          created_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_configurations_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_access_log: {
        Row: {
          accessed_at: string
          accessed_by: string | null
          company_id: string
          id: string
          purpose: string
        }
        Insert: {
          accessed_at?: string
          accessed_by?: string | null
          company_id: string
          id?: string
          purpose: string
        }
        Update: {
          accessed_at?: string
          accessed_by?: string | null
          company_id?: string
          id?: string
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_access_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "briefing_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_benchmarks: {
        Row: {
          avg_cpa: number | null
          avg_cpl: number | null
          avg_ctr: number | null
          avg_roas: number | null
          company_id: string
          created_at: string | null
          id: string
          last_calculated_at: string | null
          objective: string
          samples_count: number | null
          total_spend: number | null
        }
        Insert: {
          avg_cpa?: number | null
          avg_cpl?: number | null
          avg_ctr?: number | null
          avg_roas?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          objective: string
          samples_count?: number | null
          total_spend?: number | null
        }
        Update: {
          avg_cpa?: number | null
          avg_cpl?: number | null
          avg_ctr?: number | null
          avg_roas?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          objective?: string
          samples_count?: number | null
          total_spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_benchmarks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_drafts: {
        Row: {
          ad_account_id: string
          ad_data: Json
          adset_data: Json
          campaign_data: Json
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          ad_account_id: string
          ad_data: Json
          adset_data: Json
          campaign_data: Json
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string
          ad_data?: Json
          adset_data?: Json
          campaign_data?: Json
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_old: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics_p_2025_04: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_05: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_06: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_07: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_08: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_09: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_10: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_11: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2025_12: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_01: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_02: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_03: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_04: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_05: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_metrics_p_2026_06: {
        Row: {
          ad_url: string | null
          anuncios: string
          campanha: string
          cidade: string | null
          cliques: number | null
          company_id: string | null
          conversas_iniciadas: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          custo_conversa: number | null
          data: string
          engagement_rate_ranking: string | null
          frequency: number | null
          grupo_anuncios: string
          id: string
          impressoes: number | null
          investimento: number | null
          nome_conta: string
          quality_ranking: string | null
          reach: number | null
          regiao: string | null
          source: string | null
          status: string | null
          sync_batch: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          updated_at: string | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          ad_url?: string | null
          anuncios: string
          campanha: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          ad_url?: string | null
          anuncios?: string
          campanha?: string
          cidade?: string | null
          cliques?: number | null
          company_id?: string | null
          conversas_iniciadas?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          custo_conversa?: number | null
          data?: string
          engagement_rate_ranking?: string | null
          frequency?: number | null
          grupo_anuncios?: string
          id?: string
          impressoes?: number | null
          investimento?: number | null
          nome_conta?: string
          quality_ranking?: string | null
          reach?: number | null
          regiao?: string | null
          source?: string | null
          status?: string | null
          sync_batch?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          updated_at?: string | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      campaign_publication_steps: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          meta_api_response: Json | null
          publication_id: string
          status: string
          step_name: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          meta_api_response?: Json | null
          publication_id: string
          status: string
          step_name: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          meta_api_response?: Json | null
          publication_id?: string
          status?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_publication_steps_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "campaign_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_publications: {
        Row: {
          company_id: string
          compliance_score: number | null
          compliance_violations: Json | null
          created_by: string | null
          current_step: string | null
          draft_id: string | null
          error_message: string | null
          error_stage: string | null
          finished_at: string | null
          id: string
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_creative_id: string | null
          name: string
          started_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          compliance_score?: number | null
          compliance_violations?: Json | null
          created_by?: string | null
          current_step?: string | null
          draft_id?: string | null
          error_message?: string | null
          error_stage?: string | null
          finished_at?: string | null
          id?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          name: string
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          compliance_score?: number | null
          compliance_violations?: Json | null
          created_by?: string | null
          current_step?: string | null
          draft_id?: string | null
          error_message?: string | null
          error_stage?: string | null
          finished_at?: string | null
          id?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          name?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_publications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_publications_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "campaign_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tags: {
        Row: {
          campaign_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account: string | null
          advantage_state: string | null
          api_created_at: string | null
          budget: number | null
          budget_remaining: number | null
          buying_type: string | null
          company_id: string | null
          created_at: string | null
          created_time: string | null
          effective_status: string | null
          external_id: string
          id: string
          integration_id: string
          name: string
          objective: string | null
          platform: string
          spend: string | null
          spend_cap: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          account?: string | null
          advantage_state?: string | null
          api_created_at?: string | null
          budget?: number | null
          budget_remaining?: number | null
          buying_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_time?: string | null
          effective_status?: string | null
          external_id: string
          id?: string
          integration_id: string
          name: string
          objective?: string | null
          platform: string
          spend?: string | null
          spend_cap?: number | null
          status: string
          updated_at?: string | null
        }
        Update: {
          account?: string | null
          advantage_state?: string | null
          api_created_at?: string | null
          budget?: number | null
          budget_remaining?: number | null
          buying_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_time?: string | null
          effective_status?: string | null
          external_id?: string
          id?: string
          integration_id?: string
          name?: string
          objective?: string | null
          platform?: string
          spend?: string | null
          spend_cap?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_integration_id_integrations_id_fk"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_integration_id_integrations_id_fk"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          company_id: string | null
          conversation_id: string | null
          created_at: string
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string
          height: number | null
          id: string
          kind: string
          message_id: string | null
          mime_type: string
          original_filename: string | null
          size_bytes: number
          storage_path: string
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          height?: number | null
          id?: string
          kind: string
          message_id?: string | null
          mime_type: string
          original_filename?: string | null
          size_bytes: number
          storage_path: string
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string
          height?: number | null
          id?: string
          kind?: string
          message_id?: string | null
          mime_type?: string
          original_filename?: string | null
          size_bytes?: number
          storage_path?: string
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          message_count: number | null
          summary: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          tokens_used: number | null
          tool_call_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          tokens_used?: number | null
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          tokens_used?: number | null
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          audits_this_month: number | null
          auto_takedown_enabled: boolean | null
          billing_email: string | null
          brand_colors: string[] | null
          brand_logo_url: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          current_campaigns: number | null
          current_users: number | null
          id: string
          logo_url: string | null
          max_audits_per_month: number | null
          max_campaigns: number | null
          max_users: number | null
          metadata: Json | null
          name: string
          notification_email: string | null
          notification_webhook_url: string | null
          organization_id: string | null
          primary_color: string | null
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date: string | null
          subscription_status: string | null
          takedown_severity_filter: string | null
          takedown_threshold: number | null
          tax_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          audits_this_month?: number | null
          auto_takedown_enabled?: boolean | null
          billing_email?: string | null
          brand_colors?: string[] | null
          brand_logo_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_campaigns?: number | null
          current_users?: number | null
          id?: string
          logo_url?: string | null
          max_audits_per_month?: number | null
          max_campaigns?: number | null
          max_users?: number | null
          metadata?: Json | null
          name: string
          notification_email?: string | null
          notification_webhook_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          takedown_severity_filter?: string | null
          takedown_threshold?: number | null
          tax_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          audits_this_month?: number | null
          auto_takedown_enabled?: boolean | null
          billing_email?: string | null
          brand_colors?: string[] | null
          brand_logo_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_campaigns?: number | null
          current_users?: number | null
          id?: string
          logo_url?: string | null
          max_audits_per_month?: number | null
          max_campaigns?: number | null
          max_users?: number | null
          metadata?: Json | null
          name?: string
          notification_email?: string | null
          notification_webhook_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          takedown_severity_filter?: string | null
          takedown_threshold?: number | null
          tax_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_branding_assets: {
        Row: {
          company_id: string
          created_at: string
          height: number | null
          id: string
          kind: string
          mime_type: string
          size_bytes: number
          storage_path: string
          width: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          size_bytes: number
          storage_path: string
          width?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_branding_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_briefings: {
        Row: {
          audience: Json
          company_id: string
          created_at: string
          niche: string | null
          niche_category: string | null
          palette: Json
          short_description: string | null
          social_links: Json
          status: string
          tone: Json
          updated_at: string
          website_url: string | null
        }
        Insert: {
          audience?: Json
          company_id: string
          created_at?: string
          niche?: string | null
          niche_category?: string | null
          palette?: Json
          short_description?: string | null
          social_links?: Json
          status?: string
          tone?: Json
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          audience?: Json
          company_id?: string
          created_at?: string
          niche?: string | null
          niche_category?: string | null
          palette?: Json
          short_description?: string | null
          social_links?: Json
          status?: string
          tone?: Json
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_briefings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_offers: {
        Row: {
          benefits: string[]
          company_id: string
          created_at: string
          currency: string
          format: string
          id: string
          is_primary: boolean
          name: string
          pains_resolved: string[]
          position: number
          price: number
          sales_url: string | null
          short_description: string
          social_proof: Json
          updated_at: string
        }
        Insert: {
          benefits?: string[]
          company_id: string
          created_at?: string
          currency?: string
          format: string
          id?: string
          is_primary?: boolean
          name: string
          pains_resolved?: string[]
          position?: number
          price: number
          sales_url?: string | null
          short_description: string
          social_proof?: Json
          updated_at?: string
        }
        Update: {
          benefits?: string[]
          company_id?: string
          created_at?: string
          currency?: string
          format?: string
          id?: string
          is_primary?: boolean
          name?: string
          pains_resolved?: string[]
          position?: number
          price?: number
          sales_url?: string | null
          short_description?: string
          social_proof?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_prohibitions: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          source: string
          value: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          id?: string
          source?: string
          value: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_prohibitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_actions: {
        Row: {
          action_type: string
          company_id: string
          created_at: string | null
          creative_id: string
          external_ad_id: string | null
          id: string
          meta_api_response: Json | null
          performed_by: string | null
          reason: string | null
          score_id: string | null
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string | null
          creative_id: string
          external_ad_id?: string | null
          id?: string
          meta_api_response?: Json | null
          performed_by?: string | null
          reason?: string | null
          score_id?: string | null
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string | null
          creative_id?: string
          external_ad_id?: string | null
          id?: string
          meta_api_response?: Json | null
          performed_by?: string | null
          reason?: string | null
          score_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_actions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_actions_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "compliance_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean
          rule_type: string
          severity: string
          source: string
          updated_at: string | null
          value: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          rule_type: string
          severity?: string
          source?: string
          updated_at?: string | null
          value: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          rule_type?: string
          severity?: string
          source?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scan_logs: {
        Row: {
          ads_analyzed: number | null
          ads_critical: number | null
          ads_healthy: number | null
          ads_paused: number | null
          ads_warning: number | null
          company_id: string
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          ads_analyzed?: number | null
          ads_critical?: number | null
          ads_healthy?: number | null
          ads_paused?: number | null
          ads_warning?: number | null
          company_id: string
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          ads_analyzed?: number | null
          ads_critical?: number | null
          ads_healthy?: number | null
          ads_paused?: number | null
          ads_warning?: number | null
          company_id?: string
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scan_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scores: {
        Row: {
          company_id: string
          copy_score: number | null
          created_at: string | null
          creative_id: string
          external_ad_id: string | null
          final_score: number
          health_status: string
          id: string
          image_score: number | null
          scan_model: string | null
          scanned_at: string
        }
        Insert: {
          company_id: string
          copy_score?: number | null
          created_at?: string | null
          creative_id: string
          external_ad_id?: string | null
          final_score: number
          health_status: string
          id?: string
          image_score?: number | null
          scan_model?: string | null
          scanned_at?: string
        }
        Update: {
          company_id?: string
          copy_score?: number | null
          created_at?: string | null
          creative_id?: string
          external_ad_id?: string | null
          final_score?: number
          health_status?: string
          id?: string
          image_score?: number | null
          scan_model?: string | null
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_scores_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_violations: {
        Row: {
          company_id: string
          created_at: string | null
          creative_id: string
          description: string
          evidence: string | null
          id: string
          points_deducted: number
          score_id: string
          severity: string
          violation_type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          creative_id: string
          description: string
          evidence?: string | null
          id?: string
          points_deducted?: number
          score_id: string
          severity: string
          violation_type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          creative_id?: string
          description?: string
          evidence?: string | null
          id?: string
          points_deducted?: number
          score_id?: string
          severity?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_violations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "compliance_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      content_criteria: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_text_length: number | null
          min_text_length: number | null
          name: string
          prohibited_keywords: Json | null
          prohibited_phrases: Json | null
          required_keywords: Json | null
          required_phrases: Json | null
          requires_brand_colors: boolean | null
          requires_logo: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_text_length?: number | null
          min_text_length?: number | null
          name: string
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_text_length?: number | null
          min_text_length?: number | null
          name?: string
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_criteria_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          asset_type: string
          company_id: string
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          metadata: Json
          mime_type: string
          original_filename: string | null
          parent_id: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          asset_type: string
          company_id: string
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type: string
          original_filename?: string | null
          parent_id?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          asset_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          original_filename?: string | null
          parent_id?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_compliance_check: {
        Row: {
          baseline_hits: string[]
          briefing_hits: string[]
          created_at: string
          creative_id: string
          id: string
          ocr_hits: string[]
          passed: boolean
        }
        Insert: {
          baseline_hits?: string[]
          briefing_hits?: string[]
          created_at?: string
          creative_id: string
          id?: string
          ocr_hits?: string[]
          passed: boolean
        }
        Update: {
          baseline_hits?: string[]
          briefing_hits?: string[]
          created_at?: string
          creative_id?: string
          id?: string
          ocr_hits?: string[]
          passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creative_compliance_check_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives_generated"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_patterns: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          patterns: Json
          period_end: string
          period_start: string
          recommendations: Json
          top_performers: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          patterns: Json
          period_end: string
          period_start: string
          recommendations: Json
          top_performers?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          patterns?: Json
          period_end?: string
          period_start?: string
          recommendations?: Json
          top_performers?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_patterns_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_patterns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_pipeline_rules: {
        Row: {
          applies_to: Json
          company_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_enabled: boolean
          last_applied_at: string | null
          learned_from_message_id: string | null
          name: string
          original_text: string | null
          priority: number
          proposal_status: string
          transform_params: Json
          transform_type: string
          updated_at: string
        }
        Insert: {
          applies_to?: Json
          company_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_enabled?: boolean
          last_applied_at?: string | null
          learned_from_message_id?: string | null
          name: string
          original_text?: string | null
          priority?: number
          proposal_status?: string
          transform_params: Json
          transform_type: string
          updated_at?: string
        }
        Update: {
          applies_to?: Json
          company_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          last_applied_at?: string | null
          learned_from_message_id?: string | null
          name?: string
          original_text?: string | null
          priority?: number
          proposal_status?: string
          transform_params?: Json
          transform_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_pipeline_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_pipeline_rules_learned_from_message_id_fkey"
            columns: ["learned_from_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_plan_quotas: {
        Row: {
          cost_usd_per_month_max: number
          creatives_per_day_max: number
          creatives_per_month_max: number
          plan: string
          updated_at: string
        }
        Insert: {
          cost_usd_per_month_max: number
          creatives_per_day_max: number
          creatives_per_month_max: number
          plan: string
          updated_at?: string
        }
        Update: {
          cost_usd_per_month_max?: number
          creatives_per_day_max?: number
          creatives_per_month_max?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      creative_tags: {
        Row: {
          created_at: string | null
          creative_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          creative_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          creative_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_tags_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          ad_account_id: string | null
          ad_external_id: string | null
          ad_set_id: string | null
          brand_analysis: Json | null
          call_to_action: string | null
          campaign_id: string
          carousel_images: Json | null
          clicks: number | null
          color_analysis: Json | null
          company_id: string | null
          composition_analysis: Json | null
          conversions: number | null
          cpc: number | null
          created_at: string | null
          creative_format: string | null
          ctr: number | null
          description: string | null
          detected_media_type: string | null
          effective_object_story_id: string | null
          emotional_tone: string | null
          external_id: string
          headline: string | null
          id: string
          image_url: string | null
          impressions: number | null
          name: string
          performance_score: number | null
          pipeline_applied_rules: Json
          pipeline_source_path: string | null
          platform: string | null
          status: string
          text: string | null
          text_analysis: Json | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
          video_id: string | null
          video_url: string | null
          visual_elements: Json | null
        }
        Insert: {
          ad_account_id?: string | null
          ad_external_id?: string | null
          ad_set_id?: string | null
          brand_analysis?: Json | null
          call_to_action?: string | null
          campaign_id: string
          carousel_images?: Json | null
          clicks?: number | null
          color_analysis?: Json | null
          company_id?: string | null
          composition_analysis?: Json | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          creative_format?: string | null
          ctr?: number | null
          description?: string | null
          detected_media_type?: string | null
          effective_object_story_id?: string | null
          emotional_tone?: string | null
          external_id: string
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          name: string
          performance_score?: number | null
          pipeline_applied_rules?: Json
          pipeline_source_path?: string | null
          platform?: string | null
          status: string
          text?: string | null
          text_analysis?: Json | null
          thumbnail_url?: string | null
          type: string
          updated_at?: string | null
          video_id?: string | null
          video_url?: string | null
          visual_elements?: Json | null
        }
        Update: {
          ad_account_id?: string | null
          ad_external_id?: string | null
          ad_set_id?: string | null
          brand_analysis?: Json | null
          call_to_action?: string | null
          campaign_id?: string
          carousel_images?: Json | null
          clicks?: number | null
          color_analysis?: Json | null
          company_id?: string | null
          composition_analysis?: Json | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          creative_format?: string | null
          ctr?: number | null
          description?: string | null
          detected_media_type?: string | null
          effective_object_story_id?: string | null
          emotional_tone?: string | null
          external_id?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          name?: string
          performance_score?: number | null
          pipeline_applied_rules?: Json
          pipeline_source_path?: string | null
          platform?: string | null
          status?: string
          text?: string | null
          text_analysis?: Json | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          video_id?: string | null
          video_url?: string | null
          visual_elements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_ad_set_id_ad_sets_id_fk"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_campaign_id_campaigns_id_fk"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives_generated: {
        Row: {
          adaptation_set_id: string | null
          briefing_snapshot: Json
          company_id: string
          compliance_warning: boolean
          concept: string
          conversation_id: string | null
          cost_usd: number
          created_at: string
          description: string | null
          format: string
          height: number
          id: string
          idempotency_key: string | null
          is_near_duplicate: boolean
          kb_chunk_ids: string[]
          latency_ms: number | null
          mime_type: string
          model_used: string
          near_duplicate_of_id: string | null
          parent_creative_id: string | null
          phash: string
          pipeline_applied_rules: Json
          pipeline_error: string | null
          pipeline_source_path: string | null
          pipeline_status: string
          prompt: string
          provider_model_version: string | null
          ready_for_publish: boolean
          status: string
          storage_path: string
          tags: string[]
          title: string | null
          updated_at: string
          width: number
        }
        Insert: {
          adaptation_set_id?: string | null
          briefing_snapshot?: Json
          company_id: string
          compliance_warning?: boolean
          concept: string
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          description?: string | null
          format: string
          height: number
          id?: string
          idempotency_key?: string | null
          is_near_duplicate?: boolean
          kb_chunk_ids?: string[]
          latency_ms?: number | null
          mime_type: string
          model_used: string
          near_duplicate_of_id?: string | null
          parent_creative_id?: string | null
          phash: string
          pipeline_applied_rules?: Json
          pipeline_error?: string | null
          pipeline_source_path?: string | null
          pipeline_status?: string
          prompt: string
          provider_model_version?: string | null
          ready_for_publish?: boolean
          status?: string
          storage_path: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          width: number
        }
        Update: {
          adaptation_set_id?: string | null
          briefing_snapshot?: Json
          company_id?: string
          compliance_warning?: boolean
          concept?: string
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          description?: string | null
          format?: string
          height?: number
          id?: string
          idempotency_key?: string | null
          is_near_duplicate?: boolean
          kb_chunk_ids?: string[]
          latency_ms?: number | null
          mime_type?: string
          model_used?: string
          near_duplicate_of_id?: string | null
          parent_creative_id?: string | null
          phash?: string
          pipeline_applied_rules?: Json
          pipeline_error?: string | null
          pipeline_source_path?: string | null
          pipeline_status?: string
          prompt?: string
          provider_model_version?: string | null
          ready_for_publish?: boolean
          status?: string
          storage_path?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "creatives_generated_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_generated_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_generated_near_duplicate_of_id_fkey"
            columns: ["near_duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "creatives_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_generated_parent_creative_id_fkey"
            columns: ["parent_creative_id"]
            isOneToOne: false
            referencedRelation: "creatives_generated"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_actions: {
        Row: {
          action_type: string
          campaign_external_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          company_id: string
          created_at: string | null
          evaluation_id: string | null
          id: string
          meta_api_response: Json | null
          metric_name: string | null
          metric_value: number | null
          performed_by: string | null
          revert_before: string | null
          reverted_at: string | null
          rule_display_name: string | null
          rule_key: string
          status: string
          threshold_value: number | null
        }
        Insert: {
          action_type: string
          campaign_external_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id: string
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          meta_api_response?: Json | null
          metric_name?: string | null
          metric_value?: number | null
          performed_by?: string | null
          revert_before?: string | null
          reverted_at?: string | null
          rule_display_name?: string | null
          rule_key: string
          status?: string
          threshold_value?: number | null
        }
        Update: {
          action_type?: string
          campaign_external_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          meta_api_response?: Json | null
          metric_name?: string | null
          metric_value?: number | null
          performed_by?: string | null
          revert_before?: string | null
          reverted_at?: string | null
          rule_display_name?: string | null
          rule_key?: string
          status?: string
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fury_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fury_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fury_actions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "fury_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_evaluations: {
        Row: {
          avg_cpc: number | null
          avg_cpm: number | null
          avg_ctr: number | null
          avg_frequency: number | null
          budget_pct_used: number | null
          campaign_external_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          company_id: string
          daily_cpa: number | null
          days_with_data: number | null
          evaluated_at: string | null
          id: string
          overall_health: string | null
          rules_triggered: string[] | null
          total_clicks: number | null
          total_conversions: number | null
          total_impressions: number | null
          total_spend: number | null
          trend_direction: string | null
          trend_pct_change: number | null
        }
        Insert: {
          avg_cpc?: number | null
          avg_cpm?: number | null
          avg_ctr?: number | null
          avg_frequency?: number | null
          budget_pct_used?: number | null
          campaign_external_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id: string
          daily_cpa?: number | null
          days_with_data?: number | null
          evaluated_at?: string | null
          id?: string
          overall_health?: string | null
          rules_triggered?: string[] | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          trend_direction?: string | null
          trend_pct_change?: number | null
        }
        Update: {
          avg_cpc?: number | null
          avg_cpm?: number | null
          avg_ctr?: number | null
          avg_frequency?: number | null
          budget_pct_used?: number | null
          campaign_external_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string
          daily_cpa?: number | null
          days_with_data?: number | null
          evaluated_at?: string | null
          id?: string
          overall_health?: string | null
          rules_triggered?: string[] | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          trend_direction?: string | null
          trend_pct_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fury_evaluations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fury_evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_rules: {
        Row: {
          action_type: string
          auto_execute: boolean | null
          company_id: string
          confidence: number | null
          consecutive_days: number
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean | null
          learned_from_message_id: string | null
          original_text: string | null
          proposal_status: string
          rule_key: string
          threshold_unit: string
          threshold_value: number
          updated_at: string | null
        }
        Insert: {
          action_type: string
          auto_execute?: boolean | null
          company_id: string
          confidence?: number | null
          consecutive_days?: number
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean | null
          learned_from_message_id?: string | null
          original_text?: string | null
          proposal_status?: string
          rule_key: string
          threshold_unit: string
          threshold_value: number
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          auto_execute?: boolean | null
          company_id?: string
          confidence?: number | null
          consecutive_days?: number
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean | null
          learned_from_message_id?: string | null
          original_text?: string | null
          proposal_status?: string
          rule_key?: string
          threshold_unit?: string
          threshold_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fury_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fury_rules_learned_from_message_id_fkey"
            columns: ["learned_from_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_scan_logs: {
        Row: {
          actions_executed: number | null
          campaigns_evaluated: number | null
          company_id: string
          error: string | null
          finished_at: string | null
          id: string
          rules_triggered: number | null
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          actions_executed?: number | null
          campaigns_evaluated?: number | null
          company_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          rules_triggered?: number | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          actions_executed?: number | null
          campaigns_evaluated?: number | null
          company_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          rules_triggered?: number | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fury_scan_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheets_config: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          last_sync: string | null
          name: string
          sheet_id: string
          status: string | null
          tab_gid: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          name: string
          sheet_id: string
          status?: string | null
          tab_gid?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          name?: string
          sheet_id?: string
          status?: string | null
          tab_gid?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_sheets_config_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_infractions: {
        Row: {
          company_id: string
          details: Json | null
          detected_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          resolved_at: string | null
          rule_id: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          details?: Json | null
          detected_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          resolved_at?: string | null
          rule_id?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          details?: Json | null
          detected_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          resolved_at?: string | null
          rule_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_infractions_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_infractions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_infractions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "governance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_infractions_rule_id_governance_rules_id_fk"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "governance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_rules: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          id: string
          name: string
          params: Json
          severity: string | null
          type: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          params?: Json
          severity?: string | null
          type: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          params?: Json
          severity?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_rules_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          account_status: string | null
          business_id: string | null
          business_name: string | null
          company_id: string | null
          connected_by_user_id: string | null
          connected_by_user_name: string | null
          created_at: string | null
          data_source: string | null
          facebook_user_id: string | null
          facebook_user_name: string | null
          id: string
          last_deep_scan_at: string | null
          last_full_sync: string | null
          last_sync: string | null
          next_scan_at: string | null
          platform: string
          refresh_token: string | null
          scan_interval_hours: number | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          account_status?: string | null
          business_id?: string | null
          business_name?: string | null
          company_id?: string | null
          connected_by_user_id?: string | null
          connected_by_user_name?: string | null
          created_at?: string | null
          data_source?: string | null
          facebook_user_id?: string | null
          facebook_user_name?: string | null
          id?: string
          last_deep_scan_at?: string | null
          last_full_sync?: string | null
          last_sync?: string | null
          next_scan_at?: string | null
          platform: string
          refresh_token?: string | null
          scan_interval_hours?: number | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          account_status?: string | null
          business_id?: string | null
          business_name?: string | null
          company_id?: string | null
          connected_by_user_id?: string | null
          connected_by_user_name?: string | null
          created_at?: string | null
          data_source?: string | null
          facebook_user_id?: string | null
          facebook_user_name?: string | null
          id?: string
          last_deep_scan_at?: string | null
          last_full_sync?: string | null
          last_sync?: string | null
          next_scan_at?: string | null
          platform?: string
          refresh_token?: string | null
          scan_interval_hours?: number | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_plan_quotas: {
        Row: {
          documents_max: number
          embeddings_per_month_max: number
          plan: string
          storage_bytes_max: number
          updated_at: string
        }
        Insert: {
          documents_max: number
          embeddings_per_month_max: number
          plan: string
          storage_bytes_max: number
          updated_at?: string
        }
        Update: {
          documents_max?: number
          embeddings_per_month_max?: number
          plan?: string
          storage_bytes_max?: number
          updated_at?: string
        }
        Relationships: []
      }
      keyword_rules: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          id: string
          match_type: string
          name: string
          priority: number | null
          tag: string | null
          type: string
          value: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          match_type: string
          name: string
          priority?: number | null
          tag?: string | null
          type: string
          value: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          match_type?: string
          name?: string
          priority?: number | null
          tag?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_rules_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          company_id: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_model_version: string
          id: string
          page_number: number | null
          token_count: number
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          company_id: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_model_version: string
          id?: string
          page_number?: number | null
          token_count?: number
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          company_id?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_model_version?: string
          id?: string
          page_number?: number | null
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          embedding_model_version: string | null
          extracted_text: string | null
          id: string
          indexed_at: string | null
          is_source_of_truth: boolean
          mime_type: string
          page_count: number | null
          size_bytes: number
          source: string
          source_attachment_id: string | null
          status: string
          status_error: string | null
          storage_bucket: string
          storage_path: string
          tags: string[]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          embedding_model_version?: string | null
          extracted_text?: string | null
          id?: string
          indexed_at?: string | null
          is_source_of_truth?: boolean
          mime_type: string
          page_count?: number | null
          size_bytes: number
          source: string
          source_attachment_id?: string | null
          status?: string
          status_error?: string | null
          storage_bucket: string
          storage_path: string
          tags?: string[]
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          embedding_model_version?: string | null
          extracted_text?: string | null
          id?: string
          indexed_at?: string | null
          is_source_of_truth?: boolean
          mime_type?: string
          page_count?: number | null
          size_bytes?: number
          source?: string
          source_attachment_id?: string | null
          status?: string
          status_error?: string | null
          storage_bucket?: string
          storage_path?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_source_attachment_id_fkey"
            columns: ["source_attachment_id"]
            isOneToOne: false
            referencedRelation: "chat_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_query_log: {
        Row: {
          chunk_ids: string[]
          company_id: string
          created_at: string
          duration_ms: number
          id: string
          query_preview: string | null
          top_k: number
          top_score: number | null
          user_id: string | null
        }
        Insert: {
          chunk_ids?: string[]
          company_id: string
          created_at?: string
          duration_ms?: number
          id?: string
          query_preview?: string | null
          top_k: number
          top_score?: number | null
          user_id?: string | null
        }
        Update: {
          chunk_ids?: string[]
          company_id?: string
          created_at?: string
          duration_ms?: number
          id?: string
          query_preview?: string | null
          top_k?: number
          top_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_query_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_usage_monthly: {
        Row: {
          company_id: string
          documents_count: number
          embeddings_tokens: number
          id: string
          month: string
          storage_bytes: number
          updated_at: string
        }
        Insert: {
          company_id: string
          documents_count?: number
          embeddings_tokens?: number
          id?: string
          month: string
          storage_bytes?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          documents_count?: number
          embeddings_tokens?: number
          id?: string
          month?: string
          storage_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_usage_monthly_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          access_count: number | null
          category: string | null
          company_id: string | null
          confidence: number | null
          content: string
          content_embedding: string | null
          created_at: string | null
          evidence_message_ids: string[] | null
          id: string
          importance: number | null
          is_active: boolean | null
          last_accessed_at: string | null
          memory_type: string
          source: string
          source_conversation_id: string | null
          superseded_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          category?: string | null
          company_id?: string | null
          confidence?: number | null
          content: string
          content_embedding?: string | null
          created_at?: string | null
          evidence_message_ids?: string[] | null
          id?: string
          importance?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_type: string
          source?: string
          source_conversation_id?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          category?: string | null
          company_id?: string | null
          confidence?: number | null
          content?: string
          content_embedding?: string | null
          created_at?: string | null
          evidence_message_ids?: string[] | null
          id?: string
          importance?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_type?: string
          source?: string
          source_conversation_id?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_id: string
          account_name: string | null
          account_status: string | null
          account_status_code: number | null
          amount_spent: number | null
          balance: number | null
          business_id: string | null
          business_name: string | null
          company_id: string
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          funding_source: string | null
          id: string
          integration_id: string
          is_active: boolean | null
          last_scanned_at: string | null
          selected_at: string | null
          spend_cap: number | null
          timezone_name: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          account_status?: string | null
          account_status_code?: number | null
          amount_spent?: number | null
          balance?: number | null
          business_id?: string | null
          business_name?: string | null
          company_id: string
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          funding_source?: string | null
          id?: string
          integration_id: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          selected_at?: string | null
          spend_cap?: number | null
          timezone_name?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          account_status?: string | null
          account_status_code?: number | null
          amount_spent?: number | null
          balance?: number | null
          business_id?: string | null
          business_name?: string | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          funding_source?: string | null
          id?: string
          integration_id?: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          selected_at?: string | null
          spend_cap?: number | null
          timezone_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      meta_api_rate_limit: {
        Row: {
          company_id: string
          endpoint_pattern: string
          id: string
          integration_id: string | null
          last_429_at: string | null
          updated_at: string | null
          x_app_usage: Json | null
          x_business_use_case_usage: Json | null
        }
        Insert: {
          company_id: string
          endpoint_pattern: string
          id?: string
          integration_id?: string | null
          last_429_at?: string | null
          updated_at?: string | null
          x_app_usage?: Json | null
          x_business_use_case_usage?: Json | null
        }
        Update: {
          company_id?: string
          endpoint_pattern?: string
          id?: string
          integration_id?: string | null
          last_429_at?: string | null
          updated_at?: string | null
          x_app_usage?: Json | null
          x_business_use_case_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_api_rate_limit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_api_rate_limit_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_api_rate_limit_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      meta_baseline_blocklist: {
        Row: {
          category: string
          created_at: string
          severity: string
          term: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          severity: string
          term: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          severity?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_business_managers: {
        Row: {
          company_id: string
          created_at: string | null
          created_time: string | null
          deleted_at: string | null
          external_id: string
          id: string
          integration_id: string
          last_scanned_at: string | null
          name: string | null
          primary_page: string | null
          two_factor_type: string | null
          updated_at: string | null
          verification_status: string | null
          vertical: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_time?: string | null
          deleted_at?: string | null
          external_id: string
          id?: string
          integration_id: string
          last_scanned_at?: string | null
          name?: string | null
          primary_page?: string | null
          two_factor_type?: string | null
          updated_at?: string | null
          verification_status?: string | null
          vertical?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_time?: string | null
          deleted_at?: string | null
          external_id?: string
          id?: string
          integration_id?: string
          last_scanned_at?: string | null
          name?: string | null
          primary_page?: string | null
          two_factor_type?: string | null
          updated_at?: string | null
          verification_status?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_business_managers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_business_managers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_business_managers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          category_list: Json | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          fan_count: number | null
          followers_count: number | null
          id: string
          integration_id: string
          is_active: boolean | null
          last_scanned_at: string | null
          link: string | null
          page_access_token: string | null
          page_category: string | null
          page_id: string
          page_name: string | null
          picture_url: string | null
          selected_at: string | null
          updated_at: string | null
          verification_status: string | null
        }
        Insert: {
          category_list?: Json | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          fan_count?: number | null
          followers_count?: number | null
          id?: string
          integration_id: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          link?: string | null
          page_access_token?: string | null
          page_category?: string | null
          page_id: string
          page_name?: string | null
          picture_url?: string | null
          selected_at?: string | null
          updated_at?: string | null
          verification_status?: string | null
        }
        Update: {
          category_list?: Json | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          fan_count?: number | null
          followers_count?: number | null
          id?: string
          integration_id?: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          link?: string | null
          page_access_token?: string | null
          page_category?: string | null
          page_id?: string
          page_name?: string | null
          picture_url?: string | null
          selected_at?: string | null
          updated_at?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      meta_pixels: {
        Row: {
          ad_account_id: string | null
          automatic_matching_fields: Json | null
          can_proxy: boolean | null
          code: string | null
          company_id: string
          created_at: string | null
          creation_time: string | null
          deleted_at: string | null
          external_id: string
          first_party_cookie_status: string | null
          id: string
          integration_id: string | null
          is_unavailable: boolean | null
          last_fired_time: string | null
          last_scanned_at: string | null
          name: string | null
          owner_business_id: string | null
          updated_at: string | null
        }
        Insert: {
          ad_account_id?: string | null
          automatic_matching_fields?: Json | null
          can_proxy?: boolean | null
          code?: string | null
          company_id: string
          created_at?: string | null
          creation_time?: string | null
          deleted_at?: string | null
          external_id: string
          first_party_cookie_status?: string | null
          id?: string
          integration_id?: string | null
          is_unavailable?: boolean | null
          last_fired_time?: string | null
          last_scanned_at?: string | null
          name?: string | null
          owner_business_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string | null
          automatic_matching_fields?: Json | null
          can_proxy?: boolean | null
          code?: string | null
          company_id?: string
          created_at?: string | null
          creation_time?: string | null
          deleted_at?: string | null
          external_id?: string
          first_party_cookie_status?: string | null
          id?: string
          integration_id?: string | null
          is_unavailable?: boolean | null
          last_fired_time?: string | null
          last_scanned_at?: string | null
          name?: string | null
          owner_business_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_pixels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pixels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pixels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      meta_scan_logs: {
        Row: {
          company_id: string
          error: string | null
          error_summary: Json | null
          finished_at: string | null
          id: string
          integration_id: string | null
          scan_type: string
          started_at: string
          stats: Json | null
          status: string
          triggered_by: string
        }
        Insert: {
          company_id: string
          error?: string | null
          error_summary?: Json | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          scan_type: string
          started_at?: string
          stats?: Json | null
          status: string
          triggered_by: string
        }
        Update: {
          company_id?: string
          error?: string | null
          error_summary?: Json | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          scan_type?: string
          started_at?: string
          stats?: Json | null
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_scan_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_scan_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_scan_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_sessions: {
        Row: {
          access_token: string
          accounts: Json
          created_at: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          access_token: string
          accounts: Json
          created_at?: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Update: {
          access_token?: string
          accounts?: Json
          created_at?: string | null
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_benchmarks: {
        Row: {
          company_id: string | null
          conversions_min: number | null
          conversions_target: number | null
          cpc_max: number | null
          cpc_target: number | null
          created_at: string | null
          ctr_min: number | null
          ctr_target: number | null
          id: number
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_benchmarks_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          company_id: string
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          executed_at: string | null
          expires_at: string
          human_summary: string
          id: string
          message_id: string | null
          rationale: string | null
          requested_by_agent: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          expires_at?: string
          human_summary: string
          id?: string
          message_id?: string | null
          rationale?: string | null
          requested_by_agent?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          expires_at?: string
          human_summary?: string
          id?: string
          message_id?: string | null
          rationale?: string | null
          requested_by_agent?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          app_id: string | null
          app_secret: string | null
          created_at: string | null
          id: string
          is_configured: boolean | null
          platform: string
          redirect_uri: string | null
          updated_at: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          platform: string
          redirect_uri?: string | null
          updated_at?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          platform?: string
          redirect_uri?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          accent_color: string | null
          brand_guidelines: string | null
          brand_name: string | null
          campaign_ids: Json | null
          company_id: string | null
          conversions_min: number | null
          conversions_target: number | null
          cpc_max: number | null
          cpc_target: number | null
          created_at: string | null
          ctr_min: number | null
          ctr_target: number | null
          description: string | null
          id: string
          is_default: boolean | null
          logo_url: string | null
          max_text_length: number | null
          min_text_length: number | null
          name: string
          primary_color: string | null
          prohibited_keywords: Json | null
          prohibited_phrases: Json | null
          required_keywords: Json | null
          required_phrases: Json | null
          requires_brand_colors: boolean | null
          requires_logo: boolean | null
          scope: string | null
          secondary_color: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string | null
          campaign_ids?: Json | null
          company_id?: string | null
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_text_length?: number | null
          min_text_length?: number | null
          name: string
          primary_color?: string | null
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          scope?: string | null
          secondary_color?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string | null
          campaign_ids?: Json | null
          company_id?: string | null
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_text_length?: number | null
          min_text_length?: number | null
          name?: string
          primary_color?: string | null
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          scope?: string | null
          secondary_color?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_organization_id: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_proposal_events: {
        Row: {
          action: string
          company_id: string
          confidence: number | null
          created_at: string
          id: string
          latency_ms: number | null
          message_id: string | null
          rule_id: string | null
          rule_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          rule_id?: string | null
          rule_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          rule_id?: string | null
          rule_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_proposal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_proposal_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      search_terms: {
        Row: {
          ad_group_id: string | null
          campaign_id: string | null
          company_id: string
          created_at: string | null
          date: string | null
          id: string
          metrics: Json | null
          term: string
        }
        Insert: {
          ad_group_id?: string | null
          campaign_id?: string | null
          company_id: string
          created_at?: string | null
          date?: string | null
          id?: string
          metrics?: Json | null
          term: string
        }
        Update: {
          ad_group_id?: string | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string | null
          date?: string | null
          id?: string
          metrics?: Json | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_terms_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          expire: string
          sess: Json
          sid: string
        }
        Insert: {
          expire: string
          sess: Json
          sid: string
        }
        Update: {
          expire?: string
          sess?: Json
          sid?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          annual_pricing: number | null
          billing_cycle: string
          created_at: string | null
          description: string | null
          display_order: number | null
          enable_trial: boolean | null
          features: Json | null
          id: string
          investment_range: string | null
          is_active: boolean | null
          is_popular: boolean | null
          max_audits_per_month: number
          max_campaigns: number
          max_integrations: number | null
          max_users: number
          monthly_pricing: number | null
          name: string
          price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          annual_pricing?: number | null
          billing_cycle?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          enable_trial?: boolean | null
          features?: Json | null
          id?: string
          investment_range?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          max_audits_per_month: number
          max_campaigns: number
          max_integrations?: number | null
          max_users: number
          monthly_pricing?: number | null
          name: string
          price: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          annual_pricing?: number | null
          billing_cycle?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          enable_trial?: boolean | null
          features?: Json | null
          id?: string
          investment_range?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          max_audits_per_month?: number
          max_campaigns?: number
          max_integrations?: number | null
          max_users?: number
          monthly_pricing?: number | null
          name?: string
          price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_history: {
        Row: {
          ad_sets_synced: number | null
          campaigns_synced: number | null
          company_id: string | null
          completed_at: string | null
          creatives_synced: number | null
          detailed_log: string | null
          error_message: string | null
          id: string
          integration_id: string
          metadata: Json | null
          started_at: string
          status: string
          type: string
        }
        Insert: {
          ad_sets_synced?: number | null
          campaigns_synced?: number | null
          company_id?: string | null
          completed_at?: string | null
          creatives_synced?: number | null
          detailed_log?: string | null
          error_message?: string | null
          id?: string
          integration_id: string
          metadata?: Json | null
          started_at?: string
          status: string
          type: string
        }
        Update: {
          ad_sets_synced?: number | null
          campaigns_synced?: number | null
          company_id?: string | null
          completed_at?: string | null
          creatives_synced?: number | null
          detailed_log?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_history_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_history_integration_id_integrations_id_fk"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_history_integration_id_integrations_id_fk"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_scan_health"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string | null
          entity_type: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          entity_type: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          entity_type?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          password: string
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password: string
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password?: string
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          object_type: string | null
          payload: Json
          platform: string
          processed: boolean | null
          processed_at: string | null
          received_at: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          object_type?: string | null
          payload: Json
          platform: string
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          object_type?: string | null
          payload?: Json
          platform?: string
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      meta_scan_health: {
        Row: {
          company_id: string | null
          consecutive_failures: number | null
          health_status: string | null
          integration_id: string | null
          integration_status: string | null
          last_deep_scan_at: string | null
          last_error_summary: Json | null
          last_failure_at: string | null
          last_success_at: string | null
          next_scan_at: string | null
          scan_interval_hours: number | null
        }
        Insert: {
          company_id?: string | null
          consecutive_failures?: never
          health_status?: never
          integration_id?: string | null
          integration_status?: string | null
          last_deep_scan_at?: string | null
          last_error_summary?: never
          last_failure_at?: never
          last_success_at?: never
          next_scan_at?: string | null
          scan_interval_hours?: number | null
        }
        Update: {
          company_id?: string | null
          consecutive_failures?: never
          health_status?: never
          integration_id?: string | null
          integration_status?: string | null
          last_deep_scan_at?: string | null
          last_error_summary?: never
          last_failure_at?: never
          last_success_at?: never
          next_scan_at?: string | null
          scan_interval_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_company_briefing_status: {
        Row: {
          company_id: string | null
          is_complete: boolean | null
          missing_fields: string[] | null
          score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_briefings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_assistant_chat_artifact: {
        Args: { p_content: string; p_conversation_id: string }
        Returns: string
      }
      backfill_adsets_campaign_id: {
        Args: { p_company_id: string }
        Returns: number
      }
      bump_memory_access: {
        Args: { p_memory_ids: string[] }
        Returns: undefined
      }
      create_next_campaign_metrics_partition: {
        Args: never
        Returns: undefined
      }
      current_user_company_id: { Args: never; Returns: string }
      current_user_organization_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      decrypt_meta_token: { Args: { encrypted_token: string }; Returns: string }
      detect_stale_meta_scans: { Args: never; Returns: number }
      encrypt_meta_token: { Args: { token: string }; Returns: string }
      get_ai_health_summary: { Args: { p_days?: number }; Returns: Json }
      get_company_briefing: {
        Args: { p_company_id: string; p_purpose?: string }
        Returns: Json
      }
      get_creative_health: { Args: never; Returns: Json }
      get_creative_provenance: {
        Args: { p_creative_id: string }
        Returns: Json
      }
      get_creative_usage: { Args: { p_company_id: string }; Returns: Json }
      get_knowledge_usage: { Args: { p_company_id: string }; Returns: Json }
      get_proactive_briefing: { Args: never; Returns: Json }
      get_vault_secret: { Args: { secret_name: string }; Returns: string }
      log_briefing_access: {
        Args: { p_company_id: string; p_purpose: string }
        Returns: undefined
      }
      log_knowledge_access: {
        Args: {
          p_chunk_ids: string[]
          p_company_id: string
          p_duration_ms: number
          p_query_preview: string
          p_top_k: number
          p_top_score: number
        }
        Returns: undefined
      }
      promote_offer_to_primary: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      refresh_briefing_status: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      refresh_budget_benchmarks: {
        Args: { p_company_id: string }
        Returns: number
      }
      search_knowledge: {
        Args: {
          p_boost_source_of_truth?: number
          p_company_id: string
          p_filters?: Json
          p_query_embedding: string
          p_query_preview?: string
          p_top_k?: number
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          chunk_text: string
          document_id: string
          document_title: string
          document_type: string
          is_source_of_truth: boolean
          page_number: number
          score: number
        }[]
      }
      search_memories: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_memory_types?: string[]
          p_query_embedding: string
          p_user_id: string
        }
        Returns: {
          category: string
          content: string
          final_score: number
          id: string
          importance: number
          memory_type: string
          similarity: number
        }[]
      }
      set_message_proposal_status: {
        Args: { p_message_id: string; p_new_status: string }
        Returns: undefined
      }
      trigger_compliance_fast_tick: { Args: never; Returns: undefined }
      trigger_compliance_scan_tick: { Args: never; Returns: undefined }
      trigger_fury_evaluate_tick: { Args: never; Returns: undefined }
      trigger_meta_deep_scan_tick: { Args: never; Returns: undefined }
    }
    Enums: {
      company_status: "active" | "suspended" | "trial" | "cancelled"
      notification_type:
        | "audit_completed"
        | "audit_failed"
        | "policy_violation"
        | "sync_completed"
        | "sync_failed"
        | "system_alert"
        | "welcome"
      subscription_plan: "free" | "starter" | "professional" | "enterprise"
      user_role: "super_admin" | "company_admin" | "operador"
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
      company_status: ["active", "suspended", "trial", "cancelled"],
      notification_type: [
        "audit_completed",
        "audit_failed",
        "policy_violation",
        "sync_completed",
        "sync_failed",
        "system_alert",
        "welcome",
      ],
      subscription_plan: ["free", "starter", "professional", "enterprise"],
      user_role: ["super_admin", "company_admin", "operador"],
    },
  },
} as const
