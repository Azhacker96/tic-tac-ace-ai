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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Relationships: []
      }
      match_moves: {
        Row: {
          autopilot: boolean
          cell: number
          created_at: string
          id: string
          match_id: string
          player_id: string
          round: number
          symbol: string
        }
        Insert: {
          autopilot?: boolean
          cell: number
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          round?: number
          symbol: string
        }
        Update: {
          autopilot?: boolean
          cell?: number
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          round?: number
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_moves_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          board: string
          code: string
          created_at: string
          expires_at: string
          guest_autopilot: boolean
          guest_id: string | null
          guest_rematch: boolean
          guest_seen: string | null
          host_autopilot: boolean
          host_id: string
          host_rematch: boolean
          host_seen: string
          host_symbol: string
          id: string
          result: string | null
          round: number
          status: string
          turn: string
          turn_deadline: string | null
          updated_at: string
          winner_id: string | null
          winning_line: number[] | null
        }
        Insert: {
          board?: string
          code: string
          created_at?: string
          expires_at?: string
          guest_autopilot?: boolean
          guest_id?: string | null
          guest_rematch?: boolean
          guest_seen?: string | null
          host_autopilot?: boolean
          host_id: string
          host_rematch?: boolean
          host_seen?: string
          host_symbol?: string
          id?: string
          result?: string | null
          round?: number
          status?: string
          turn?: string
          turn_deadline?: string | null
          updated_at?: string
          winner_id?: string | null
          winning_line?: number[] | null
        }
        Update: {
          board?: string
          code?: string
          created_at?: string
          expires_at?: string
          guest_autopilot?: boolean
          guest_id?: string | null
          guest_rematch?: boolean
          guest_seen?: string | null
          host_autopilot?: boolean
          host_id?: string
          host_rematch?: boolean
          host_seen?: string
          host_symbol?: string
          id?: string
          result?: string | null
          round?: number
          status?: string
          turn?: string
          turn_deadline?: string | null
          updated_at?: string
          winner_id?: string | null
          winning_line?: number[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          appear_offline: boolean
          avatar: string
          created_at: string
          draws: number
          id: string
          last_seen: string
          losses: number
          nickname: string
          player_id: string
          wins: number
        }
        Insert: {
          appear_offline?: boolean
          avatar?: string
          created_at?: string
          draws?: number
          id: string
          last_seen?: string
          losses?: number
          nickname: string
          player_id: string
          wins?: number
        }
        Update: {
          appear_offline?: boolean
          avatar?: string
          created_at?: string
          draws?: number
          id?: string
          last_seen?: string
          losses?: number
          nickname?: string
          player_id?: string
          wins?: number
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          dark_mode: boolean
          music: boolean
          sfx: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          dark_mode?: boolean
          music?: boolean
          sfx?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          dark_mode?: boolean
          music?: boolean
          sfx?: boolean
          theme?: string
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
      friend_status: "pending" | "accepted"
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
      friend_status: ["pending", "accepted"],
    },
  },
} as const
