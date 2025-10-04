'use client';
import { useState } from 'react';
import Image from 'next/image';

// TypeScript 타입 정의
type Question = { type: string; question: string };
type AppState = 'main' | 'loading' | 'questions' | 'report';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('main');
  const [jobCategory, setJobCategory] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateClick = async () => {
    if (!jobCategory && !jobUrl) {
      alert('직군을 선택하시거나, 채용 공고 URL을 입력해주세요.');
      return;
    }
    setError(null);
    setAppState('loading');
    try {
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
      setCurrentQuestionIndex(0);
      setAppState('questions');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      setAppState('main');
      console.error(err);
    }
  };

  const renderScreen = () => {
    switch (appState) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="mt-8 text-3xl font-semibold text-teal-300">
              AI가 맞춤 질문을 생성 중입니다...
            </h2>
            <p className="mt-2 text-slate-400">채용 공고 분석 및 핵심 역량 추출 중</p>
          </div>
        );

      case 'questions':
        return (
          <div className="w-full max-w-3xl">
            <h2 className="text-center text-4xl font-bold text-teal-400 mb-8">AI 모의 면접</h2>
            <div className="bg-slate-800 border border-teal-700 p-8 rounded-2xl shadow-xl text-center">
              <p className="text-md text-teal-400 font-bold mb-4">
                질문 {currentQuestionIndex + 1} / {questions.length}
              </p>
              <p className="text-3xl font-semibold mb-10 min-h-[120px] leading-relaxed">
                {questions[currentQuestionIndex]?.question || '질문이 없습니다.'}
              </p>
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors shadow-lg"
                >
                  다음 질문
                </button>
              ) : (
                <button
                  onClick={() => setAppState('report')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors shadow-lg"
                >
                  면접 완료
                </button>
              )}
            </div>
          </div>
        );

      case 'report':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-green-400 mb-6">수고하셨습니다!</h2>
            <p className="mb-8 text-lg text-slate-400">
              상세 분석 리포트 기능은 정식 버전을 기대해주세요!
            </p>
            <button
              onClick={() => {
                setAppState('main');
                setJobUrl('');
                setError(null);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors shadow-lg"
            >
              처음으로 돌아가기
            </button>
          </div>
        );

      case 'main':
      default:
        return (
          <div className="w-full max-w-lg text-center">
            <Image
              src="/logo.jpg"
              alt="합격 코치 로고"
              width={100}
              height={100}
              priority
              className="mx-auto mb-4 rounded-full"
            />
            <h1 className="text-5xl font-extrabold text-white">합격 코치</h1>
            <p className="text-xl text-slate-400 mt-2 mb-8">PASS COACH</p>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-300 p-4 mb-6 rounded-lg">
                {error}
              </div>
            )}

            <div className="bg-slate-800 border border-teal-800 p-8 rounded-2xl shadow-xl space-y-6">
              <select
                value={jobCategory}
                onChange={e => setJobCategory(e.target.value)}
                className="w-full p-4 bg-slate-700 rounded-lg text-white text-lg border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none transition-colors"
              >
                <option value="">▼ 직군 직접 입력 (URL 분석 권장)</option>
                <option value="프론트엔드 개발자">프론트엔드 개발자</option>
                <option value="백엔드 개발자">백엔드 개발자</option>
                <option value="UI/UX 디자이너">UI/UX 디자이너</option>
              </select>

              <input
                type="text"
                value={jobUrl}
                onChange={e => setJobUrl(e.target.value)}
                placeholder="채용 공고 URL을 여기에 붙여넣으세요"
                className="w-full p-4 bg-slate-700 rounded-lg text-white text-lg border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none"
              />

              <button
                onClick={handleGenerateClick}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-lg text-xl transition-colors shadow-lg"
              >
                AI 맞춤 질문 생성하기
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      {renderScreen()}
    </main>
  );
}
