import { useState } from 'react'
import Dashboard from './components/Dashboard'
import './App.css'
import { blink } from './blink/client'

export interface User {
  id: string
  email: string
  name: string
  role: 'employee' | 'manager' | 'admin'
  manager_id?: string
}

function App() {
  const [currentView, setCurrentView] = useState<'employee' | 'manager' | 'admin'>('employee');

  // Create a dynamic mock user that changes based on the selected view.
  const mockUser: User = {
    id: `preview_user_${currentView}`,
    email: `${currentView}@example.com`,
    name: `${currentView.charAt(0).toUpperCase() + currentView.slice(1)} Preview`,
    role: currentView,
    manager_id: currentView === 'employee' ? 'preview_user_manager' : undefined,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard 
        user={mockUser} 
        blink={blink} 
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    </div>
  )
}

export default App
