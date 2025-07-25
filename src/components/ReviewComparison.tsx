import React, { useState, useEffect, useCallback } from 'react';
import { blink } from '../blink/client';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Star } from 'lucide-react';

const ReviewComparison = ({ sessionId, employeeName, employeeRole, onReturnToDashboard }) => {
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [employeeResponses, setEmployeeResponses] = useState<any>({});
  const [managerResponses, setManagerResponses] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await blink.db.review_sessions.find(sessionId);
      setSession(sessionData);

      const { data: allQuestions } = await blink.db.review_questions.list({ orderBy: { section: 'asc', id: 'asc' } });
      setQuestions(allQuestions);

      const { data: empResponses } = await blink.db.responses.list({ where: { review_session_id: sessionId } });
      const empResponsesByQuestion = empResponses.reduce((acc, r) => ({ ...acc, [r.question_id]: r }), {});
      setEmployeeResponses(empResponsesByQuestion);

      const { data: mgrResponses } = await blink.db.manager_responses.list({ where: { review_session_id: sessionId } });
      const mgrResponsesByQuestion = mgrResponses.reduce((acc, r) => ({ ...acc, [r.question_id]: r }), {});
      setManagerResponses(mgrResponsesByQuestion);

    } catch (error) {
      console.error("Failed to load review data:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManagerResponseChange = (questionId, value, field) => {
    setManagerResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
        question_id: questionId,
        review_session_id: sessionId,
      }
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Upsert manager responses
      const responsePromises = Object.values(managerResponses).map(response =>
        blink.db.manager_responses.upsert(response, { onConflict: ['review_session_id', 'question_id'] })
      );
      await Promise.all(responsePromises);

      // Update session status
      await blink.db.review_sessions.update(sessionId, { status: 'completed', manager_submitted_at: new Date().toISOString() });

      alert('Review submitted successfully!');
      onReturnToDashboard();
    } catch (error) {
      console.error("Failed to submit manager review:", error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (q) => {
    const empResponse = employeeResponses[q.id] || {};
    const mgrResponse = managerResponses[q.id] || {};

    return (
      <div key={q.id} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border-b">
        {/* Employee Side */}
        <div>
          <h4 className="font-semibold text-gray-800">{q.question_text}</h4>
          <div className="mt-2 p-3 bg-gray-50 rounded-md">
            {q.type === 'scale' && (
              <div className="flex items-center">
                <span className="font-bold text-blue-600 text-lg mr-2">{empResponse.score || 'N/A'}</span>
                <span className="text-gray-600">/ 5</span>
              </div>
            )}
            <p className="text-sm text-gray-700 mt-1 italic">{empResponse.response_text || 'No comment'}</p>
          </div>
        </div>

        {/* Manager Side */}
        <div>
          <h4 className="font-semibold text-gray-800">Manager Evaluation</h4>
          <div className="mt-2">
            {q.type === 'scale' && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Rating</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => handleManagerResponseChange(q.id, score, 'score')}
                      className={`w-10 h-10 rounded-full transition-colors ${mgrResponse.score === score ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={mgrResponse.response_text || ''}
              onChange={(e) => handleManagerResponseChange(q.id, e.target.value, 'response_text')}
              placeholder={q.type === 'scale' ? "Add a comment..." : "Your feedback..."}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
        </div>
      </div>
    );
  };

  const calculateFinalScore = () => {
    const scoredQuestions = questions.filter(q => q.type === 'scale');
    const totalScore = scoredQuestions.reduce((sum, q) => sum + (managerResponses[q.id]?.score || 0), 0);
    return scoredQuestions.length > 0 ? (totalScore / scoredQuestions.length).toFixed(1) : 'N/A';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
      <div className="max-w-4xl mx-auto">
        <button onClick={onReturnToDashboard} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Team Dashboard
        </button>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Reviewing: {employeeName}</h2>
            <p className="text-sm text-gray-500">{employeeRole}</p>
          </div>

          {/* Sections */}
          <div>
            <h3 className="p-4 bg-gray-100 text-lg font-semibold text-gray-800 border-b">Section 1: Core Competencies</h3>
                  {questions && questions.filter(q => q.section === 1).map(renderQuestion)}

            <h3 className="p-4 bg-gray-100 text-lg font-semibold text-gray-800 border-b border-t">Section 2: Goals & Deliverables</h3>
            {questions && questions.filter(q => q.section === 2).map(q => (
              <div key={q.id} className="p-4 border-b">
                <h4 className="font-semibold text-gray-800">{q.question_text}</h4>
                <p className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700 italic">{employeeResponses[q.id]?.response_text || 'No response'}</p>
              </div>
            ))}

            <h3 className="p-4 bg-gray-100 text-lg font-semibold text-gray-800 border-b border-t">Section 3: Growth & Development</h3>
            {questions && questions.filter(q => q.section === 3).map(renderQuestion)}

            <h3 className="p-4 bg-gray-100 text-lg font-semibold text-gray-800 border-b border-t">Section 4: Manager Summary & Final Assessment</h3>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Overall Summary Comment</label>
              <textarea
                placeholder="Summarize this employee’s performance, impact, and areas of focus."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={5}
                value={managerResponses['overall_comment']?.response_text || ''}
                onChange={(e) => handleManagerResponseChange('overall_comment', e.target.value, 'response_text')}
              />
              <div className="mt-4 p-4 border-t">
                <h4 className="font-semibold">Final Score: {calculateFinalScore()}</h4>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Manager Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewComparison;
