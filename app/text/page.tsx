'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Question = { type: string; question: string };

export default function TextInterviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [feedbacks, setFeedbacks] = useState<string[]>([]); // ✅ 추가
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false); // ✅ 추가
  const [isCompleted, setIsCompleted] = useState(false); // 면접 완료 상태
  const [finalFeedback, setFinalFeedback] = useState<string>(''); // 종합 피드백
  const [isGeneratingFinalFeedback, setIsGeneratingFinalFeedback] = useState(false); // 종합 피드백 생성 중

  useEffect(() => {
    const loadQuestions = async () => {
      if (typeof window === 'undefined') return;

      const jobCategory = sessionStorage.getItem('jobCategory') || '';
      const jobUrl = sessionStorage.getItem('jobUrl') || '';

      if (!jobCategory && !jobUrl) {
        router.push('/');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobTitle: jobCategory, url: jobUrl }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '질문 생성 실패');

        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(''));
        setFeedbacks(new Array(data.questions.length).fill('')); // ✅ 추가
        setCurrentQuestionIndex(0);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [router]);

  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = value;
    setAnswers(newAnswers);
  };

  // ✅ AI 피드백 요청 함수
  const generateFeedback = async (question: string, answer: string) => {
    try {
      setIsFeedbackLoading(true);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });

      const data = await res.json();
      if (res.ok) {
        const newFeedbacks = [...feedbacks];
        newFeedbacks[currentQuestionIndex] = data.feedback;
        setFeedbacks(newFeedbacks);
      } else {
        throw new Error(data.error || '피드백 생성 실패');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const handleNext = async () => {
    const question = questions[currentQuestionIndex]?.question;
    const answer = answers[currentQuestionIndex];

    if (answer.trim().length > 0 && !feedbacks[currentQuestionIndex]) {
      await generateFeedback(question, answer); // ✅ 자동 피드백 생성
    }

    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleComplete = async () => {
    // 마지막 질문에 대한 피드백이 없다면 생성
    const question = questions[currentQuestionIndex]?.question;
    const answer = answers[currentQuestionIndex];
    if (answer.trim().length > 0 && !feedbacks[currentQuestionIndex]) {
      await generateFeedback(question, answer);
    }

    // 모든 질문과 답변에 대한 종합 피드백 생성
    setIsGeneratingFinalFeedback(true);
    try {
      const response = await fetch('/api/feedback-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questions: questions.map(q => q.question || q),
          answers: answers 
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setFinalFeedback(data.feedback);
        setIsCompleted(true);
      } else {
        throw new Error(data.error || '종합 피드백 생성 실패');
      }
    } catch (err) {
      console.error('종합 피드백 생성 오류:', err);
      alert('피드백 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGeneratingFinalFeedback(false);
    }
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  // 로딩 및 에러 화면
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800">
        <div className="text-center bg-white/80 border border-sky-100 rounded-3xl px-10 py-12 shadow-xl">
          <div className="w-16 h-16 border-8 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-2xl font-semibold text-slate-900">맞춤 질문을 준비 중입니다...</p>
          <p className="mt-2 text-slate-500">채용 공고에서 핵심 역량을 추출하고 있어요.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 text-slate-900 p-8">
        <div className="bg-white/90 border border-rose-100 rounded-3xl shadow-2xl px-8 py-10 max-w-lg text-center">
          <p className="text-lg font-semibold text-rose-500 mb-3">문제가 발생했어요</p>
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-8 rounded-2xl transition-colors"
          >
            메인으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  // 면접 완료 화면 (종합 피드백 표시)
  if (isCompleted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900 p-8">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Interview Complete</p>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">면접 완료! 🎉</h2>
            <p className="mt-2 text-slate-500">AI가 정리한 종합 피드백을 확인하고 다음 인터뷰를 계획해 보세요.</p>
          </div>
          <div className="bg-white border border-sky-100 rounded-3xl shadow-2xl shadow-sky-100 p-8">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">📝 종합 피드백</h3>
            {isGeneratingFinalFeedback ? (
              <div className="text-center py-8">
                <p className="text-sky-500 text-lg animate-pulse">AI가 모든 답변을 분석 중입니다...</p>
              </div>
            ) : finalFeedback ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-6">
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {finalFeedback}
                </p>
              </div>
            ) : null}
            <div className="text-center">
              <button
                onClick={handleBackToHome}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-emerald-400 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg shadow-emerald-100 hover:-translate-y-0.5 transition-all"
              >
                메인으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 일반 면접 화면
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="w-full max-w-5xl mx-auto px-6 py-12">
        <header className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Text Studio</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">AI 모의 면접 (텍스트)</h2>
          <p className="mt-4 text-lg text-slate-500">밝고 집중되는 인터페이스에서 답변을 정리하고 실시간 피드백을 받아보세요.</p>
        </header>

        <div className="bg-white/90 border border-sky-100 rounded-3xl shadow-2xl shadow-sky-100 p-8 backdrop-blur">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.3em]">Progress</p>
              <p className="text-xl font-bold text-slate-900">
                질문 {currentQuestionIndex + 1} / {questions.length}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-sm font-semibold text-slate-400">AI Tip</p>
              <p className="text-slate-500 text-sm">핵심 경험 → 역할 → 결과 순으로 정리하면 좋아요.</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-2xl p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400 mb-3">Question</p>
            <p className="text-2xl font-semibold text-slate-900 leading-relaxed">
              {questions[currentQuestionIndex]?.question || '질문이 없습니다.'}
            </p>
          </div>

          <textarea
            value={answers[currentQuestionIndex] || ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="답변을 입력하거나 포인트를 메모해 보세요."
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-800 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 outline-none min-h-[200px]"
          />

          {isFeedbackLoading ? (
            <p className="mt-4 text-sky-500 text-center animate-pulse">
              AI가 답변 피드백을 분석 중입니다...
            </p>
          ) : feedbacks[currentQuestionIndex] ? (
            <div className="mt-6 border border-emerald-100 bg-emerald-50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold mb-2">
                <span>💡</span>
                <span>AI 피드백</span>
              </div>
              <p className="text-slate-700 whitespace-pre-line">
                {feedbacks[currentQuestionIndex]}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 mt-8">
            {currentQuestionIndex > 0 && (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="flex-1 min-w-[140px] rounded-2xl border border-slate-200 bg-white py-3 text-lg font-semibold text-slate-600 hover:border-slate-300 hover:-translate-y-0.5 transition-all"
              >
                이전 질문
              </button>
            )}
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex-1 min-w-[180px] rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 text-white text-lg font-semibold py-3 shadow-lg shadow-emerald-100 hover:-translate-y-0.5 transition-all"
              >
                다음 질문
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isGeneratingFinalFeedback}
                className="flex-1 min-w-[180px] rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-lg font-semibold py-3 shadow-lg shadow-sky-100 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingFinalFeedback ? '피드백 생성 중...' : '면접 완료'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
