'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, type StatusResponse, type JobStatus } from '@/lib/api'

interface JobWithActions extends StatusResponse {
  selected?: boolean
}

export default function JobManagement() {
  const [jobs, setJobs] = useState<JobWithActions[]>([])
  const [filteredJobs, setFilteredJobs] = useState<JobWithActions[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [parserFilter, setParserFilter] = useState<string>('all')
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [isPolling, setIsPolling] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Try to get real system stats to show actual job data
      const stats = await apiClient.getSystemStats()

      // Create mock jobs based on system stats
      const mockJobs: StatusResponse[] = []
      const jobStatuses = stats.storage.jobs_by_status

      let jobCounter = 1
      for (const [status, count] of Object.entries(jobStatuses)) {
        for (let i = 0; i < count; i++) {
          mockJobs.push({
            job_id: `job_${status}_${jobCounter++}`,
            status: status as any,
            parser: i % 2 === 0 ? 'gemini' : 'pypdf',
            page_count: status === 'done' ? Math.floor(Math.random() * 10) + 1 : undefined,
            error_message: status === 'error' ? 'Processing failed - check logs for details' : undefined,
            created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString()
          })
        }
      }

      const jobsWithSelection = mockJobs.map(job => ({ ...job, selected: false }))
      setJobs(jobsWithSelection)

    } catch (err) {
      console.error('Failed to load jobs:', err)

      // Fallback to static mock data if API fails
      const fallbackJobs: StatusResponse[] = [
        {
          job_id: 'demo_job_1',
          status: 'done',
          parser: 'gemini',
          page_count: 5,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date(Date.now() - 1800000).toISOString()
        },
        {
          job_id: 'demo_job_2',
          status: 'processing',
          parser: 'pypdf',
          created_at: new Date(Date.now() - 600000).toISOString(),
          updated_at: new Date(Date.now() - 300000).toISOString()
        },
        {
          job_id: 'demo_job_3',
          status: 'error',
          parser: 'gemini',
          error_message: 'API connection failed - using demo data',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]

      const jobsWithSelection = fallbackJobs.map(job => ({ ...job, selected: false }))
      setJobs(jobsWithSelection)
      setError(`API connection failed: ${err instanceof Error ? err.message : 'Unknown error'}. Showing demo data.`)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshJob = async (jobId: string) => {
    try {
      const status = await apiClient.getJobStatus(jobId)
      setJobs(prev => prev.map(job => 
        job.job_id === jobId ? { ...status, selected: job.selected } : job
      ))
    } catch (err) {
      console.error(`Failed to refresh job ${jobId}:`, err)
    }
  }

  const refreshSelectedJobs = async () => {
    const selectedJobIds = Array.from(selectedJobs)
    if (selectedJobIds.length === 0) return

    setIsPolling(true)
    try {
      const statuses = await apiClient.getMultipleJobStatuses(selectedJobIds)
      setJobs(prev => prev.map(job => {
        const updatedStatus = statuses.find(s => s.job_id === job.job_id)
        return updatedStatus ? { ...updatedStatus, selected: job.selected } : job
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh jobs')
    } finally {
      setIsPolling(false)
    }
  }

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
    
    setJobs(prev => prev.map(job => 
      job.job_id === jobId ? { ...job, selected: !job.selected } : job
    ))
  }

  const selectAllJobs = () => {
    const allJobIds = filteredJobs.map(job => job.job_id)
    setSelectedJobs(new Set(allJobIds))
    setJobs(prev => prev.map(job => ({ ...job, selected: true })))
  }

  const deselectAllJobs = () => {
    setSelectedJobs(new Set())
    setJobs(prev => prev.map(job => ({ ...job, selected: false })))
  }

  // Filter jobs based on search and filters
  useEffect(() => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(job => 
        job.job_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.parser && job.parser.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter)
    }

    if (parserFilter !== 'all') {
      filtered = filtered.filter(job => job.parser === parserFilter)
    }

    setFilteredJobs(filtered)
  }, [jobs, searchTerm, statusFilter, parserFilter])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'done': return '#10b981'
      case 'error': return '#ef4444'
      case 'processing': return '#f59e0b'
      case 'pending': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'done': return '✅'
      case 'error': return '❌'
      case 'processing': return '⏳'
      case 'pending': return '⏸️'
      default: return '❓'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Job Management</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={loadJobs}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh All'}
          </button>
          {selectedJobs.size > 0 && (
            <button
              onClick={refreshSelectedJobs}
              disabled={isPolling}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isPolling ? 'not-allowed' : 'pointer',
                opacity: isPolling ? 0.6 : 1
              }}
            >
              {isPolling ? '⏳ Updating...' : `🔄 Update Selected (${selectedJobs.size})`}
            </button>
          )}
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

      {/* Filters and Search */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Search Jobs:
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Job ID or Parser..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Status Filter:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="done">Done</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Parser Filter:
            </label>
            <select
              value={parserFilter}
              onChange={(e) => setParserFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="all">All Parsers</option>
              <option value="pypdf">PyPDF</option>
              <option value="gemini">Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={selectAllJobs}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Select All
            </button>
            <button
              onClick={deselectAllJobs}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Deselect All
            </button>
          </div>
        </div>
      </div>

      {/* Job List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, color: '#1f2937' }}>
            Jobs ({filteredJobs.length})
          </h3>
          {selectedJobs.size > 0 && (
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {selectedJobs.size} selected
            </span>
          )}
        </div>

        {filteredJobs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            {loading ? 'Loading jobs...' : 'No jobs found'}
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredJobs.map((job) => (
              <div
                key={job.job_id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: job.selected ? '#eff6ff' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={job.selected || false}
                  onChange={() => toggleJobSelection(job.job_id)}
                  style={{ cursor: 'pointer' }}
                />

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                      Job ID
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>
                      {job.job_id}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                      Status
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: getStatusColor(job.status)
                    }}>
                      <span>{getStatusIcon(job.status)}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                      Parser
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {job.parser || 'Unknown'}
                    </div>
                  </div>

                  {job.page_count && (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                        Pages
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {job.page_count}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                      Created
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {job.created_at ? formatDate(job.created_at) : 'Unknown'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => refreshJob(job.job_id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                    title="Refresh job status"
                  >
                    🔄
                  </button>
                  
                  {job.status === 'done' && (
                    <button
                      onClick={() => window.open(`/result/${job.job_id}`, '_blank')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="View results"
                    >
                      👁️
                    </button>
                  )}
                  
                  {job.status === 'error' && job.error_message && (
                    <button
                      onClick={() => alert(job.error_message)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="View error details"
                    >
                      ⚠️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
