import React, { useState, useEffect, useMemo } from 'react';
import { blink } from '../blink/client';
import { Loader2, PlusCircle, Trash2, Edit, Download, Search, GripVertical, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from './ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessions, setSessions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', job_title: '', role: 'employee', manager_id: null });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    type: 'scale',
    points: 0,
    is_required: true,
    section: 1
  });
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);


  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [sessionRes, questionRes, userRes] = await Promise.all([
        blink.db.review_sessions.list(),
        blink.db.review_questions.list({ orderBy: { section: 'asc', id: 'asc' } }),
        blink.db.users.list()
      ]);
      
      const sessionsWithUserData = sessionRes.map(session => {
        const employee = userRes.find(u => u.id === session.employee_id);
        const manager = userRes.find(u => u.id === session.manager_id);
        return {
          ...session,
          employee_name: employee?.name || 'Unknown',
          manager_name: manager?.name || 'Unknown',
        };
      });

      setSessions(sessionsWithUserData);
      setQuestions(questionRes);
      setUsers(userRes);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast.error('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleOpenCreateUserDialog = () => {
    setNewUser({ name: '', email: '', job_title: '', role: 'employee', manager_id: null });
    setIsCreateUserOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.role) {
      toast.error('Name, email, and role are required.');
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setIsCreatingUser(true);
    try {
      const userData: any = {
        name: newUser.name,
        email: newUser.email,
        job_title: newUser.job_title,
        role: newUser.role,
      };

      if (newUser.role === 'employee' && newUser.manager_id) {
        userData.manager_id = newUser.manager_id;
      }

      const createdUser = await blink.db.users.create(userData);

      if (newUser.role === 'employee') {
        await blink.db.review_sessions.create({
          employee_id: createdUser.id,
          manager_id: newUser.manager_id,
          status: 'pending_self_review',
        });
      }

      toast.success('User created successfully!');
      setIsCreateUserOpen(false);
      loadAdminData();
    } catch (error) {
      console.error("Failed to create user:", error);
      toast.error('Failed to create user. Email may already be in use.');
    } finally {
      setIsCreatingUser(false);
      isSubmittingRef.current = false;
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text || !newQuestion.type) {
        toast.error('Question and type are required.');
        return;
    }
    setIsAddingQuestion(true);
    try {
      await blink.db.review_questions.create({
        ...newQuestion,
        points: Number(newQuestion.points)
      });
      toast.success('New question added!');
      setIsAddQuestionDialogOpen(false);
      loadAdminData();
    } catch (error) {
      console.error("Failed to add question:", error);
      toast.error('Failed to add new question.');
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (deletingQuestionId === id) return;
    if (window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      setDeletingQuestionId(id);
      try {
        await blink.db.review_questions.delete(id);
        toast.success('Question deleted successfully.');
        loadAdminData();
      } catch (error) {
        console.error("Failed to delete question:", error);
        toast.error('Failed to delete question.');
      } finally {
        setDeletingQuestionId(null);
      }
    }
  };

  const handleUpdateQuestion = async (id, field, value) => {
    try {
      await blink.db.review_questions.update(id, { [field]: value });
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
      toast.success('Question updated.');
    } catch (error) {
      console.error(`Failed to update question ${id}:`, error);
      toast.error('Failed to update question.');
    }
  };
  
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(session =>
        session.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(session => {
        if (statusFilter === 'all') return true;
        return session.status === statusFilter;
      });
  }, [sessions, searchTerm, statusFilter]);

  const downloadCSV = () => {
    const headers = ['Employee', 'Manager', 'Status', 'Final Score', 'Submitted At'];
    const rows = filteredSessions.map(s => [
      s.employee_name,
      s.manager_name,
      s.status,
      s.final_score || 'N/A',
      s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "performance_reviews.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV downloaded successfully!');
  };

  const summaryStats = useMemo(() => {
    if (!users || !sessions) return { totalEmployees: 0, submitted: 0, managerCompleted: 0, avgScore: 'N/A' };
    const totalEmployees = users.filter(u => u.role === 'employee').length;
    const submitted = sessions.filter(s => s.status === 'completed' || s.status === 'pending_manager_review');
    const managerCompleted = sessions.filter(s => s.status === 'completed');
    const avgScore = managerCompleted.length > 0 
      ? (managerCompleted.reduce((acc, s) => acc + (s.final_score || 0), 0) / managerCompleted.length).toFixed(1)
      : 'N/A';
    
    return {
      totalEmployees,
      submitted: submitted.length,
      managerCompleted: managerCompleted.length,
      avgScore
    };
  }, [sessions, users]);

  const renderReviewDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalEmployees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager Reviews Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.managerCompleted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgScore}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle>All Reviews</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input 
                placeholder="Search by employee..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_self_review">Pending Self-Review</SelectItem>
                  <SelectItem value="pending_manager_review">Pending Manager Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={downloadCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleOpenCreateUserDialog}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Final Score</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions && filteredSessions.length > 0 ? (
                filteredSessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.employee_name}</TableCell>
                    <TableCell><Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>{session.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>{session.final_score || 'N/A'}</TableCell>
                    <TableCell>{new Date(session.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedSession(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSession(session)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        {selectedSession && (
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Review for {selectedSession?.employee_name}</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p>Full review details would be displayed here.</p>
                            <p>Status: {selectedSession?.status}</p>
                            <p>Final Score: {selectedSession?.final_score}</p>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button type="button" variant="secondary">Close</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                        )}
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No reviews found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderFormBuilder = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Form Builder</CardTitle>
           <Dialog open={isAddQuestionDialogOpen} onOpenChange={setIsAddQuestionDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="question_text">Question</Label>
                  <Textarea id="question_text" value={newQuestion.question_text} onChange={(e) => setNewQuestion({...newQuestion, question_text: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={newQuestion.type} onValueChange={(value) => setNewQuestion({...newQuestion, type: value})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scale">Scale (1-5)</SelectItem>
                      <SelectItem value="text">Short Text</SelectItem>
                      <SelectItem value="long_text">Long Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input id="points" type="number" value={newQuestion.points} onChange={(e) => setNewQuestion({...newQuestion, points: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Select value={String(newQuestion.section)} onValueChange={(value) => setNewQuestion({...newQuestion, section: parseInt(value)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Core Competencies</SelectItem>
                      <SelectItem value="2">Goals & Deliverables</SelectItem>
                      <SelectItem value="3">Growth & Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch id="is_required" checked={newQuestion.is_required} onCheckedChange={(checked) => setNewQuestion({...newQuestion, is_required: checked})} />
                  <Label htmlFor="is_required">Required</Label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddQuestion} disabled={isAddingQuestion}>
                  {isAddingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Question
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="section-1">
            {[
              { id: 1, name: 'Core Competencies' },
              { id: 2, name: 'Goals & Deliverables' },
              { id: 3, name: 'Growth & Development' },
            ].map(section => (
              <AccordionItem value={`section-${section.id}`} key={section.id}>
                <AccordionTrigger className="text-lg font-semibold">{`Section ${section.id}: ${section.name}`}</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {questions && questions.filter(q => q.section === section.id).map(q => (
                    <div key={q.id} className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                      <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />
                      <div className="flex-grow space-y-2">
                        <Input
                          value={q.question_text}
                          onChange={(e) => handleUpdateQuestion(q.id, 'question_text', e.target.value)}
                          className="text-base"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{q.type}</Badge>
                        {q.is_required && <Badge>Required</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} disabled={deletingQuestionId === q.id}>
                        {deletingQuestionId === q.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5 text-red-500" />}
                      </Button>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`${activeTab === 'dashboard' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Review Dashboard
            </button>
            <button
              onClick={() => setActiveTab('form-builder')}
              className={`${activeTab === 'form-builder' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Form Builder
            </button>
          </nav>
        </div>

        <div>
          {activeTab === 'dashboard' ? renderReviewDashboard() : renderFormBuilder()}
        </div>
      </div>

      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="job_title" className="text-right">Job Title</Label>
              <Input id="job_title" value={newUser.job_title} onChange={(e) => setNewUser({...newUser, job_title: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUser.role === 'employee' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manager" className="text-right">Manager</Label>
                <Select value={newUser.manager_id || ''} onValueChange={(value) => setNewUser({...newUser, manager_id: value})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {users && users.filter(u => u.role === 'manager').map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminPanel;
