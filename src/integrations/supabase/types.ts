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
      course_notes: {
        Row: {
          course_id: string
          created_at: string
          id: string
          note: string
          session_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          note: string
          session_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          note?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          catalog_id: string | null
          catalog_url: string | null
          course_number: string
          created_at: string
          credits: number | null
          department_prefix: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          catalog_id?: string | null
          catalog_url?: string | null
          course_number: string
          created_at?: string
          credits?: number | null
          department_prefix: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string | null
          catalog_url?: string | null
          course_number?: string
          created_at?: string
          credits?: number | null
          department_prefix?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_prefix_fkey"
            columns: ["department_prefix"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["prefix"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string | null
          prefix: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          prefix: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          prefix?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          course_id: string
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          session_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          term_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          term_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_courses_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "plan_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_terms: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          semester: string
          sort_order: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          semester: string
          sort_order?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          semester?: string
          sort_order?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_terms_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "semester_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prerequisite_relationships: {
        Row: {
          course_id: string
          created_at: string
          group_id: number | null
          id: string
          is_required: boolean
          prerequisite_id: string | null
          prerequisite_text: string | null
          relationship_type: string
        }
        Insert: {
          course_id: string
          created_at?: string
          group_id?: number | null
          id?: string
          is_required?: boolean
          prerequisite_id?: string | null
          prerequisite_text?: string | null
          relationship_type?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          group_id?: number | null
          id?: string
          is_required?: boolean
          prerequisite_id?: string | null
          prerequisite_text?: string | null
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prerequisite_relationships_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prerequisite_relationships_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      program_requirements: {
        Row: {
          category: string
          course_code: string
          course_id: string | null
          created_at: string
          id: string
          is_elective: boolean
          program_id: string
        }
        Insert: {
          category?: string
          course_code: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_elective?: boolean
          program_id: string
        }
        Update: {
          category?: string
          course_code?: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_elective?: boolean
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_requirements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_requirements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          code: string
          created_at: string
          degree_type: string
          id: string
          name: string
          total_credits: number
        }
        Insert: {
          code: string
          created_at?: string
          degree_type?: string
          id?: string
          name: string
          total_credits?: number
        }
        Update: {
          code?: string
          created_at?: string
          degree_type?: string
          id?: string
          name?: string
          total_credits?: number
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          completed_at: string | null
          courses_found: number | null
          departments_scraped: number | null
          error_message: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          courses_found?: number | null
          departments_scraped?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          courses_found?: number | null
          departments_scraped?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      semester_plans: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
