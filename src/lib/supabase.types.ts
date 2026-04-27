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
      coop_sessions: {
        Row: {
          accepted_at: string | null
          created_at: string
          guest_id: string | null
          host_id: string
          id: string
          invited_at: string
          invited_user_id: string | null
          join_code: string
          state: Json
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          guest_id?: string | null
          host_id: string
          id?: string
          invited_at?: string
          invited_user_id?: string | null
          join_code: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          guest_id?: string | null
          host_id?: string
          id?: string
          invited_at?: string
          invited_user_id?: string | null
          join_code?: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crib_visits: {
        Row: {
          host_id: string
          id: number
          visited_at: string
          visitor_id: string
        }
        Insert: {
          host_id: string
          id?: number
          visited_at?: string
          visitor_id: string
        }
        Update: {
          host_id?: string
          id?: number
          visited_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      fan_relationships: {
        Row: {
          artist_id: string
          became_fan_at: string
          fan_id: string
        }
        Insert: {
          artist_id: string
          became_fan_at?: string
          fan_id: string
        }
        Update: {
          artist_id?: string
          became_fan_at?: string
          fan_id?: string
        }
        Relationships: []
      }
      friend_relationships: {
        Row: {
          accepted_at: string | null
          blocked_by: string | null
          requested_at: string
          requested_by: string
          status: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          accepted_at?: string | null
          blocked_by?: string | null
          requested_at?: string
          requested_by: string
          status: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          accepted_at?: string | null
          blocked_by?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      game_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: number
          kind: string
          payload: Json
          seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          payload?: Json
          seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          payload?: Json
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      player_events: {
        Row: {
          created_at: string
          energy_delta: number
          event_type: string
          id: number
          target_id: string | null
          user_id: string
          xp_delta: number
        }
        Insert: {
          created_at?: string
          energy_delta?: number
          event_type: string
          id?: number
          target_id?: string | null
          user_id: string
          xp_delta?: number
        }
        Update: {
          created_at?: string
          energy_delta?: number
          event_type?: string
          id?: number
          target_id?: string | null
          user_id?: string
          xp_delta?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          avatar?: string
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          avatar?: string
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      song_bonus_events: {
        Row: {
          bonus_type: string
          crossed_at: string
          song_id: string
        }
        Insert: {
          bonus_type: string
          crossed_at?: string
          song_id: string
        }
        Update: {
          bonus_type?: string
          crossed_at?: string
          song_id?: string
        }
        Relationships: []
      }
      song_endorsements: {
        Row: {
          created_at: string
          id: string
          song_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_endorsements_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "song_publication_stats"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_endorsements_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "song_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_endorsements_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "weekly_song_score"
            referencedColumns: ["song_id"]
          },
        ]
      }
      song_publications: {
        Row: {
          artist_avatar: string
          artist_id: string
          artist_name: string
          audio_url: string | null
          bpm: number | null
          collaborator_ids: string[]
          collaborator_names: string[]
          duration_sec: number | null
          id: string
          key_root: string | null
          published_at: string
          retired_at: string | null
          title: string
          waveform_url: string | null
        }
        Insert: {
          artist_avatar?: string
          artist_id: string
          artist_name: string
          audio_url?: string | null
          bpm?: number | null
          collaborator_ids?: string[]
          collaborator_names?: string[]
          duration_sec?: number | null
          id?: string
          key_root?: string | null
          published_at?: string
          retired_at?: string | null
          title: string
          waveform_url?: string | null
        }
        Update: {
          artist_avatar?: string
          artist_id?: string
          artist_name?: string
          audio_url?: string | null
          bpm?: number | null
          collaborator_ids?: string[]
          collaborator_names?: string[]
          duration_sec?: number | null
          id?: string
          key_root?: string | null
          published_at?: string
          retired_at?: string | null
          title?: string
          waveform_url?: string | null
        }
        Relationships: []
      }
      song_ratings: {
        Row: {
          created_at: string
          song_id: string
          stars: number
          user_id: string
        }
        Insert: {
          created_at?: string
          song_id: string
          stars: number
          user_id: string
        }
        Update: {
          created_at?: string
          song_id?: string
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_ratings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "song_publication_stats"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_ratings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "song_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_ratings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "weekly_song_score"
            referencedColumns: ["song_id"]
          },
        ]
      }
      songs: {
        Row: {
          bars: number
          bpm: number
          collaborators: string[]
          created_at: number
          id: string
          key_root: string
          layers: Json
          name: string
          pitch_score: number | null
          published_publication_id: string | null
          tags: string[]
          template_id: string
          user_id: string
          vocal_blob_url: string | null
        }
        Insert: {
          bars: number
          bpm: number
          collaborators?: string[]
          created_at: number
          id: string
          key_root: string
          layers?: Json
          name: string
          pitch_score?: number | null
          published_publication_id?: string | null
          tags?: string[]
          template_id: string
          user_id: string
          vocal_blob_url?: string | null
        }
        Update: {
          bars?: number
          bpm?: number
          collaborators?: string[]
          created_at?: number
          id?: string
          key_root?: string
          layers?: Json
          name?: string
          pitch_score?: number | null
          published_publication_id?: string | null
          tags?: string[]
          template_id?: string
          user_id?: string
          vocal_blob_url?: string | null
        }
        Relationships: []
      }
      sound_acquisitions: {
        Row: {
          created_at: string
          id: number
          sound_id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          sound_id: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          sound_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sound_acquisitions_sound_id_fkey"
            columns: ["sound_id"]
            isOneToOne: false
            referencedRelation: "sound_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_catalog: {
        Row: {
          audio_url: string | null
          bpm: number | null
          category: string
          created_at: string
          display_name: string
          glyph: string
          id: string
          key_root: string | null
          kind: string
          producer_id: string | null
          variant: string | null
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          category?: string
          created_at?: string
          display_name: string
          glyph?: string
          id: string
          key_root?: string | null
          kind: string
          producer_id?: string | null
          variant?: string | null
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          category?: string
          created_at?: string
          display_name?: string
          glyph?: string
          id?: string
          key_root?: string | null
          kind?: string
          producer_id?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      tamagotchi_state: {
        Row: {
          last_seen_at: number
          mood: string
          needs: Json
          songs_abandoned: number
          songs_finished: number
          streak_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: number
          mood?: string
          needs?: Json
          songs_abandoned?: number
          songs_finished?: number
          streak_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: number
          mood?: string
          needs?: Json
          songs_abandoned?: number
          songs_finished?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      template_publications: {
        Row: {
          id: string
          name: string
          producer_id: string
          published_at: string
          sounds: Json
        }
        Insert: {
          id?: string
          name: string
          producer_id: string
          published_at?: string
          sounds?: Json
        }
        Update: {
          id?: string
          name?: string
          producer_id?: string
          published_at?: string
          sounds?: Json
        }
        Relationships: []
      }
      user_sounds: {
        Row: {
          acquired_at: string
          sound_id: string
          source: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          sound_id: string
          source?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          sound_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sounds_sound_id_fkey"
            columns: ["sound_id"]
            isOneToOne: false
            referencedRelation: "sound_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          energy: number
          energy_updated_at: string
          level: number
          longest_session_ms: number
          longest_streak: number
          total_songs_abandoned: number
          total_xp: number
          unlocked_achievements: string[]
          updated_at: string
          user_id: string
          vocal_count: number
        }
        Insert: {
          energy?: number
          energy_updated_at?: string
          level?: number
          longest_session_ms?: number
          longest_streak?: number
          total_songs_abandoned?: number
          total_xp?: number
          unlocked_achievements?: string[]
          updated_at?: string
          user_id: string
          vocal_count?: number
        }
        Update: {
          energy?: number
          energy_updated_at?: string
          level?: number
          longest_session_ms?: number
          longest_streak?: number
          total_songs_abandoned?: number
          total_xp?: number
          unlocked_achievements?: string[]
          updated_at?: string
          user_id?: string
          vocal_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      my_friends: {
        Row: {
          accepted_at: string | null
          friend_user_id: string | null
          requested_at: string | null
          requested_by: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          friend_user_id?: never
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          friend_user_id?: never
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      song_publication_stats: {
        Row: {
          artist_avatar: string | null
          artist_id: string | null
          artist_name: string | null
          audio_url: string | null
          avg_stars: number | null
          bpm: number | null
          collaborator_ids: string[] | null
          collaborator_names: string[] | null
          duration_sec: number | null
          endorsement_count: number | null
          key_root: string | null
          published_at: string | null
          rating_count: number | null
          song_id: string | null
          title: string | null
          waveform_url: string | null
        }
        Relationships: []
      }
      weekly_artist_score: {
        Row: {
          artist_avatar: string | null
          artist_id: string | null
          artist_name: string | null
          endorsements_this_week: number | null
          ratings_this_week: number | null
          score: number | null
          songs_active: number | null
        }
        Relationships: []
      }
      weekly_song_score: {
        Row: {
          artist_avatar: string | null
          artist_id: string | null
          artist_name: string | null
          audio_url: string | null
          avg_stars_this_week: number | null
          bpm: number | null
          collaborator_ids: string[] | null
          collaborator_names: string[] | null
          duration_sec: number | null
          endorsements_this_week: number | null
          key_root: string | null
          published_at: string | null
          ratings_this_week: number | null
          score: number | null
          song_id: string | null
          title: string | null
        }
        Relationships: []
      }
      weekly_tastemaker_score: {
        Row: {
          avatar: string | null
          endorsements_given: number | null
          ratings_given: number | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _coop_gen_code: { Args: never; Returns: string }
      _ordered_pair: {
        Args: { p_x: string; p_y: string }
        Returns: {
          user_a: string
          user_b: string
        }[]
      }
      accept_coop_invite: {
        Args: { p_session_id: string }
        Returns: {
          message: string
          status: string
          success: boolean
        }[]
      }
      admin_set_game_config: {
        Args: { p_key: string; p_value: Json }
        Returns: {
          key: string
          updated_at: string
          value: Json
        }[]
      }
      award_early_ear_bonus_if_needed: {
        Args: { p_current_user: string; p_song_id: string }
        Returns: undefined
      }
      create_coop_session: {
        Args: { p_invite_user_id?: string }
        Returns: {
          id: string
          join_code: string
          status: string
        }[]
      }
      decline_coop_invite: {
        Args: { p_session_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      earn_xp_capped: {
        Args: {
          p_daily_xp_cap: number
          p_event_type: string
          p_target_id?: string
          p_xp: number
        }
        Returns: {
          daily_xp_earned: number
          new_xp: number
          xp_awarded: number
        }[]
      }
      endorse_song: {
        Args: { p_song_id: string }
        Returns: {
          daily_cap: number
          endorsements_today: number
          message: string
          new_energy: number
          new_level: number
          new_xp: number
          success: boolean
        }[]
      }
      get_live_energy: {
        Args: { p_energy_max?: number; p_regen_interval_seconds?: number }
        Returns: {
          base_energy: number
          energy_updated_at: string
          level: number
          live_energy: number
          total_xp: number
        }[]
      }
      join_coop_by_code: {
        Args: { p_code: string }
        Returns: {
          message: string
          session_id: string
          status: string
          success: boolean
        }[]
      }
      leave_coop_session: {
        Args: { p_session_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      patch_coop_session_state: {
        Args: { p_patch: Json; p_session_id: string }
        Returns: {
          message: string
          state: Json
          success: boolean
        }[]
      }
      publish_song: {
        Args: {
          p_audio_url: string
          p_collaborator_ids?: string[]
          p_song_id: string
        }
        Returns: {
          daily_cap: number
          message: string
          new_energy: number
          new_level: number
          new_xp: number
          publication_id: string
          publications_today: number
          success: boolean
        }[]
      }
      publish_sound: {
        Args: {
          p_audio_url: string
          p_bpm?: number
          p_display_name: string
          p_glyph: string
          p_key_root?: string
          p_kind: string
          p_variant?: string
        }
        Returns: {
          daily_cap: number
          message: string
          new_energy: number
          new_level: number
          new_xp: number
          publications_today: number
          sound_id: string
          success: boolean
        }[]
      }
      rate_song: {
        Args: { p_song_id: string; p_stars: number }
        Returns: {
          daily_xp_earned: number
          new_xp: number
          xp_awarded: number
        }[]
      }
      remove_friend: {
        Args: { p_other_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      respond_friend_request: {
        Args: { p_accept: boolean; p_other_user_id: string }
        Returns: {
          message: string
          status: string
          success: boolean
        }[]
      }
      send_friend_request: {
        Args: { p_other_user_id: string }
        Returns: {
          message: string
          status: string
          success: boolean
        }[]
      }
      spend_energy: {
        Args: {
          p_cost: number
          p_energy_max?: number
          p_event_type: string
          p_regen_interval_seconds?: number
          p_target_id?: string
          p_xp?: number
        }
        Returns: {
          message: string
          new_energy: number
          new_xp: number
          success: boolean
        }[]
      }
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
