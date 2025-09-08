'use client'

import { useState, useEffect } from 'react'
import { apiClient, type SystemStats } from '@/lib/api'

interface MetricCardProps {
  title: string
  value: string | number
  icon: string
  color?: string
  subtitle?: string
}

function MetricCard({ title, value, icon, color = '#3b82f6', subtitle }: MetricCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: `3px solid ${color}`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

interface SimpleChartProps {
  data: Array<{ label: string; value: number; color: string }>
  title: string
}

function SimpleChart({ data, title }: SimpleChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937', textAlign: 'center' }}>{title}</h3>
      
      {/* Simple bar chart */}
      <div style={{ marginBottom: '1rem' }}>
        {data.map((item, index) => (
          <div key={index} style={{ marginBottom: '0.5rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.25rem',
              fontSize: '0.875rem'
            }}>
              <span style={{ color: '#1f2937', fontWeight: 'bold' }}>{item.label}</span>
              <span style={{ color: '#6b7280' }}>{item.value}</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: total > 0 ? `${(item.value / total) * 100}%` : '0%',
                height: '100%',
                backgroundColor: item.color,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        justifyContent: 'center',
        fontSize: '0.75rem'
      }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: item.color,
              borderRadius: '2px'
            }} />
            <span style={{ color: '#6b7280' }}>
              {item.label}: {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SystemMonitoring() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchStats = async () => {
    try {
      setError(null)
      console.log('Fetching system stats...')
      const data = await apiClient.getSystemStats()
      console.log('System stats received:', data)
      setStats(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch system stats:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system stats'
      setError(`${errorMessage}. Please ensure the backend server is running on http://localhost:8000`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(fetchStats, 10000) // Update every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
        <p>Loading system monitoring data...</p>
      </div>
    )
  }

  const jobStatusData = stats?.storage.jobs_by_status ? Object.entries(stats.storage.jobs_by_status).map(([status, count]) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: status === 'done' ? '#10b981' : 
           status === 'error' ? '#ef4444' : 
           status === 'processing' ? '#f59e0b' : '#6b7280'
  })) : []

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>System Monitoring</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (10s)
          </label>
          {lastUpdate && (
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStats}
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

      {stats && (
        <>
          {/* Key Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <MetricCard
              title="Total Jobs"
              value={stats.storage.total_jobs}
              icon="📋"
              color="#3b82f6"
              subtitle="All time"
            />
            
            <MetricCard
              title="Redis Memory"
              value={stats.storage.redis_memory_used}
              icon="💾"
              color="#8b5cf6"
              subtitle="Current usage"
            />
            
            <MetricCard
              title="Connected Clients"
              value={stats.storage.redis_connected_clients}
              icon="🔗"
              color="#10b981"
              subtitle="Active connections"
            />
            
            <MetricCard
              title="Upload Limit"
              value={`${stats.config.max_upload_mb}MB`}
              icon="📤"
              color="#f59e0b"
              subtitle="Max file size"
            />
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <SimpleChart
              title="Job Status Distribution"
              data={jobStatusData}
            />
            
            {/* Redis Info */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937', textAlign: 'center' }}>
                Redis Information
              </h3>
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Version:</span>
                  <span style={{ color: '#6b7280' }}>{stats.storage.redis_version}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Memory Used:</span>
                  <span style={{ color: '#6b7280' }}>{stats.storage.redis_memory_used}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Connected Clients:</span>
                  <span style={{ color: '#6b7280' }}>{stats.storage.redis_connected_clients}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Stream Name:</span>
                  <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{stats.config.stream_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Stream Group:</span>
                  <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{stats.config.stream_group}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Details */}
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>System Configuration</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1rem',
              fontSize: '0.875rem'
            }}>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>Upload Settings</h4>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <div><strong>Max File Size:</strong> {stats.config.max_upload_mb}MB</div>
                  <div><strong>Job TTL:</strong> {Math.round(stats.config.job_ttl_seconds / 3600)}h</div>
                </div>
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>AI Services</h4>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{stats.config.gemini_available ? '✅' : '❌'}</span>
                    <span><strong>Gemini API:</strong> {stats.config.gemini_available ? 'Available' : 'Unavailable'}</span>
                  </div>
                </div>
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>Queue Settings</h4>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <div><strong>Stream:</strong> {stats.config.stream_name}</div>
                  <div><strong>Group:</strong> {stats.config.stream_group}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div style={{
            marginTop: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              backgroundColor: stats.storage.redis_connected_clients > 0 ? '#dcfce7' : '#fef2f2',
              border: `1px solid ${stats.storage.redis_connected_clients > 0 ? '#bbf7d0' : '#fecaca'}`,
              color: stats.storage.redis_connected_clients > 0 ? '#166534' : '#dc2626',
              padding: '1rem',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Redis Connection
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {stats.storage.redis_connected_clients > 0 ? 'Healthy' : 'No Connections'}
              </div>
            </div>
            
            <div style={{
              backgroundColor: stats.config.gemini_available ? '#dcfce7' : '#fef2f2',
              border: `1px solid ${stats.config.gemini_available ? '#bbf7d0' : '#fecaca'}`,
              color: stats.config.gemini_available ? '#166534' : '#dc2626',
              padding: '1rem',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                AI Processing
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {stats.config.gemini_available ? 'Available' : 'Unavailable'}
              </div>
            </div>
            
            <div style={{
              backgroundColor: stats.storage.total_jobs > 0 ? '#dbeafe' : '#f3f4f6',
              border: `1px solid ${stats.storage.total_jobs > 0 ? '#bfdbfe' : '#d1d5db'}`,
              color: stats.storage.total_jobs > 0 ? '#1e40af' : '#6b7280',
              padding: '1rem',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Job Processing
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {stats.storage.total_jobs > 0 ? 'Active' : 'No Jobs'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
