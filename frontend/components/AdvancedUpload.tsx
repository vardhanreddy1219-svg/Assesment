'use client'

import { useState, useCallback, useRef } from 'react'
import { apiClient, type ParserChoice, type ParserComparison, type BatchUploadResponse } from '@/lib/api'

interface UploadMode {
  id: 'single' | 'batch' | 'compare'
  name: string
  description: string
  icon: string
}

const uploadModes: UploadMode[] = [
  {
    id: 'single',
    name: 'Single Upload',
    description: 'Upload one document with selected parser',
    icon: '📄'
  },
  {
    id: 'batch',
    name: 'Batch Upload',
    description: 'Upload multiple documents with same parser',
    icon: '📚'
  },
  {
    id: 'compare',
    name: 'Parser Comparison',
    description: 'Compare results from different parsers',
    icon: '⚖️'
  }
]

export default function AdvancedUpload() {
  const [mode, setMode] = useState<'single' | 'batch' | 'compare'>('single')
  const [files, setFiles] = useState<File[]>([])
  const [parser, setParser] = useState<ParserChoice>('gemini')
  const [selectedParsers, setSelectedParsers] = useState<ParserChoice[]>(['pypdf', 'gemini'])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    )
    
    if (mode === 'single' && droppedFiles.length > 0) {
      setFiles([droppedFiles[0]])
    } else {
      setFiles(prev => [...prev, ...droppedFiles])
    }
  }, [mode])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    )
    
    if (mode === 'single' && selectedFiles.length > 0) {
      setFiles([selectedFiles[0]])
    } else {
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setResults(null)
    setError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    setResults(null)

    try {
      switch (mode) {
        case 'single':
          const singleResult = await apiClient.uploadDocument(files[0], parser)
          const finalResult = await apiClient.pollJobUntilComplete(singleResult.job_id)
          setResults(finalResult)
          break

        case 'batch':
          const batchResult = await apiClient.uploadMultipleDocuments(files, parser)
          setResults(batchResult)
          break

        case 'compare':
          if (files.length > 0) {
            const comparison = await apiClient.compareParserResults(files[0], selectedParsers)
            setResults(comparison)
          }
          break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const toggleParser = (parserChoice: ParserChoice) => {
    setSelectedParsers(prev => 
      prev.includes(parserChoice)
        ? prev.filter(p => p !== parserChoice)
        : [...prev, parserChoice]
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ margin: '0 0 2rem 0', color: '#1f2937' }}>Advanced Document Upload</h2>

      {/* Upload Mode Selection */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {uploadModes.map((uploadMode) => (
          <button
            key={uploadMode.id}
            onClick={() => {
              setMode(uploadMode.id)
              setFiles([])
              setResults(null)
              setError(null)
            }}
            style={{
              padding: '1.5rem',
              backgroundColor: mode === uploadMode.id ? '#eff6ff' : 'white',
              border: `2px solid ${mode === uploadMode.id ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{uploadMode.icon}</span>
              <h3 style={{ margin: 0, color: '#1f2937' }}>{uploadMode.name}</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              {uploadMode.description}
            </p>
          </button>
        ))}
      </div>

      {/* Parser Selection */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Parser Configuration</h3>
        
        {mode === 'compare' ? (
          <div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Select parsers to compare (minimum 2):
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(['pypdf', 'gemini', 'mistral'] as ParserChoice[]).map((parserChoice) => (
                <label key={parserChoice} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedParsers.includes(parserChoice)}
                    onChange={() => toggleParser(parserChoice)}
                  />
                  <span style={{ 
                    fontSize: '0.875rem',
                    color: parserChoice === 'mistral' ? '#6b7280' : '#1f2937',
                    textDecoration: parserChoice === 'mistral' ? 'line-through' : 'none'
                  }}>
                    {parserChoice.toUpperCase()}
                    {parserChoice === 'mistral' && ' (Not Implemented)'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Select parser for {mode === 'batch' ? 'all documents' : 'document'}:
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(['pypdf', 'gemini', 'mistral'] as ParserChoice[]).map((parserChoice) => (
                <label key={parserChoice} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="parser"
                    value={parserChoice}
                    checked={parser === parserChoice}
                    onChange={(e) => setParser(e.target.value as ParserChoice)}
                    disabled={parserChoice === 'mistral'}
                  />
                  <span style={{ 
                    fontSize: '0.875rem',
                    color: parserChoice === 'mistral' ? '#6b7280' : '#1f2937',
                    textDecoration: parserChoice === 'mistral' ? 'line-through' : 'none'
                  }}>
                    {parserChoice.toUpperCase()}
                    {parserChoice === 'mistral' && ' (Not Implemented)'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div
        style={{
          backgroundColor: dragActive ? '#eff6ff' : 'white',
          border: `2px dashed ${dragActive ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: '3rem',
          textAlign: 'center',
          marginBottom: '2rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={mode !== 'single'}
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {dragActive ? '📥' : '📄'}
        </div>
        
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
          {dragActive ? 'Drop files here' : 'Upload PDF Documents'}
        </h3>
        
        <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
          {mode === 'single' 
            ? 'Click to select or drag and drop a PDF file'
            : 'Click to select or drag and drop PDF files'
          }
        </p>
        
        <button
          type="button"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Select Files
        </button>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#1f2937' }}>
              Selected Files ({files.length})
            </h3>
            <button
              onClick={clearFiles}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Clear All
            </button>
          </div>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button
            onClick={handleUpload}
            disabled={uploading || (mode === 'compare' && selectedParsers.length < 2)}
            style={{
              padding: '1rem 2rem',
              backgroundColor: uploading ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              opacity: uploading || (mode === 'compare' && selectedParsers.length < 2) ? 0.6 : 1
            }}
          >
            {uploading ? (
              <>⏳ {mode === 'compare' ? 'Comparing...' : mode === 'batch' ? 'Uploading...' : 'Processing...'}</>
            ) : (
              <>🚀 {mode === 'compare' ? 'Compare Parsers' : mode === 'batch' ? 'Upload All' : 'Process Document'}</>
            )}
          </button>
          
          {mode === 'compare' && selectedParsers.length < 2 && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#ef4444' }}>
              Please select at least 2 parsers for comparison
            </p>
          )}
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
      {results && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Results</h3>
          
          {mode === 'single' && (
            <div>
              <p><strong>Job ID:</strong> {results.job_id}</p>
              <p><strong>Parser:</strong> {results.parser}</p>
              <p><strong>Pages:</strong> {results.page_count}</p>
              <div style={{ marginTop: '1rem' }}>
                <h4>Summary:</h4>
                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {results.summary_md}
                </div>
              </div>
            </div>
          )}
          
          {mode === 'batch' && (
            <div>
              <p><strong>Total Files:</strong> {results.total_files}</p>
              <p><strong>Message:</strong> {results.message}</p>
              <div style={{ marginTop: '1rem' }}>
                <h4>Upload Results:</h4>
                {results.jobs.map((job: any, index: number) => (
                  <div key={index} style={{ 
                    padding: '0.5rem', 
                    backgroundColor: job.job_id ? '#dcfce7' : '#fef2f2',
                    borderRadius: '4px',
                    marginBottom: '0.5rem'
                  }}>
                    <strong>{job.filename}:</strong> {job.job_id ? `Job ${job.job_id}` : job.error}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {mode === 'compare' && (
            <div>
              <p><strong>File:</strong> {results.filename}</p>
              <div style={{ marginTop: '1rem' }}>
                <h4>Parser Comparison:</h4>
                {Object.entries(results.results).map(([parser, result]: [string, any]) => (
                  <div key={parser} style={{
                    padding: '1rem',
                    backgroundColor: result.status === 'done' ? '#dcfce7' : '#fef2f2',
                    borderRadius: '4px',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>{parser.toUpperCase()}</h5>
                    {result.status === 'done' ? (
                      <div>
                        <p><strong>Pages:</strong> {result.page_count}</p>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Summary: {result.summary_md?.substring(0, 200)}...
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: '#dc2626' }}><strong>Error:</strong> {result.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
