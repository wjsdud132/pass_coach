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
    const question = questions[currentQuestionIndex]?.question;
    const answer = answers[currentQuestionIndex];
    if (answer.trim().length > 0 && !feedbacks[currentQuestionIndex]) {
      await generateFeedback(question, answer);
    }
    alert('면접이 완료되었습니다!');
    router.push('/');
  };

  // 로딩 및 에러 화면은 동일...

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="w-full max-w-3xl">
        <h2 className="text-center text-4xl font-bold text-teal-400 mb-8">AI 모의 면접 (텍스트)</h2>
        <div className="bg-slate-800 border border-teal-700 p-8 rounded-2xl shadow-xl">
          <p className="text-md text-teal-400 font-bold mb-4 text-center">
            질문 {currentQuestionIndex + 1} / {questions.length}
          </p>
          <p className="text-3xl font-semibold mb-6 text-center">
            {questions[currentQuestionIndex]?.question || '질문이 없습니다.'}
          </p>

          <textarea
            value={answers[currentQuestionIndex] || ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="여기에 답변을 입력하세요..."
            className="w-full p-4 bg-slate-700 rounded-lg text-white text-lg border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none min-h-[200px]"
          />

          {/* ✅ AI 피드백 영역 */}
          {isFeedbackLoading ? (
            <p className="mt-4 text-teal-300 text-center animate-pulse">
              AI가 답변 피드백을 분석 중입니다...
            </p>
          ) : feedbacks[currentQuestionIndex] ? (
            <div className="mt-6 bg-slate-700 border border-teal-600 rounded-lg p-4">
              <h3 className="text-teal-400 font-semibold mb-2">💡 AI 피드백</h3>
              <p className="text-slate-200 whitespace-pre-line">
                {feedbacks[currentQuestionIndex]}
              </p>
            </div>
          ) : null}

          <div className="flex gap-4 mt-6">
            {currentQuestionIndex > 0 && (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg text-xl"
              >
                이전 질문
              </button>
            )}
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg text-xl"
              >
                다음 질문
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl"
              >
                면접 완료
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
