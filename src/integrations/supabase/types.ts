export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          kind: string;
          last_error: string | null;
          org_id: string;
          payload: Json;
          run_after: string;
          started_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          kind: string;
          last_error?: string | null;
          org_id: string;
          payload?: Json;
          run_after?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          kind?: string;
          last_error?: string | null;
          org_id?: string;
          payload?: Json;
          run_after?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_jobs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          diff: Json;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip: unknown;
          org_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          ip?: unknown;
          org_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip?: unknown;
          org_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          ai_score: number | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          email: string;
          experience_years: number | null;
          full_name: string;
          id: string;
          org_id: string | null;
          phone: string | null;
          resume_summary: string | null;
          resume_url: string | null;
          role_applied: string | null;
          skills: string[] | null;
          status: Database["public"]["Enums"]["candidate_status"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          ai_score?: number | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          email: string;
          experience_years?: number | null;
          full_name: string;
          id?: string;
          org_id?: string | null;
          phone?: string | null;
          resume_summary?: string | null;
          resume_url?: string | null;
          role_applied?: string | null;
          skills?: string[] | null;
          status?: Database["public"]["Enums"]["candidate_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          ai_score?: number | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          email?: string;
          experience_years?: number | null;
          full_name?: string;
          id?: string;
          org_id?: string | null;
          phone?: string | null;
          resume_summary?: string | null;
          resume_url?: string | null;
          role_applied?: string | null;
          skills?: string[] | null;
          status?: Database["public"]["Enums"]["candidate_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      error_events: {
        Row: {
          actor_id: string | null;
          context: Json;
          created_at: string;
          id: string;
          level: string;
          message: string;
          org_id: string | null;
          request_id: string | null;
          source: string;
          stack: string | null;
        };
        Insert: {
          actor_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          level?: string;
          message: string;
          org_id?: string | null;
          request_id?: string | null;
          source: string;
          stack?: string | null;
        };
        Update: {
          actor_id?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          level?: string;
          message?: string;
          org_id?: string | null;
          request_id?: string | null;
          source?: string;
          stack?: string | null;
        };
        Relationships: [];
      };
      gdpr_requests: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          kind: string;
          org_id: string | null;
          status: string;
          storage_path: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind: string;
          org_id?: string | null;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind?: string;
          org_id?: string | null;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      identity_verifications: {
        Row: {
          candidate_id: string;
          created_at: string;
          device_fingerprint: Json | null;
          id: string;
          id_document_path: string | null;
          interview_id: string;
          match_score: number | null;
          org_id: string;
          selfie_path: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          device_fingerprint?: Json | null;
          id?: string;
          id_document_path?: string | null;
          interview_id: string;
          match_score?: number | null;
          org_id: string;
          selfie_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          device_fingerprint?: Json | null;
          id?: string;
          id_document_path?: string | null;
          interview_id?: string;
          match_score?: number | null;
          org_id?: string;
          selfie_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_verifications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "identity_verifications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "mv_time_to_hire";
            referencedColumns: ["candidate_id"];
          },
          {
            foreignKeyName: "identity_verifications_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "identity_verifications_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_events: {
        Row: {
          at: string;
          id: string;
          payload: Json;
          session_id: string;
          type: string;
        };
        Insert: {
          at?: string;
          id?: string;
          payload?: Json;
          session_id: string;
          type: string;
        };
        Update: {
          at?: string;
          id?: string;
          payload?: Json;
          session_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "interview_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_invitations: {
        Row: {
          accepted_at: string | null;
          candidate_id: string | null;
          candidate_token_hash: string;
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          interview_id: string;
          joined_at: string | null;
          opened_at: string | null;
          org_id: string | null;
          sent_at: string | null;
          status: string;
          token: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          candidate_id?: string | null;
          candidate_token_hash: string;
          created_at?: string;
          email?: string | null;
          expires_at: string;
          id?: string;
          interview_id: string;
          joined_at?: string | null;
          opened_at?: string | null;
          org_id?: string | null;
          sent_at?: string | null;
          status?: string;
          token?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          candidate_id?: string | null;
          candidate_token_hash?: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          interview_id?: string;
          joined_at?: string | null;
          opened_at?: string | null;
          org_id?: string | null;
          sent_at?: string | null;
          status?: string;
          token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interview_invitations_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_invitations_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "mv_time_to_hire";
            referencedColumns: ["candidate_id"];
          },
          {
            foreignKeyName: "interview_invitations_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_questions: {
        Row: {
          created_at: string;
          interview_id: string;
          ordering: number;
          question_id: string;
          source: string;
        };
        Insert: {
          created_at?: string;
          interview_id: string;
          ordering?: number;
          question_id: string;
          source?: string;
        };
        Update: {
          created_at?: string;
          interview_id?: string;
          ordering?: number;
          question_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_reports: {
        Row: {
          created_at: string;
          evidence: Json;
          executive_summary: string | null;
          id: string;
          integrity_score: number | null;
          integrity_timeline: Json;
          interview_id: string;
          knowledge_gaps: Json;
          org_id: string;
          recommendation: string | null;
          scores: Json;
          strengths: Json;
          updated_at: string;
          weaknesses: Json;
        };
        Insert: {
          created_at?: string;
          evidence?: Json;
          executive_summary?: string | null;
          id?: string;
          integrity_score?: number | null;
          integrity_timeline?: Json;
          interview_id: string;
          knowledge_gaps?: Json;
          org_id: string;
          recommendation?: string | null;
          scores?: Json;
          strengths?: Json;
          updated_at?: string;
          weaknesses?: Json;
        };
        Update: {
          created_at?: string;
          evidence?: Json;
          executive_summary?: string | null;
          id?: string;
          integrity_score?: number | null;
          integrity_timeline?: Json;
          interview_id?: string;
          knowledge_gaps?: Json;
          org_id?: string;
          recommendation?: string | null;
          scores?: Json;
          strengths?: Json;
          updated_at?: string;
          weaknesses?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "interview_reports_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: true;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_reports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_reschedules: {
        Row: {
          actor_id: string;
          created_at: string;
          from_at: string | null;
          id: string;
          interview_id: string;
          reason: string | null;
          to_at: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          from_at?: string | null;
          id?: string;
          interview_id: string;
          reason?: string | null;
          to_at: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          from_at?: string | null;
          id?: string;
          interview_id?: string;
          reason?: string | null;
          to_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_reschedules_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_sessions: {
        Row: {
          created_at: string;
          device_info: Json;
          ended_at: string | null;
          id: string;
          interview_id: string;
          network_quality: Json;
          org_id: string;
          started_at: string;
        };
        Insert: {
          created_at?: string;
          device_info?: Json;
          ended_at?: string | null;
          id?: string;
          interview_id: string;
          network_quality?: Json;
          org_id: string;
          started_at?: string;
        };
        Update: {
          created_at?: string;
          device_info?: Json;
          ended_at?: string | null;
          id?: string;
          interview_id?: string;
          network_quality?: Json;
          org_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_sessions_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_sessions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_slots: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          org_id: string;
          recruiter_id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          org_id: string;
          recruiter_id: string;
          starts_at: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          org_id?: string;
          recruiter_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_slots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_turns: {
        Row: {
          audio_path: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          session_id: string;
          speaker: string;
          started_at: string;
          text: string;
          turn_score: Json | null;
        };
        Insert: {
          audio_path?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          session_id: string;
          speaker: string;
          started_at: string;
          text: string;
          turn_score?: Json | null;
        };
        Update: {
          audio_path?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          session_id?: string;
          speaker?: string;
          started_at?: string;
          text?: string;
          turn_score?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "interview_turns_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "interview_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      interviews: {
        Row: {
          candidate_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          duration_minutes: number | null;
          evaluation: Json;
          evaluation_status: string;
          id: string;
          integrity_score: number | null;
          job_id: string | null;
          org_id: string | null;
          overall_score: number | null;
          persona_id: string | null;
          persona_version_id: string | null;
          recommendation: string | null;
          recruiter_id: string | null;
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["interview_status"];
          transcript: Json;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          evaluation?: Json;
          evaluation_status?: string;
          id?: string;
          integrity_score?: number | null;
          job_id?: string | null;
          org_id?: string | null;
          overall_score?: number | null;
          persona_id?: string | null;
          persona_version_id?: string | null;
          recommendation?: string | null;
          recruiter_id?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["interview_status"];
          transcript?: Json;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          evaluation?: Json;
          evaluation_status?: string;
          id?: string;
          integrity_score?: number | null;
          job_id?: string | null;
          org_id?: string | null;
          overall_score?: number | null;
          persona_id?: string | null;
          persona_version_id?: string | null;
          recommendation?: string | null;
          recruiter_id?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["interview_status"];
          transcript?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interviews_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "mv_time_to_hire";
            referencedColumns: ["candidate_id"];
          },
          {
            foreignKeyName: "interviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_descriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interviews_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interviews_persona_version_id_fkey";
            columns: ["persona_version_id"];
            isOneToOne: false;
            referencedRelation: "persona_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      jd_candidate_matches: {
        Row: {
          candidate_id: string;
          created_at: string;
          focus_areas: Json;
          id: string;
          job_id: string;
          match_score: number | null;
          missing_skills: Json;
          org_id: string;
          shortlisted: boolean;
          strengths: Json;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          focus_areas?: Json;
          id?: string;
          job_id: string;
          match_score?: number | null;
          missing_skills?: Json;
          org_id: string;
          shortlisted?: boolean;
          strengths?: Json;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          focus_areas?: Json;
          id?: string;
          job_id?: string;
          match_score?: number | null;
          missing_skills?: Json;
          org_id?: string;
          shortlisted?: boolean;
          strengths?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jd_candidate_matches_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jd_candidate_matches_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "mv_time_to_hire";
            referencedColumns: ["candidate_id"];
          },
          {
            foreignKeyName: "jd_candidate_matches_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_descriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_descriptions: {
        Row: {
          competencies: Json;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          department: string | null;
          description: string | null;
          employment_type: string | null;
          id: string;
          location: string | null;
          org_id: string | null;
          persona_id: string | null;
          requirements: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          seniority: string | null;
          status: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          competencies?: Json;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          department?: string | null;
          description?: string | null;
          employment_type?: string | null;
          id?: string;
          location?: string | null;
          org_id?: string | null;
          persona_id?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          seniority?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          competencies?: Json;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          department?: string | null;
          description?: string | null;
          employment_type?: string | null;
          id?: string;
          location?: string | null;
          org_id?: string | null;
          persona_id?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          seniority?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_descriptions_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_outbox: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          kind: string;
          org_id: string;
          payload: Json;
          recipient_email: string;
          send_after: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind: string;
          org_id: string;
          payload?: Json;
          recipient_email: string;
          send_after?: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          kind?: string;
          org_id?: string;
          payload?: Json;
          recipient_email?: string;
          send_after?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          industry: string | null;
          name: string;
          size: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          industry?: string | null;
          name: string;
          size?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          industry?: string | null;
          name?: string;
          size?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      persona_questions: {
        Row: {
          ordering: number;
          persona_version_id: string;
          question_id: string;
        };
        Insert: {
          ordering?: number;
          persona_version_id: string;
          question_id: string;
        };
        Update: {
          ordering?: number;
          persona_version_id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "persona_questions_persona_version_id_fkey";
            columns: ["persona_version_id"];
            isOneToOne: false;
            referencedRelation: "persona_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "persona_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      persona_versions: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          org_id: string;
          persona_id: string;
          rubric: Json;
          system_prompt: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          org_id: string;
          persona_id: string;
          rubric?: Json;
          system_prompt: string;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          org_id?: string;
          persona_id?: string;
          rubric?: Json;
          system_prompt?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "persona_versions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "persona_versions_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
        ];
      };
      personas: {
        Row: {
          config: Json;
          created_at: string;
          created_by: string;
          difficulty: string | null;
          id: string;
          name: string;
          org_id: string | null;
          persona_type: string;
          prompt: string | null;
          tone: string | null;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          created_by: string;
          difficulty?: string | null;
          id?: string;
          name: string;
          org_id?: string | null;
          persona_type?: string;
          prompt?: string | null;
          tone?: string | null;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          created_by?: string;
          difficulty?: string | null;
          id?: string;
          name?: string;
          org_id?: string | null;
          persona_type?: string;
          prompt?: string | null;
          tone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      proctoring_snapshots: {
        Row: {
          captured_at: string;
          id: string;
          interview_id: string;
          kind: string;
          meta: Json | null;
          org_id: string;
          session_id: string;
          storage_path: string;
        };
        Insert: {
          captured_at?: string;
          id?: string;
          interview_id: string;
          kind: string;
          meta?: Json | null;
          org_id: string;
          session_id: string;
          storage_path: string;
        };
        Update: {
          captured_at?: string;
          id?: string;
          interview_id?: string;
          kind?: string;
          meta?: Json | null;
          org_id?: string;
          session_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proctoring_snapshots_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proctoring_snapshots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proctoring_snapshots_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "interview_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          org_id: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          org_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          org_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          bank_name: string | null;
          category: string | null;
          competency: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          difficulty: string | null;
          expected_signals: Json;
          hints: Json;
          id: string;
          mandatory: boolean;
          org_id: string;
          prompt: string;
          sort_order: number;
          type: string;
          updated_at: string;
        };
        Insert: {
          bank_name?: string | null;
          category?: string | null;
          competency?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          difficulty?: string | null;
          expected_signals?: Json;
          hints?: Json;
          id?: string;
          mandatory?: boolean;
          org_id: string;
          prompt: string;
          sort_order?: number;
          type?: string;
          updated_at?: string;
        };
        Update: {
          bank_name?: string | null;
          category?: string | null;
          competency?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          difficulty?: string | null;
          expected_signals?: Json;
          hints?: Json;
          id?: string;
          mandatory?: boolean;
          org_id?: string;
          prompt?: string;
          sort_order?: number;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          id: string;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          id?: string;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          id?: string;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      report_exports: {
        Row: {
          created_at: string;
          entity_id: string | null;
          error: string | null;
          id: string;
          kind: string;
          org_id: string;
          requested_by: string;
          status: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          error?: string | null;
          id?: string;
          kind: string;
          org_id: string;
          requested_by: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          error?: string | null;
          id?: string;
          kind?: string;
          org_id?: string;
          requested_by?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_exports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          org_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          allowed_domains: string[];
          created_at: string;
          id: string;
          logo_url: string | null;
          org_name: string;
          primary_color: string | null;
          require_mfa: boolean;
          retention_months: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allowed_domains?: string[];
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          org_name?: string;
          primary_color?: string | null;
          require_mfa?: boolean;
          retention_months?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allowed_domains?: string[];
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          org_name?: string;
          primary_color?: string | null;
          require_mfa?: boolean;
          retention_months?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      mv_candidate_quality_by_role: {
        Row: {
          avg_interview_score: number | null;
          hire_recommendations: number | null;
          org_id: string | null;
          role_applied: string | null;
          total_candidates: number | null;
        };
        Relationships: [];
      };
      mv_persona_effectiveness: {
        Row: {
          avg_score: number | null;
          completed_count: number | null;
          hire_rate: number | null;
          org_id: string | null;
          persona_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_recruiter_funnel: {
        Row: {
          org_id: string | null;
          recruiter_id: string | null;
          status: string | null;
          total: number | null;
        };
        Relationships: [];
      };
      mv_time_to_hire: {
        Row: {
          candidate_id: string | null;
          days_to_hire: number | null;
          first_completed_at: string | null;
          org_id: string | null;
          sourced_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      anonymise_expired_candidates: { Args: never; Returns: number };
      check_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number };
        Returns: boolean;
      };
      claim_invitation_for_user: {
        Args: { _token: string };
        Returns: {
          interview_id: string;
          status: string;
        }[];
      };
      current_user_org_id: { Args: never; Returns: string };
      current_user_org_ids: { Args: never; Returns: string[] };
      get_candidate_quality_by_role: {
        Args: never;
        Returns: {
          avg_interview_score: number;
          hire_recommendations: number;
          org_id: string;
          role_applied: string;
          total_candidates: number;
        }[];
      };
      get_completion_rates: {
        Args: never;
        Returns: {
          org_id: string;
          status: string;
          total: number;
        }[];
      };
      get_hiring_trends: {
        Args: never;
        Returns: {
          completed: number;
          hired: number;
          org_id: string;
          scheduled: number;
          week: string;
        }[];
      };
      get_integrity_summary: {
        Args: never;
        Returns: {
          avg_integrity: number;
          flagged: number;
          org_id: string;
          total_interviews: number;
        }[];
      };
      get_persona_effectiveness: {
        Args: never;
        Returns: {
          avg_score: number;
          completed_count: number;
          hire_rate: number;
          org_id: string;
          persona_id: string;
        }[];
      };
      get_recruiter_funnel: {
        Args: never;
        Returns: {
          org_id: string;
          recruiter_id: string;
          status: string;
          total: number;
        }[];
      };
      get_time_to_hire: {
        Args: never;
        Returns: {
          candidate_id: string;
          days_to_hire: number;
          first_completed_at: string;
          org_id: string;
          sourced_at: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role_in_org: {
        Args: {
          _org_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      interview_window: {
        Args: { _mins: number; _start: string };
        Returns: unknown;
      };
      refresh_analytics_mvs: { Args: never; Returns: undefined };
    };
    Enums: {
      app_role: "admin" | "recruiter" | "candidate";
      candidate_status:
        | "new"
        | "screening"
        | "interviewing"
        | "evaluated"
        | "offer"
        | "hired"
        | "rejected"
        | "archived";
      interview_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "evaluation_pending";
      job_status: "draft" | "open" | "paused" | "closed" | "archived";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "recruiter", "candidate"],
      candidate_status: [
        "new",
        "screening",
        "interviewing",
        "evaluated",
        "offer",
        "hired",
        "rejected",
        "archived",
      ],
      interview_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "evaluation_pending",
      ],
      job_status: ["draft", "open", "paused", "closed", "archived"],
    },
  },
} as const;
