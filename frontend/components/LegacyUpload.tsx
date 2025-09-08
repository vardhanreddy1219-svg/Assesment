'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { apiClient, type ParserChoice, type StatusResponse, type ResultResponse } from '@/lib/api'

export default function LegacyUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [parser, setParser] = useState<ParserChoice>('pypdf')
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [result, setResult] = useState<ResultResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<number>(1)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file')
        return
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError('File size must be less than 25MB')
        return
      }
      setFile(selectedFile)
      setError(null)
      setResult(null)
      setStatus(null)
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      setError('Please select a file')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)
    setStatus(null)

    try {
      // Upload file
      const uploadResponse = await apiClient.uploadDocument(file, parser)
      console.log('Upload successful:', uploadResponse)
      
      setIsUploading(false)
      setIsProcessing(true)

      // Poll for completion
      const finalResult = await apiClient.pollJobUntilComplete(
        uploadResponse.job_id,
        (statusUpdate) => {
          setStatus(statusUpdate)
          console.log('Status update:', statusUpdate)
        }
      )

      setResult(finalResult)
      setIsProcessing(false)
      setSelectedPage(1)

    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsUploading(false)
      setIsProcessing(false)
    }
  }, [file, parser])

  const reset = useCallback(() => {
    setFile(null)
    setParser('pypdf')
    setIsUploading(false)
    setIsProcessing(false)
    setStatus(null)
    setResult(null)
    setError(null)
    setSelectedPage(1)
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ margin: '0 0 2rem 0', color: '#1f2937' }}>Simple Document Upload</h2>
      
      {/* Upload Form */}
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Select PDF File:
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading || isProcessing}
              style={{
                padding: '0.5rem',
                border: '2px dashed #d1d5db',
                borderRadius: '4px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Parser:
            </label>
            <select
              value={parser}
              onChange={(e) => setParser(e.target.value as ParserChoice)}
              disabled={isUploading || isProcessing}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="pypdf">PyPDF (Simple text extraction)</option>
              <option value="gemini">Gemini (AI-powered markdown extraction)</option>
              <option value="mistral">Mistral (Not implemented)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={!file || isUploading || isProcessing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isUploading || isProcessing ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: isUploading || isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Process Document'}
            </button>

            {(result || error) && (
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Status Display */}
      {status && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>Processing Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              backgroundColor: 
                status.status === 'done' ? '#10b981' :
                status.status === 'error' ? '#ef4444' :
                status.status === 'processing' ? '#f59e0b' : '#6b7280',
              color: 'white'
            }}>
              {status.status.toUpperCase()}
            </span>
            <span>Job ID: {status.job_id}</span>
            {status.parser && <span>Parser: {status.parser}</span>}
            {status.page_count && <span>Pages: {status.page_count}</span>}
          </div>
        </div>
      )}

      {/* Error Display */}
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

      {/* Results Display */}
      {result && (
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#1f2937' }}>Processing Results</h2>
          
          <div style={{ marginBottom: '2rem' }}>
            <p><strong>Parser:</strong> {result.parser}</p>
            <p><strong>Pages:</strong> {result.page_count}</p>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              Document Summary
            </h3>
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              <ReactMarkdown>{result.summary_md}</ReactMarkdown>
            </div>
          </div>

          {/* Page Navigation */}
          {result.per_page_markdown.length > 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: '#1f2937' }}>Page Content</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {result.per_page_markdown.map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => setSelectedPage(index + 1)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      backgroundColor: selectedPage === index + 1 ? '#2563eb' : 'white',
                      color: selectedPage === index + 1 ? 'white' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    Page {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Page Content */}
          {result.per_page_markdown.length > 0 && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              maxHeight: '600px',
              overflow: 'auto'
            }}>
              <ReactMarkdown>
                {result.per_page_markdown[selectedPage - 1]?.content_md || 'No content available'}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
