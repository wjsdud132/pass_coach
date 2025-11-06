'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MethodSelectionPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // sessionStorage에서 직군 정보 확인
    if (typeof window !== 'undefined') {
      const jobCategory = sessionStorage.getItem('jobCategory');
      const jobUrl = sessionStorage.getItem('jobUrl');
      if (!jobCategory && !jobUrl) {
        // 정보가 없으면 메인으로 리다이렉트
        router.push('/');
      }
    }
  }, [router]);

  const handleTextMethodClick = () => {
    router.push('/text');
  };

  const handleCameraMethodClick = () => {
    router.push('/camera');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="w-full max-w-lg text-center">
        <h2 className="text-4xl font-bold text-teal-400 mb-8">답변 방식을 선택하세요</h2>
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 p-4 mb-6 rounded-lg">
            {error}
          </div>
        )}
        <div className="bg-slate-800 border border-teal-800 p-8 rounded-2xl shadow-xl space-y-6">
          <button
            onClick={handleTextMethodClick}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-lg text-xl transition-colors shadow-lg"
          >
            텍스트로 하기
          </button>
          <button
            onClick={handleCameraMethodClick}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-lg text-xl transition-colors shadow-lg border border-slate-600"
          >
            카메라로 하기
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg text-lg transition-colors"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    </main>
  );
}
