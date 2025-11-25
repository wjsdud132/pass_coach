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
    if (typeof window !== 'undefined') {
      const jobCategory = sessionStorage.getItem('jobCategory') || '';
      const jobUrl = sessionStorage.getItem('jobUrl') || '';
      const params = new URLSearchParams();
      if (jobCategory) params.set('job_category', jobCategory);
      if (jobUrl) params.set('job_url', jobUrl);
      router.push(`/text?${params.toString()}`);
    }
  };

  const handleCameraMethodClick = () => {
    if (typeof window !== 'undefined') {
      const jobCategory = sessionStorage.getItem('jobCategory') || '';
      const jobUrl = sessionStorage.getItem('jobUrl') || '';
      const params = new URLSearchParams();
      if (jobCategory) params.set('job_category', jobCategory);
      if (jobUrl) params.set('job_url', jobUrl);
      router.push(`/camera?${params.toString()}`);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="w-full max-w-4xl mx-auto px-6 py-12">
        <header className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Step 02</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">연습하고 싶은 방식을 선택하세요</h2>
          <p className="mt-4 text-lg text-slate-500">
            상황에 맞는 모드를 고르면 즉시 인터뷰 스튜디오가 준비됩니다.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-500 px-5 py-4 text-center font-semibold">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <button
            onClick={handleTextMethodClick}
            className="text-left rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg shadow-slate-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-500 flex items-center justify-center text-2xl">⌨️</div>
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-[0.3em]">Text Studio</span>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-slate-900">텍스트로 연습하기</h3>
            <p className="mt-3 text-slate-500 text-base">
              답변을 입력하면 AI가 즉시 문장 구조, 논리, 강조 포인트를 체크하고 피드백을 제공합니다.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sky-500 font-semibold">
              시작하기 <span aria-hidden="true">→</span>
            </span>
          </button>

          <button
            onClick={handleCameraMethodClick}
            className="text-left rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-lg shadow-emerald-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-500 flex items-center justify-center text-2xl">🎥</div>
              <span className="text-sm font-semibold text-emerald-400 uppercase tracking-[0.3em]">Camera Studio</span>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-slate-900">카메라로 연습하기</h3>
            <p className="mt-3 text-slate-500 text-base">
              시선 처리와 표정, 말하기 속도를 실제 면접처럼 점검해 보고 녹화 영상도 바로 확인하세요.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-emerald-500 font-semibold">
              스튜디오 입장 <span aria-hidden="true">→</span>
            </span>
          </button>
        </div>

        <button
          onClick={() => router.push('/')}
          className="mt-8 inline-flex items-center gap-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors"
        >
          ← 직군 선택으로 돌아가기
        </button>
      </div>
    </main>
  );
}
