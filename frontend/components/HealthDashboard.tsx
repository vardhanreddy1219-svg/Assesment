'use client'

import { useState, useEffect } from 'react'
import { apiClient, type HealthResponse, type SystemStats } from '@/lib/api'

export default function HealthDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      console.log('Fetching health and stats data...')

      const [healthData, statsData] = await Promise.all([
        apiClient.getHealth().catch(err => {
          console.error('Health check failed:', err)
          throw err
        }),
        apiClient.getSystemStats().catch(err => {
          console.error('System stats failed:', err)
          throw err
        })
      ])

      console.log('Health data:', healthData)
      console.log('Stats data:', statsData)

      setHealth(healthData)
      setStats(statsData)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(`${errorMessage}. Please check that the backend server is running on http://localhost:8000`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <p>Loading health data...</p>
      </div>
    )
  }

  const getStatusColor = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? '#10b981' : '#ef4444'
    }
    return status === 'healthy' ? '#10b981' : '#ef4444'
  }

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? '✅' : '❌'
    }
    return status === 'healthy' ? '✅' : '❌'
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>System Health Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastUpdate && (
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Health Status Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Overall Health */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `3px solid ${getStatusColor(health?.status || 'unknown')}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{getStatusIcon(health?.status || 'unknown')}</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Overall Status</h3>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.25rem', 
            fontWeight: 'bold',
            color: getStatusColor(health?.status || 'unknown')
          }}>
            {health?.status?.toUpperCase() || 'UNKNOWN'}
          </p>
          {health?.timestamp && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Server time: {new Date(health.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Redis Status */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `3px solid ${getStatusColor(health?.redis_connected || false)}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{getStatusIcon(health?.redis_connected || false)}</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Redis Database</h3>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.25rem', 
            fontWeight: 'bold',
            color: getStatusColor(health?.redis_connected || false)
          }}>
            {health?.redis_connected ? 'CONNECTED' : 'DISCONNECTED'}
          </p>
          {stats?.storage && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <p style={{ margin: '0.25rem 0' }}>Memory: {stats.storage.redis_memory_used}</p>
              <p style={{ margin: '0.25rem 0' }}>Clients: {stats.storage.redis_connected_clients}</p>
              <p style={{ margin: '0.25rem 0' }}>Version: {stats.storage.redis_version}</p>
            </div>
          )}
        </div>

        {/* Gemini API Status */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `3px solid ${getStatusColor(health?.gemini_available || false)}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{getStatusIcon(health?.gemini_available || false)}</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Gemini AI</h3>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.25rem', 
            fontWeight: 'bold',
            color: getStatusColor(health?.gemini_available || false)
          }}>
            {health?.gemini_available ? 'AVAILABLE' : 'UNAVAILABLE'}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {health?.gemini_available 
              ? 'AI parsing and summarization enabled' 
              : 'Check GEMINI_API_KEY configuration'
            }
          </p>
        </div>
      </div>

      {/* Job Statistics */}
      {stats?.storage && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>📊 Job Statistics</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {stats.storage.total_jobs}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Jobs</div>
            </div>
            {Object.entries(stats.storage.jobs_by_status).map(([status, count]) => (
              <div key={status} style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: status === 'done' ? '#10b981' : 
                        status === 'error' ? '#ef4444' : 
                        status === 'processing' ? '#f59e0b' : '#6b7280'
                }}>
                  {count}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>
                  {status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Info */}
      {stats?.config && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>⚙️ System Configuration</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            fontSize: '0.875rem'
          }}>
            <div>
              <strong>Max Upload Size:</strong> {stats.config.max_upload_mb}MB
            </div>
            <div>
              <strong>Stream Name:</strong> {stats.config.stream_name}
            </div>
            <div>
              <strong>Stream Group:</strong> {stats.config.stream_group}
            </div>
            <div>
              <strong>Job TTL:</strong> {Math.round(stats.config.job_ttl_seconds / 3600)}h
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
