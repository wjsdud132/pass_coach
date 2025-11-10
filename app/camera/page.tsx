// app/camera/page.tsx

'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';

// --- 1. MediaPipe 라이브러리 import ---
import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils, // (선택 사항: 얼굴에 점을 그리려면 필요)
} from "@mediapipe/tasks-vision";

// TypeScript 타입을 미리 정의합니다.
type Question = {
  type: string;
  question: string;
};
type AppState = 'main' | 'loading' | 'questions' | 'report';

// Suspense로 감싸서 searchParams를 안전하게 사용하기 위한 컴포넌트
function CameraPageContent() {
  const videoRef = useRef<HTMLVideoElement>(null); // 비디오 태그
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- 2. AI 및 분석 루프를 위한 Ref ---
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  // 상태 관리
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(true); // AI 모델 로딩 상태

  // 실시간 점수 상태
  const [expressionScore, setExpressionScore] = useState(70);
  const [toneScore, setToneScore] = useState(60); // (음성 분석은 아직 미구현)
  const [gazeScore, setGazeScore] = useState(80);

  // --- 3. useEffect #1: 카메라 연결 ---
  useEffect(() => {
    async function setupCamera() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // 비디오가 재생될 때(stream이 연결될 때) 분석 루프를 시작하도록 이벤트 리스너 추가
            videoRef.current.addEventListener("loadeddata", startPrediction);
          }
        } catch (err) {
          console.error("카메라 접근 오류:", err);
          setError("카메라와 마이크 접근 권한을 허용해주세요.");
        }
      } else {
        setError("이 브라우저에서는 카메라 기능을 지원하지 않습니다.");
      }
    }

    setupCamera();

    // 컴포넌트가 언마운트될 때 (페이지를 나갈 때) 정리
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      // 분석 루프도 정지
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []); // 페이지가 처음 로드될 때 한 번만 실행

  // --- 4. useEffect #2: 실시간 AI 모델(MediaPipe) 로드 ---
  useEffect(() => {
    async function setupMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true, // 표정(blendshapes) 데이터 활성화
          runningMode: "VIDEO",
        });
        setIsAiLoading(false); // AI 로딩 완료
        console.log("FaceLandmarker 모델 로드 완료.");
      } catch (err) {
        console.error("MediaPipe 모델 로드 실패:", err);
        setError("AI 분석 모델을 로드하는 데 실패했습니다.");
        setIsAiLoading(false);
      }
    }

    setupMediaPipe();
  }, []); // 페이지가 처음 로드될 때 한 번만 실행

  // --- 5. 질문 로드 로직 (이전과 동일) ---
  useEffect(() => {
    const jobUrl = searchParams.get('job_url');
    const jobCategory = searchParams.get('job_category');
    // ... (이전 답변의 질문 로드 로직과 동일) ...
    // (간결함을 위해 생략, 이전 코드 그대로 사용)
  }, [searchParams]);

  // --- 6. 실시간 분석 루프 시작 함수 ---
  const startPrediction = () => {
    // AI 모델이 로드되었고, 비디오가 준비되었다면 분석 루프 시작
    if (faceLandmarkerRef.current && videoRef.current) {
      console.log("실시간 분석 루프 시작");
      predictWebcam();
    }
  };

  // --- 7. 실시간 분석 루프 (매 프레임 실행) ---
  const predictWebcam = () => {
    if (!videoRef.current || !faceLandmarkerRef.current) {
      return; // 비디오나 AI가 준비되지 않았으면 중단
    }

    const video = videoRef.current;
    if (video.currentTime === lastVideoTimeRef.current) {
      // 비디오가 멈췄거나, 새 프레임이 아니면 분석 건너뛰기
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    // AI에 현재 비디오 프레임 전달하여 분석 실행
    const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
    
    // 분석 결과로 점수 업데이트
    processResults(results.faceBlendshapes);
    
    // 다음 프레임에 대한 분석 요청
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  };

  // --- 8. 분석 결과 처리 및 점수 계산 ---
  const processResults = (blendshapes: any[]) => {
    if (!blendshapes || blendshapes.length === 0) {
      return; // 얼굴이 감지되지 않으면 종료
    }

    // MediaPipe는 얼굴 표정을 52개의 수치로 반환합니다.
    const categories = blendshapes[0]?.categories;
    if (!categories) return;

    // 간단한 미소 감지 (입꼬리 올리기)
    const smileScore = categories.find((shape: any) => shape.categoryName === 'mouthSmileLeft')?.score || 0;
    // (0 ~ 1 사이의 값) * 100
    setExpressionScore(Math.round(smileScore * 100)); 

    // 간단한 시선 감지 (눈동자 위치 - 이 예제는 단순화됨)
    // (실제 시선 감지는 'outputFacialTransformationMatrixes' 옵션이 필요하며 더 복잡합니다)
    // 여기서는 미소 점수를 시선 점수에도 임시로 반영해봅니다. (시연용)
    const gazeDemoScore = categories.find((shape: any) => shape.categoryName === 'eyeLookInLeft')?.score || 0;
    setGazeScore(Math.round((1 - gazeDemoScore) * 100)); // (안쪽을 볼수록 점수 하락)
  };


  // ... (handleNextQuestion, error UI, return 문의 <main> 태그 등은 이전 답변과 동일)
  // ... (UI 코드 전체를 다시 붙여넣기)

  // 메인 UI
  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-900 text-white p-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Image src="/logo.jpg" alt="합격 코치 로고" width={60} height={60} className="rounded-full"/>
          <h1 className="text-4xl font-extrabold text-white">AI 모의 면접 (카메라 모드)</h1>
        </div>
        
        {isAiLoading && (
          <div className="text-center p-4 bg-yellow-800 text-yellow-200 rounded-lg mb-4">
            AI 분석 모델을 로드 중입니다... 잠시만 기다려주세요.
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* 왼쪽: 질문 및 컨트롤 패널 */}
          <div className="w-full md:w-1/2 bg-slate-800 border border-teal-700 p-8 rounded-2xl shadow-xl flex flex-col">
             {/* ... (이전 답변과 동일한 질문 UI) ... */}
          </div>

          {/* 오른쪽: 웹캠 화면 및 실시간 점수 바 */}
          <div className="w-full md:w-1/2 flex flex-col">
            {/* 1. 웹캠 비디오 */}
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline // 모바일 호환성
              className="w-full h-auto aspect-video bg-black rounded-lg shadow-lg border border-slate-700" 
            />
            
            {/* 2. 실시간 점수 바 (UI 프로토타입) */}
            <div className="mt-4 p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold mb-4 text-teal-300">실시간 피드백</h3>
              <div className="space-y-4">
                {/* 표정/자신감 */}
                <div className="flex justify-between items-center gap-4">
                  <span className="w-24">표정/미소</span>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full transition-all duration-300" style={{ width: `${expressionScore}%` }}></div>
                  </div>
                  <span className="w-10 text-right">{expressionScore}점</span>
                </div>
                {/* 목소리/말투 */}
                <div className="flex justify-between items-center gap-4">
                  <span className="w-24">목소리(미구현)</span>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-300" style={{ width: `${toneScore}%` }}></div>
                  </div>
                  <span className="w-10 text-right">{toneScore}점</span>
                </div>
                {/* 시선 처리 */}
                <div className="flex justify-between items-center gap-4">
                  <span className="w-24">시선 처리</span>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div className="bg-yellow-500 h-3 rounded-full transition-all duration-300" style={{ width: `${gazeScore}%` }}></div>
                  </div>
                  <span className="w-10 text-right">{gazeScore}점</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Suspense로 컴포넌트를 감싸줍니다.
export default function CameraPageWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CameraPageContent />
    </Suspense>
  );
}

// Suspense 로딩 중 보여줄 간단한 폴백 UI
function LoadingFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-xl">페이지 로드 중...</p>
    </main>
  );
}