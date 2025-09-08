'use client'

import { useState, useEffect } from 'react'
import { apiClient, type SystemStats } from '@/lib/api'

interface SettingsState {
  // UI Settings
  autoRefresh: boolean
  refreshInterval: number
  theme: 'light' | 'dark' | 'auto'
  
  // Upload Settings
  maxFileSize: number
  allowedParsers: string[]
  defaultParser: string
  
  // Polling Settings
  jobPollingInterval: number
  maxPollingAttempts: number
  
  // Display Settings
  resultsPerPage: number
  showAdvancedOptions: boolean
  enableNotifications: boolean
}

const defaultSettings: SettingsState = {
  autoRefresh: true,
  refreshInterval: 10000,
  theme: 'light',
  maxFileSize: 25,
  allowedParsers: ['pypdf', 'gemini'],
  defaultParser: 'gemini',
  jobPollingInterval: 2000,
  maxPollingAttempts: 60,
  resultsPerPage: 10,
  showAdvancedOptions: false,
  enableNotifications: false
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load settings from localStorage and system stats
  useEffect(() => {
    const savedSettings = localStorage.getItem('documentProcessingSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
      }
    }

    // Load system stats to show current configuration
    loadSystemStats()
  }, [])

  const loadSystemStats = async () => {
    setLoading(true)
    try {
      const stats = await apiClient.getSystemStats()
      setSystemStats(stats)
    } catch (error) {
      console.error('Failed to load system stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = () => {
    setSaving(true)
    try {
      localStorage.setItem('documentProcessingSettings', JSON.stringify(settings))
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      
      // Apply settings immediately
      if (typeof window !== 'undefined') {
        // Trigger a custom event to notify other components
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }))
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    localStorage.removeItem('documentProcessingSettings')
    setMessage({ type: 'success', text: 'Settings reset to defaults' })
    setTimeout(() => setMessage(null), 3000)
  }

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleParser = (parser: string) => {
    setSettings(prev => ({
      ...prev,
      allowedParsers: prev.allowedParsers.includes(parser)
        ? prev.allowedParsers.filter(p => p !== parser)
        : [...prev.allowedParsers, parser]
    }))
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Settings & Configuration</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={resetSettings}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔄 Reset to Defaults
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: saving ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? '⏳ Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#dc2626',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* UI Settings */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>🎨 User Interface</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => updateSetting('autoRefresh', e.target.checked)}
              />
              <span style={{ fontWeight: 'bold' }}>Auto-refresh data</span>
            </label>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              Automatically refresh dashboard data
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Refresh Interval (seconds):
            </label>
            <input
              type="range"
              min="5"
              max="60"
              value={settings.refreshInterval / 1000}
              onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value) * 1000)}
              style={{ width: '100%', marginBottom: '0.25rem' }}
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {settings.refreshInterval / 1000} seconds
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Theme:
            </label>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'auto')}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => updateSetting('enableNotifications', e.target.checked)}
              />
              <span style={{ fontWeight: 'bold' }}>Enable notifications</span>
            </label>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Show browser notifications for job completion
            </p>
          </div>
        </div>

        {/* Upload Settings */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>📤 Upload Configuration</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Max File Size (MB):
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFileSize}
              onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
            {systemStats && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                Server limit: {systemStats.config.max_upload_mb}MB
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Allowed Parsers:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['pypdf', 'gemini', 'mistral'].map((parser) => (
                <label key={parser} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={settings.allowedParsers.includes(parser)}
                    onChange={() => toggleParser(parser)}
                    disabled={parser === 'mistral'}
                  />
                  <span style={{ 
                    color: parser === 'mistral' ? '#6b7280' : '#1f2937',
                    textDecoration: parser === 'mistral' ? 'line-through' : 'none'
                  }}>
                    {parser.toUpperCase()}
                    {parser === 'mistral' && ' (Not Implemented)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Default Parser:
            </label>
            <select
              value={settings.defaultParser}
              onChange={(e) => updateSetting('defaultParser', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              {settings.allowedParsers.filter(p => p !== 'mistral').map((parser) => (
                <option key={parser} value={parser}>
                  {parser.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Processing Settings */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>⚙️ Processing Settings</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Job Polling Interval (ms):
            </label>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={settings.jobPollingInterval}
              onChange={(e) => updateSetting('jobPollingInterval', parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: '0.25rem' }}
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {settings.jobPollingInterval}ms ({settings.jobPollingInterval / 1000}s)
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Max Polling Attempts:
            </label>
            <input
              type="number"
              min="10"
              max="300"
              value={settings.maxPollingAttempts}
              onChange={(e) => updateSetting('maxPollingAttempts', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Timeout after {Math.round((settings.maxPollingAttempts * settings.jobPollingInterval) / 60000)} minutes
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Results Per Page:
            </label>
            <select
              value={settings.resultsPerPage}
              onChange={(e) => updateSetting('resultsPerPage', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* System Information */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>📊 System Information</h3>
          
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading system information...</p>
          ) : systemStats ? (
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Server Upload Limit:</strong> {systemStats.config.max_upload_mb}MB
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Job TTL:</strong> {Math.round(systemStats.config.job_ttl_seconds / 3600)}h
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Redis Version:</strong> {systemStats.storage.redis_version}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Total Jobs:</strong> {systemStats.storage.total_jobs}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Gemini Available:</strong> {systemStats.config.gemini_available ? '✅ Yes' : '❌ No'}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Stream:</strong> {systemStats.config.stream_name}
              </div>
              <div>
                <strong>Group:</strong> {systemStats.config.stream_group}
              </div>
            </div>
          ) : (
            <p style={{ color: '#ef4444' }}>Failed to load system information</p>
          )}
          
          <button
            onClick={loadSystemStats}
            disabled={loading}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Advanced Options */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>🔧 Advanced Options</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={settings.showAdvancedOptions}
                onChange={(e) => updateSetting('showAdvancedOptions', e.target.checked)}
              />
              <span style={{ fontWeight: 'bold' }}>Show advanced upload options</span>
            </label>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Display technical options in upload interface
            </p>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}>
            <strong>⚠️ Note:</strong> Settings are stored locally in your browser. 
            They will be reset if you clear your browser data.
          </div>
        </div>
      </div>
    </div>
  )
}
