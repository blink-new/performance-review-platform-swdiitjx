import React, { useState, useEffect, useCallback } from 'react';
import { blink } from '../blink/client';
import { Loader2, Search, User, Clock, CheckCircle, FileText, Plus } from 'lucide-react';
import ReviewComparison from './ReviewComparison';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

const ManagerView = () => {
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'review'
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [teamSessions, setTeamSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', job_title: '' });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const isSubmittingRef = React.useRef(false);

  const PREVIEW_MANAGER_ID = 'user_manager_1';

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const sessions = await blink.db.review_sessions.list({
        where: { manager_id: PREVIEW_MANAGER_ID },
      });

      if (sessions && sessions.length > 0) {
        const userIds = sessions.map(s => s.employee_id);
        const users = await blink.db.users.list({ where: { id: { in: userIds } } });
        const usersById = users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {});
        const populatedSessions = sessions.map(session => ({
          ...session,
          employee: usersById[session.employee_id]
        }));
        setTeamSessions(populatedSessions);
      } else {
        setTeamSessions([]);
      }

    } catch (error) {
      console.error("Failed to load team data:", error);
      toast.error('Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      loadTeamData();
    }
  }, [view, loadTeamData]);

  const handleOpenCreateDialog = () => {
    setNewEmployee({ name: '', email: '', job_title: '' });
    setIsCreateDialogOpen(true);
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.job_title) {
      toast.error('Name, email, and job title are required.');
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setIsCreatingEmployee(true);
    try {
      const createdUser = await blink.db.users.create({
        name: newEmployee.name,
        email: newEmployee.email,
        job_title: newEmployee.job_title,
        role: 'employee',
      });

      await blink.db.review_sessions.create({
        employee_id: createdUser.id,
        manager_id: PREVIEW_MANAGER_ID,
        status: 'pending_self_review',
      });

      toast.success('Employee created successfully!');
      setIsCreateDialogOpen(false);
      loadTeamData(); // Refresh the list
    } catch (error) {
      console.error("Failed to create employee:", error);
      toast.error('Failed to create employee. Email may already be in use.');
    } finally {
      setIsCreatingEmployee(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSelectReview = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setView('review');
  };

  const handleReturnToDashboard = () => {
    setView('dashboard');
    setSelectedSessionId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_self_review':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
            <Clock className="w-3 h-3 mr-1.5" />
            Awaiting Self-Review
          </span>
        );
      case 'pending_manager_review':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
            <FileText className="w-3 h-3 mr-1.5" />
            Self-Review Submitted
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
            <CheckCircle className="w-3 h-3 mr-1.5" />
            Fully Completed
          </span>
        );
      default:
        return null;
    }
  };

  const filteredSessions = teamSessions.filter(session =>
    session.employee?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (view === 'review' && selectedSessionId) {
    const selectedSession = teamSessions.find(s => s.id === selectedSessionId);
    return (
      <ReviewComparison
        sessionId={selectedSessionId}
        employeeName={selectedSession?.employee.name || 'Employee'}
        employeeRole={selectedSession?.employee.job_title || 'Role'}
        onReturnToDashboard={handleReturnToDashboard}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Team – Performance Review Cycle</h1>
          <p className="mt-1 text-sm text-gray-600">
            {teamSessions.filter(s => s.status === 'completed').length} of {teamSessions.length} reviews completed.
          </p>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by employee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Employee
          </Button>
        </div>

        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSessions && filteredSessions.length > 0 ? (
                  filteredSessions.map((session) => (
                    <tr key={session.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{session.employee?.name || 'Unknown User'}</div>
                            <div className="text-sm text-gray-500">{session.employee?.job_title || 'Employee'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(session.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {session.employee_submitted_at ? new Date(session.employee_submitted_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleSelectReview(session.id)}
                          disabled={session.status === 'pending_self_review'}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed font-semibold"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-500">
                      You don’t have any team members assigned for this cycle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="job_title" className="text-right">
                Job Title
              </Label>
              <Input
                id="job_title"
                value={newEmployee.job_title}
                onChange={(e) => setNewEmployee({ ...newEmployee, job_title: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleCreateEmployee}
              disabled={isCreatingEmployee}
            >
              {isCreatingEmployee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ManagerView;
