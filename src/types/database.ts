export interface Profile {
  user_id: string
  full_name: string
  school: string
  year_level: string
  workplace: string
  profile_picture_url: string | null
}

export interface OjtSetup {
  user_id: string
  required_hours: number
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
}

export interface Session {
  id: string
  user_id: string
  date: string          // YYYY-MM-DD
  start_time: string    // HH:MM:SS
  end_time: string | null  // HH:MM:SS or null if in-progress
  duration: number      // minutes
  total_hours: number   // float
  description: string | null
  journal: string | null
  report_images: string[] | null
  created_at: string
  updated_at: string
}

export interface Break {
  id: string
  session_id: string
  start_time: string    // HH:MM:SS
  end_time: string | null  // HH:MM:SS
  duration: number      // minutes
  created_at: string
  updated_at: string
}

export interface SessionWithBreaks extends Session {
  breaks: Break[]
}

// Supabase Database type for typed client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Profile
        Update: Partial<Profile>
      }
      ojt_setup: {
        Row: OjtSetup
        Insert: OjtSetup
        Update: Partial<OjtSetup>
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Session, 'id' | 'created_at' | 'updated_at'>>
      }
      breaks: {
        Row: Break
        Insert: Omit<Break, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Break, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
