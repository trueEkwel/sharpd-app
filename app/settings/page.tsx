'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Avatar } from '@/components/Avatar'

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [form, setForm] = useState({ username: '', display_name: '', bio: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        setAvatarUrl(profile.avatar_url ?? null)
        setForm({ username: profile.username || '', display_name: profile.display_name || '', bio: profile.bio || '' })
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { setMessage('Image must be under 2MB.'); setIsError(true); return }
    setUploading(true)
    setMessage('')
    const path = `${userId}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { setMessage(uploadError.message); setIsError(true); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(`${publicUrl}?v=${Date.now()}`)
    setMessage('Avatar updated successfully.')
    setIsError(false)
    setUploading(false)
    e.target.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (form.username) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', form.username).neq('id', user.id).single()
      if (existing) { setMessage('This username is already taken.'); setIsError(true); setSaving(false); return }
    }
    const { error } = await supabase.from('profiles').update({ username: form.username, display_name: form.display_name || form.username, bio: form.bio || null }).eq('id', user.id)
    if (error) { setMessage(error.message); setIsError(true) }
    else { setMessage('Profile updated successfully.'); setIsError(false) }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '100px 24px 60px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Account</div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Profile Settings</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Your public profile is visible to everyone on Sharpd.</p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar url={avatarUrl} username={form.username || '?'} size={80} />
                <div
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
                >
                  <span style={{ color: '#fff', fontSize: '10px', fontFamily: 'var(--font-geist-mono)', letterSpacing: '.06em' }}>EDIT</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Profile Picture</div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.6', margin: 0 }}>
                  Click to upload · Max 2MB<br />JPG, PNG or WebP
                </p>
                {uploading && <div style={{ fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--font-geist-mono)', marginTop: '6px' }}>Uploading...</div>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Username</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', fontFamily: 'var(--font-geist-mono)', fontSize: '14px' }}>@</span>
                <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="username" maxLength={30} style={{ ...inputStyle, paddingLeft: '28px' }} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '5px', fontFamily: 'var(--font-geist-mono)' }}>
                Only letters, numbers and underscores. Your URL: sharpd.bet/u/{form.username || 'username'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Display Name <span style={{ color: 'var(--dim)' }}>(optional)</span></label>
              <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="Your name" maxLength={50} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Bio <span style={{ color: 'var(--dim)' }}>(optional)</span></label>
              <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Tell people about your betting style..." maxLength={160} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
              <p style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '5px', fontFamily: 'var(--font-geist-mono)' }}>{form.bio.length}/160</p>
            </div>
          </div>

          {message && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: isError ? 'rgba(248,113,113,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${isError ? 'rgba(248,113,113,0.25)' : 'rgba(34,197,94,0.25)'}`, color: isError ? 'var(--red)' : 'var(--green)' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn-submit" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <Link href="/dashboard" style={{ padding: '12px 20px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '10px', fontSize: '14px', color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px',
  fontFamily: 'var(--font-geist-mono)', letterSpacing: '.03em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: '10px', color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-geist)',
}
