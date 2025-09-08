'use client'

import { useState } from 'react'
import Navigation from '@/components/Navigation'
import HealthDashboard from '@/components/HealthDashboard'
import JobManagement from '@/components/JobManagement'
import SystemMonitoring from '@/components/SystemMonitoring'
import AdvancedUpload from '@/components/AdvancedUpload'
import Settings from '@/components/Settings'
import LegacyUpload from '@/components/LegacyUpload'

export default function Home() {
  const [currentTab, setCurrentTab] = useState('upload')

  const renderCurrentTab = () => {
    switch (currentTab) {
      case 'upload':
        return <AdvancedUpload />
      case 'jobs':
        return <JobManagement />
      case 'monitoring':
        return <SystemMonitoring />
      case 'health':
        return <HealthDashboard />
      case 'settings':
        return <Settings />
      case 'legacy':
        return <LegacyUpload />
      default:
        return <AdvancedUpload />
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      <main style={{
        backgroundColor: '#f3f4f6',
        minHeight: 'calc(100vh - 80px)'
      }}>
        {renderCurrentTab()}
      </main>
    </div>
  )
}
