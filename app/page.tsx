'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
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
            onClick={handleMethodSelectionClick}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-lg text-xl transition-colors shadow-lg"
          >
            AI 맞춤 질문 생성하기
          </button>
        </div>
      </div>
    </main>
  );
}
