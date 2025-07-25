
import { useState, useEffect, useCallback, useMemo } from 'react';
import { blink } from '../blink/client';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Slider } from './ui/slider';
import { Textarea } from './ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Progress } from './ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Info, User, CheckCircle, Lightbulb, Loader2 } from 'lucide-react';

const PREVIEW_USER_ID = 'user_employee_1';

const ratingLabels: { [key: number]: string } = {
    1: 'Needs Improvement',
    2: 'Developing',
    3: 'Meets Expectations',
    4: 'Exceeds Expectations',
    5: 'Outstanding'
};

const growthRatingLabels: { [key: number]: string } = {
    1: 'Not Much',
    2: 'A Little',
    3: 'Moderately',
        4: 'Considerably',
    5: 'Significant Growth'
};

export default function EmployeeView() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [responses, setResponses] = useState<any>({});
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: activeSession } = await blink.db.review_sessions.list({
      where: { employee_id: PREVIEW_USER_ID, status: { _in: ['pending_self_review', 'pending_manager_review', 'completed'] } },
      limit: 1,
      orderBy: { created_at: 'desc' }
    });

    const { data: allQuestions } = await blink.db.review_questions.list({ orderBy: { sort_order: 'asc' } });
    setQuestions(allQuestions || []);

    if (activeSession && activeSession.length > 0) {
      setSession(activeSession[0]);
      const { data: savedResponses } = await blink.db.responses.list({
        where: { session_id: activeSession[0].id },
      });
      const responsesObj = savedResponses.reduce((acc: any, r: any) => {
        acc[r.question_id] = { score: r.score, response_text: r.response_text };
        return acc;
      }, {});
      setResponses(responsesObj);
    } else {
      setSession(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResponseChange = (questionId: string, value: { score?: number; response_text?: string }) => {
    setResponses((prev: any) => ({ ...prev, [questionId]: { ...prev[questionId], ...value } }));
  };

  const handleStartReview = async () => {
    setIsCreatingSession(true);
    const { data: newSession } = await blink.db.review_sessions.create({
      id: `session_${Date.now()}`.slice(0,15),
      employee_id: PREVIEW_USER_ID,
      manager_id: 'user_manager_1',
      status: 'pending_self_review',
    });
    if (newSession) {
        setSession(newSession[0]);
    }
    setIsCreatingSession(false);
  };

  const submitReview = async () => {
    setIsSubmitting(true);
    const responseList = Object.entries(responses).map(([question_id, value]: [string, any]) => ({
        session_id: session.id,
        question_id,
        score: value.score,
        response_text: value.response_text,
    }));
    
    if (responseList.length > 0) {
        await blink.db.responses.upsertMany(responseList, { onConflict: ['session_id', 'question_id'] });
    }

    await blink.db.review_sessions.update(session.id, { status: 'pending_manager_review', employee_submitted_at: new Date().toISOString() });
    setIsSubmitting(false);
    loadData(); // Refresh data to show locked view
  };

  const sections = useMemo(() => {
    return {
      'Core Competencies': questions.filter(q => q.section === 'Core Competencies'),
      'Goals and Deliverables': questions.filter(q => q.section === 'Goals and Deliverables'),
      'Growth & Development': questions.filter(q => q.section === 'Growth & Development'),
    }
  }, [questions]);

  const competencyScore = useMemo(() => {
    const competencyQuestions = sections['Core Competencies'];
    const competencyResponses = competencyQuestions.map(q => responses[q.id]?.score).filter(s => s > 0);
    if (competencyResponses.length === 0) return 0;
    const avg = competencyResponses.reduce((a, b) => a + b, 0) / competencyResponses.length;
    return parseFloat(avg.toFixed(2));
  }, [responses, sections]);

  const progress = useMemo(() => {
    const requiredQuestions = questions.filter(q => q.is_required);
    if (requiredQuestions.length === 0) return 100;
    const answeredRequired = requiredQuestions.filter(q => {
        const response = responses[q.id];
        if (!response) return false;
        if (q.type === 'rating') return response.score > 0;
        if (q.type === 'long-text' || q.type === 'short-text') return response.response_text?.trim().length > 0;
        return false;
    }).length;
    return (answeredRequired / requiredQuestions.length) * 100;
  }, [responses, questions]);

  const scoreColor = (score: number) => {
    if (score === 0) return 'text-gray-500 bg-gray-100';
    if (score >= 3.5) return 'text-green-700 bg-green-100';
    if (score >= 2.5) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64 font-semibold text-gray-500"><Loader2 className="animate-spin mr-2" />Loading Employee View...</div>;
  }

  if (!session) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-semibold mb-4">Start Your Self-Review</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">It looks like you haven't started your performance review for this cycle. Click the button below to begin.</p>
        <Button onClick={handleStartReview} disabled={isCreatingSession} size="lg">
          {isCreatingSession ? <><Loader2 className="animate-spin mr-2" />Creating Session...</> : 'Start Self-Review'}
        </Button>
      </div>
    );
  }
  
  const isSubmitted = session.status !== 'pending_self_review';
  const allRequiredAnswered = progress === 100;

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="sticky top-16 bg-white/90 backdrop-blur-sm py-4 z-10 mb-8 border-b">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Employee Performance Review</h1>
            <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-500 font-medium">View as: Employee</span>
            </div>
        </div>
        <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-gray-500 mt-1 text-right">Form Progress: {Math.round(progress)}%</p>
        </div>
      </div>

      {isSubmitted && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-md mb-8 flex items-center shadow-sm">
            <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0"/>
            <div>
                <p className="font-bold">Submitted on {new Date(session.employee_submitted_at).toLocaleDateString()}</p>
                <p className="text-sm">Your self-review is complete. You can no longer make changes.</p>
            </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Section 1 */}
        <Card className={isSubmitted ? 'bg-gray-50' : ''}>
          <CardHeader>
            <CardTitle className="text-xl">Section 1: Core Competencies</CardTitle>
            <CardDescription>Rate yourself on the following skills using a 1–5 scale. Feel free to add comments to give context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections['Core Competencies'].map(q => (
              <div key={q.id} className="p-4 border rounded-lg bg-white">
                <label className="font-semibold text-gray-800">{q.question_text}</label>
                <div className="mt-4">
                  <Slider
                    disabled={isSubmitted}
                    value={[responses[q.id]?.score || 0]}
                    onValueChange={([val]) => handleResponseChange(q.id, { score: val })}
                    max={5} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                      {Object.entries(ratingLabels).map(([key, label]) => <span key={key}>{label}</span>)}
                  </div>
                </div>
                <Textarea
                  disabled={isSubmitted}
                  value={responses[q.id]?.response_text || ''}
                  onChange={(e) => handleResponseChange(q.id, { response_text: e.target.value })}
                  placeholder="Optional: Add context or examples"
                  className="mt-4 text-sm"
                />
              </div>
            ))}
            <div className="p-4 border-2 border-dashed rounded-lg text-center mt-6">
                <p className="text-sm font-medium text-gray-600">Your Core Competency Score</p>
                <p className={`text-3xl font-bold mt-1 ${scoreColor(competencyScore)}`}>{competencyScore > 0 ? competencyScore : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2 */}
        <Card className={isSubmitted ? 'bg-gray-50' : ''}>
          <CardHeader>
            <CardTitle className="text-xl">Section 2: Goals and Deliverables</CardTitle>
            <CardDescription>Reflect on your contributions during this review period. These responses are not scored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections['Goals and Deliverables'].map(q => (
              <div key={q.id}>
                <label className="font-semibold text-gray-800">{q.question_text}</label>
                <Textarea
                  disabled={isSubmitted}
                  value={responses[q.id]?.response_text || ''}
                  onChange={(e) => handleResponseChange(q.id, { response_text: e.target.value })}
                  maxLength={500}
                  className="mt-2 min-h-[100px]"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{responses[q.id]?.response_text?.length || 0} / 500</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 3 */}
        <Card className={isSubmitted ? 'bg-gray-50' : ''}>
          <CardHeader>
            <CardTitle className="text-xl">Section 3: Growth & Development</CardTitle>
            <CardDescription>This section helps you think ahead. Tell us how you’ve grown and what support you need to keep growing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections['Growth & Development'].map(q => (
              <div key={q.id}>
                <label className="font-semibold text-gray-800">{q.question_text}</label>
                {q.type === 'rating' ? (
                  <div className="mt-3">
                    <Slider
                      disabled={isSubmitted}
                      value={[responses[q.id]?.score || 0]}
                      onValueChange={([val]) => handleResponseChange(q.id, { score: val })}
                      max={5} step={1} className="w-full" />
                    <div className="text-center mt-2 font-medium text-sm text-blue-600">
                      {growthRatingLabels[responses[q.id]?.score] || 'Select a rating'}
                    </div>
                  </div>
                ) : (
                  <Textarea
                    disabled={isSubmitted}
                    value={responses[q.id]?.response_text || ''}
                    onChange={(e) => handleResponseChange(q.id, { response_text: e.target.value })}
                    maxLength={500}
                    className="mt-2 min-h-[100px]"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {!isSubmitted && allRequiredAnswered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t z-20">
            <div className="max-w-4xl mx-auto flex justify-end items-center p-4">
                <p className="text-sm text-gray-700 font-medium mr-4">You’ve completed all required sections—ready to submit?</p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="lg" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="animate-spin mr-2" />Submitting...</> : 'Submit Self-Review'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You won’t be able to make changes after submitting your self-review. This action is final.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={submitReview} className="bg-green-600 hover:bg-green-700">Yes, Submit</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
      )}
    </div>
  );
}
