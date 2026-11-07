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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_status_history: {
        Row: {
          appointment_id: string
          business_id: string
          changed_at: string
          changed_by: string | null
          changed_by_label: string | null
          id: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Insert: {
          appointment_id: string
          business_id: string
          changed_at?: string
          changed_by?: string | null
          changed_by_label?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Update: {
          appointment_id?: string
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_label?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          declared_customer_name: string | null
          declared_customer_phone: string | null
          duration_minutes: number
          ends_at: string
          id: string
          notes: string | null
          price_cents: number
          request_key: string | null
          service_id: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          vehicle_id: string | null
          verified_origin_hash: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          declared_customer_name?: string | null
          declared_customer_phone?: string | null
          duration_minutes: number
          ends_at: string
          id?: string
          notes?: string | null
          price_cents: number
          request_key?: string | null
          service_id: string
          service_name: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vehicle_id?: string | null
          verified_origin_hash?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          declared_customer_name?: string | null
          declared_customer_phone?: string | null
          duration_minutes?: number
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents?: number
          request_key?: string | null
          service_id?: string
          service_name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vehicle_id?: string | null
          verified_origin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_business_id_fkey"
            columns: ["customer_id", "business_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "appointments_service_id_business_id_fkey"
            columns: ["service_id", "business_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_business_id_fkey"
            columns: ["vehicle_id", "business_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      booking_origin_counters: {
        Row: {
          attempts: number
          origin_hash: string
          scope: string
          window_start: string
        }
        Insert: {
          attempts?: number
          origin_hash: string
          scope: string
          window_start: string
        }
        Update: {
          attempts?: number
          origin_hash?: string
          scope?: string
          window_start?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          business_id: string
          close_time: string
          id: string
          is_open: boolean
          open_time: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          business_id: string
          close_time?: string
          id?: string
          is_open?: boolean
          open_time?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          business_id?: string
          close_time?: string
          id?: string
          is_open?: boolean
          open_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slot_interval_minutes: number
          slug: string
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slot_interval_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slot_interval_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          model: string
          plate: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          model: string
          plate?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          model?: string
          plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_business_id_fkey"
            columns: ["customer_id", "business_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _slot_is_free: {
        Args: { _business_id: string; _end: string; _start: string }
        Returns: boolean
      }
      change_appointment_status: {
        Args: {
          _appointment_id: string
          _new_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: undefined
      }
      create_booking_request: {
        Args: {
          _name: string
          _notes: string
          _phone: string
          _plate: string
          _request_key: string
          _service_id: string
          _slug: string
          _starts_at: string
          _vehicle_model: string
        }
        Returns: string
      }
      create_business: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      get_available_slots: {
        Args: { _date: string; _service_id: string; _slug: string }
        Returns: string[]
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      media_business_id: { Args: { _path: string }; Returns: string }
      normalize_phone: { Args: { _p: string }; Returns: string }
      submit_verified_booking: {
        Args: {
          _name: string
          _notes: string
          _origin_hash: string
          _phone: string
          _plate: string
          _request_key: string
          _service_id: string
          _slug: string
          _starts_at: string
          _vehicle_model: string
        }
        Returns: Json
      }
    }
    Enums: {
      appointment_status:
        | "pendente"
        | "confirmado"
        | "recusado"
        | "cancelado"
        | "concluido"
        | "nao_compareceu"
      member_role: "owner" | "staff"
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
  public: {
    Enums: {
      appointment_status: [
        "pendente",
        "confirmado",
        "recusado",
        "cancelado",
        "concluido",
        "nao_compareceu",
      ],
      member_role: ["owner", "staff"],
    },
  },
} as const
