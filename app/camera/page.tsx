'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

type Question = { type: string; question: string };

export default function CameraInterviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideos, setRecordedVideos] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressPercentage = questions.length ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100) : 0;
  const currentQuestion = questions[currentQuestionIndex]?.question || '질문이 없습니다.';

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
        setRecordedVideos(new Array(data.questions.length).fill(''));
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

    // 카메라 초기화
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error('카메라 접근 오류:', err);
          setError('카메라 접근 권한이 필요합니다.');
        });
    }

    // 컴포넌트 언마운트 시 스트림 정리
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [router]);

  const startRecording = () => {
    if (!streamRef.current) return;

    const mediaRecorder = new MediaRecorder(streamRef.current);
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const newRecordedVideos = [...recordedVideos];
      newRecordedVideos[currentQuestionIndex] = url;
      setRecordedVideos(newRecordedVideos);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleComplete = () => {
    // 완료 후 리포트 페이지로 이동하거나 결과 저장
    alert('면접이 완료되었습니다!');
    router.push('/');
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800 p-8">
        <div className="text-center bg-white/70 backdrop-blur rounded-2xl shadow-xl px-10 py-12 border border-sky-100">
          <div className="w-16 h-16 border-8 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="mt-8 text-3xl font-semibold text-slate-800">
            AI가 맞춤 질문을 준비하고 있어요
          </h2>
          <p className="mt-3 text-slate-500">채용 공고 분석 및 핵심 역량 추출 중입니다.</p>
        </div>
      </main>
    );
  }

  if (error && !questions.length) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50 text-slate-800 p-8">
        <div className="w-full max-w-lg text-center bg-white/90 rounded-2xl border border-rose-100 shadow-xl px-8 py-10">
          <p className="text-lg font-semibold text-rose-500 mb-3">문제가 발생했어요</p>
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 mb-6 rounded-xl">
            {error}
          </div>
          <button
            onClick={() => router.push('/method-selection')}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-all shadow-md"
          >
            돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800">
      <div className="w-full max-w-6xl mx-auto px-6 py-12">
        <header className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-400">PassCoach</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3">AI 모의 면접 스튜디오</h1>
          <p className="mt-4 text-lg text-slate-500">밝고 직관적인 인터뷰 공간에서 자연스럽게 연습해 보세요.</p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-white/90 border border-sky-100 shadow-2xl shadow-sky-100 rounded-3xl p-8 backdrop-blur">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-slate-500">질문 진행 상황</span>
              <span className="text-sm font-semibold text-slate-700">
                {currentQuestionIndex + 1} / {questions.length}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-6">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-2xl p-8 mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400 mb-4">Current Question</p>
              <p className="text-2xl md:text-3xl font-semibold leading-relaxed text-slate-900 min-h-[120px]">
                {currentQuestion}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                  className="flex-1 min-w-[140px] bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-2xl shadow-sm hover:border-slate-300 hover:-translate-y-0.5 transition-all"
                >
                  이전 질문
                </button>
              )}
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="flex-1 min-w-[180px] bg-gradient-to-r from-sky-500 to-emerald-400 text-white font-semibold py-3 rounded-2xl shadow-lg shadow-emerald-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  다음 질문
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex-1 min-w-[180px] bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold py-3 rounded-2xl shadow-lg shadow-sky-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  면접 완료
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-white/80 border border-emerald-100 rounded-3xl shadow-xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-emerald-500">카메라 피드</p>
                <span className={`text-xs font-semibold ${isRecording ? 'text-rose-500' : 'text-slate-400'}`}>
                  {isRecording ? 'Recording...' : 'Preview'}
                </span>
              </div>
              <div className="bg-slate-900/5 border border-slate-100 rounded-2xl p-4 mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-2xl border border-white/40 shadow-inner"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-2xl shadow-lg shadow-rose-100 transition-all"
                  >
                    녹화 시작
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-2xl shadow-lg shadow-rose-100 transition-all animate-pulse"
                  >
                    녹화 중지
                  </button>
                )}
                <button
                  onClick={() => videoRef.current?.requestFullscreen()}
                  className="px-4 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 transition-colors"
                >
                  전체 화면
                </button>
              </div>

              {recordedVideos[currentQuestionIndex] && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-500 mb-2">내 답변 다시 보기</p>
                  <div className="rounded-2xl overflow-hidden border border-slate-100 shadow">
                    <video src={recordedVideos[currentQuestionIndex]} controls className="w-full" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-lg p-6">
              <p className="text-sm font-semibold text-slate-500 mb-4">면접 Tip</p>
              <ul className="space-y-3 text-sm text-slate-600">
                <li>∙ 핵심 경험 → 역할 → 결과 순으로 구조화해 답변하세요.</li>
                <li>∙ 답변 전 1~2초 호흡으로 시선과 톤을 안정화하세요.</li>
                <li>∙ 면접관에게 이야기하듯 자연스러운 표정과 손동작을 활용하세요.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

