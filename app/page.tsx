'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const [jobCategory, setJobCategory] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleMethodSelectionClick = () => {
    if (!jobCategory && !jobUrl) {
      alert('직군을 선택하시거나, 채용 공고 URL을 입력해주세요.');
      return;
    }
    setError(null);
    // sessionStorage에 직군 정보 저장
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('jobCategory', jobCategory);
      sessionStorage.setItem('jobUrl', jobUrl);
    }
    router.push('/method-selection');
  };

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900 flex items-center">
      <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center mb-6">
          <Image
            src="/logo.png"
            alt="합격 코치 로고"
            width={360}
            height={360}
            priority
          />
          <p className="mt-1 text-xs text-slate-500 max-w-3xl">
            채용 공고를 분석해 맞춤형 질문을 만들고, 텍스트/카메라 인터뷰를 통해 AI 피드백까지 바로 확인하세요.
          </p>
        </div>

        <section className="flex justify-center">
          <div className="w-full max-w-3xl bg-white/90 rounded-3xl border border-sky-100 shadow-2xl shadow-sky-100 p-6 lg:p-8 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.3em]">Step 01</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">직군을 선택하거나 링크를 입력하세요</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-semibold shadow-lg shadow-emerald-100">
                1
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-500 px-5 py-4 text-sm font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 mb-2">희망 직군</label>
                <div className="relative">
                  <select
                    value={jobCategory}
                    onChange={(e) => setJobCategory(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg text-slate-700 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
                  >
                    <option value="">직접 입력하거나 URL 분석을 사용해 보세요</option>
                    <option value="프론트엔드 개발자">프론트엔드 개발자</option>
                    <option value="백엔드 개발자">백엔드 개발자</option>
                    <option value="UI/UX 디자이너">UI/UX 디자이너</option>
                  </select>
                  
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-500 mb-2">채용 공고 URL</label>
                <input
                  type="text"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="채용 공고 링크를 붙여넣으면 더 정밀한 질문을 받을 수 있습니다."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg text-slate-700 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>

              <button
                onClick={handleMethodSelectionClick}
                className="w-full mt-4 bg-gradient-to-r from-sky-500 to-emerald-400 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:-translate-y-0.5 hover:shadow-xl transition-all text-lg"
              >
                AI 맞춤 질문 생성하기
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
