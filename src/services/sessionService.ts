/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase'
import type { Session, SessionWithBreaks } from '../types/database'

export type BreakInput = {
  start_time: string   // HH:MM:SS
  end_time: string | null
  duration: number     // minutes
}

const SessionService = {
  async getSessions(
    userId: string,
    limit = 10,
    offset = 0
  ): Promise<{ data: Session[]; count: number }> {
    const { data, error, count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: (data ?? []) as any as Session[], count: count ?? 0 }
  },

  async getSessionById(id: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as any as Session | null
  },

  async getSessionByIdWithBreaks(id: string): Promise<SessionWithBreaks | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, breaks(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as any as SessionWithBreaks | null
  },

  async getSessionsWithBreaks(
    userId: string,
    limit = 10,
    offset = 0
  ): Promise<{ data: SessionWithBreaks[]; count: number }> {
    const { data, error, count } = await supabase
      .from('sessions')
      .select('*, breaks(*)', { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: (data ?? []) as any as SessionWithBreaks[], count: count ?? 0 }
  },

  async getSessionsInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SessionWithBreaks[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, breaks(*)')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) throw error
    return (data ?? []) as any as SessionWithBreaks[]
  },

  async createManualSession(
    userId: string,
    date: string,
    timeIn: string,
    timeOut: string | null,
    totalHours: number,
    duration: number,
    notes: string | null,
    breaks: BreakInput[]
  ): Promise<Session> {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        date,
        start_time: timeIn,
        end_time: timeOut,
        duration,
        total_hours: totalHours,
        description: notes,
        journal: null,
        report_images: null,
      } as any)
      .select()
      .single()

    if (sessionError) throw sessionError
    const newSession = session as any as Session

    if (breaks.length > 0) {
      const { error: breaksError } = await supabase.from('breaks').insert(
        breaks.map((b) => ({
          session_id: newSession.id,
          start_time: b.start_time,
          end_time: b.end_time,
          duration: b.duration,
        })) as any
      )
      if (breaksError) throw breaksError
    }

    return newSession
  },

  async updateSession(
    id: string,
    updates: Partial<Omit<Session, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as any as Session
  },

  async updateSessionBreaks(id: string, breaks: BreakInput[]): Promise<void> {
    const { error: deleteError } = await supabase
      .from('breaks')
      .delete()
      .eq('session_id', id)

    if (deleteError) throw deleteError

    if (breaks.length > 0) {
      const { error: insertError } = await supabase.from('breaks').insert(
        breaks.map((b) => ({
          session_id: id,
          start_time: b.start_time,
          end_time: b.end_time,
          duration: b.duration,
        })) as any
      )
      if (insertError) throw insertError
    }
  },

  async deleteSession(id: string): Promise<void> {
    await supabase.from('breaks').delete().eq('session_id', id)
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw error
  },

  async getTotalHours(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('sessions')
      .select('total_hours')
      .eq('user_id', userId)

    if (error) throw error
    return ((data ?? []) as any as { total_hours: number }[])
      .reduce((sum, s) => sum + (s.total_hours ?? 0), 0)
  },

  async getUniqueDaysCount(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('sessions')
      .select('date')
      .eq('user_id', userId)

    if (error) throw error
    const uniqueDays = new Set(((data ?? []) as any as { date: string }[]).map((s) => s.date))
    return uniqueDays.size
  },
}

export default SessionService
