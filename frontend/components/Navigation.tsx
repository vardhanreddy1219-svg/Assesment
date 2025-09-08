'use client'

import { useState } from 'react'

interface NavigationProps {
  currentTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'upload', name: 'Document Upload', icon: '📄' },
  { id: 'jobs', name: 'Job Management', icon: '📋' },
  { id: 'monitoring', name: 'System Monitor', icon: '📊' },
  { id: 'health', name: 'Health Dashboard', icon: '🏥' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
]

export default function Navigation({ currentTab, onTabChange }: NavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <nav style={{
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      {/* Logo and Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ fontSize: '1.5rem' }}>🚀</div>
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: 'bold',
          display: isCollapsed ? 'none' : 'block'
        }}>
          Document Processing
        </h1>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: currentTab === tab.id ? '#3b82f6' : 'transparent',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
              ':hover': {
                backgroundColor: currentTab === tab.id ? '#2563eb' : '#374151'
              }
            }}
            onMouseEnter={(e) => {
              if (currentTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#374151'
              }
            }}
            onMouseLeave={(e) => {
              if (currentTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span>{tab.icon}</span>
            <span style={{ display: isCollapsed ? 'none' : 'inline' }}>
              {tab.name}
            </span>
          </button>
        ))}
        
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            padding: '0.5rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            marginLeft: '0.5rem'
          }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>
    </nav>
  )
}
