import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Document Processing Service',
  description: 'Upload and process PDF documents with AI-powered parsing and summarization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0,
        padding: 0,
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <header style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '1rem 2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              Document Processing Service
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              Upload PDF documents for AI-powered parsing and summarization
            </p>
          </header>
          
          <main style={{
            flex: 1,
            padding: '2rem',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {children}
          </main>
          
          <footer style={{
            backgroundColor: '#374151',
            color: '#d1d5db',
            padding: '1rem 2rem',
            textAlign: 'center',
            fontSize: '0.875rem'
          }}>
            <p style={{ margin: 0 }}>
              Powered by FastAPI, Redis Streams, and Google Gemini 2.0 Flash
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
