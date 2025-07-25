import { useState } from 'react'
import { Users, Briefcase, Shield, Menu, X } from 'lucide-react'
import EmployeeView from './EmployeeView'
import ManagerView from './ManagerView'
import AdminPanel from './AdminPanel'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet'

type View = 'employee' | 'manager' | 'admin'

export default function Dashboard() {
  const [activeView, setActiveView] = useState<View>('employee')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const renderView = () => {
    switch (activeView) {
      case 'employee':
        return <EmployeeView />
      case 'manager':
        return <ManagerView />
      case 'admin':
        return <AdminPanel />
      default:
        return <EmployeeView />
    }
  }

  const navItems = [
    { id: 'employee', label: 'Employee View', icon: Users },
    { id: 'manager', label: 'Manager View', icon: Briefcase },
    { id: 'admin', label: 'Admin View', icon: Shield },
  ]

  const NavButton = ({ view, label, icon: Icon }: { view: View; label: string; icon: React.ElementType }) => (
    <Button
      variant="ghost"
      onClick={() => {
        setActiveView(view)
        setIsMobileMenuOpen(false)
      }}
      className={`w-full justify-start sm:w-auto sm:justify-center text-sm font-medium transition-all duration-200 ease-in-out ${
        activeView === view
          ? 'text-primary bg-blue-50'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Briefcase className="h-6 w-6 text-primary" />
              <h1 className="ml-3 text-lg font-bold text-gray-800">
                Performance Review Portal
              </h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center space-x-2">
              {navItems.map((item) => (
                <NavButton
                  key={item.id}
                  view={item.id as View}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </nav>

            {/* Mobile Navigation */}
            <div className="sm:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-xs">
                  <div className="flex justify-between items-center p-4 border-b">
                     <h2 className="text-lg font-semibold">Menu</h2>
                     <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                       <X className="h-6 w-6" />
                     </Button>
                  </div>
                  <nav className="mt-4 flex flex-col space-y-2 px-2">
                    {navItems.map((item) => (
                      <NavButton
                        key={item.id}
                        view={item.id as View}
                        label={item.label}
                        icon={item.icon}
                      />
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderView()}
      </main>
    </div>
  )
}
