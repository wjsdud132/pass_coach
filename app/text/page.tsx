'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Question = { type: string; question: string };

export default function TextInterviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!response.ok) {
          throw new Error(data.message || '질문 생성에 실패했습니다.');
        }

        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(''));
        setCurrentQuestionIndex(0);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
        console.error(err);
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

  const handleComplete = () => {
    // 완료 후 리포트 페이지로 이동하거나 결과 저장
    alert('면접이 완료되었습니다!');
    router.push('/');
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
        <div className="text-center">
          <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="mt-8 text-3xl font-semibold text-teal-300">
            AI가 맞춤 질문을 생성 중입니다...
          </h2>
          <p className="mt-2 text-slate-400">채용 공고 분석 및 핵심 역량 추출 중</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
        <div className="w-full max-w-lg text-center">
          <div className="bg-red-900 border border-red-700 text-red-300 p-4 mb-6 rounded-lg">
            {error}
          </div>
          <button
            onClick={() => router.push('/method-selection')}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors shadow-lg"
          >
            돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="w-full max-w-3xl">
        <h2 className="text-center text-4xl font-bold text-teal-400 mb-8">AI 모의 면접 (텍스트)</h2>
        <div className="bg-slate-800 border border-teal-700 p-8 rounded-2xl shadow-xl">
          <p className="text-md text-teal-400 font-bold mb-4 text-center">
            질문 {currentQuestionIndex + 1} / {questions.length}
          </p>
          <p className="text-3xl font-semibold mb-6 min-h-[120px] leading-relaxed text-center">
            {questions[currentQuestionIndex]?.question || '질문이 없습니다.'}
          </p>
          
          <div className="mb-6">
            <label className="block text-slate-300 text-lg font-semibold mb-3">
              답변을 입력하세요:
            </label>
            <textarea
              value={answers[currentQuestionIndex] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="여기에 답변을 입력하세요..."
              className="w-full p-4 bg-slate-700 rounded-lg text-white text-lg border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none min-h-[200px] resize-y"
            />
          </div>

          <div className="flex gap-4">
            {currentQuestionIndex > 0 && (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors shadow-lg"
              >
                이전 질문
              </button>
            )}
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors shadow-lg"
              >
                다음 질문
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors shadow-lg"
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

