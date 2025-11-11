// app/camera/page.tsx (API 변수 이름 오류 수정본)

'use client';

// 1. 필요한 훅들과 컴포넌트를 모두 import 합니다.
import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';

// 2. MediaPipe(표정)와 VAD(음성) 라이브러리를 import 합니다. (기존 코드 유지)
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { MicVAD, getDefaultRealTimeVADOptions, type RealTimeVADOptions } from "@ricky0123/vad-web";

// TypeScript 타입 정의
type Question = {
  type: string;
  question: string;
};

// 3. 채팅창을 위한 인터페이스 정의
type ChatMessage = {
  sender: 'ai' | 'user';
  text: string;
};

// 4. 최종 피드백을 위한 인터페이스 정의 (⭐️ 점수 필드 추가)
type FeedbackItem = {
  question: string;
  transcription: string;
  feedback: string;
  scores: {
    expression: number;
    gaze: number;
    tone: number;
  };
};

function CameraPageContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatContainerRef = useRef<HTMLDivElement>(null); // 채팅창 스크롤을 위한 Ref

  // --- AI, 녹음, 분석 루프를 위한 Ref ---
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const vadRef = useRef<MicVAD | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const textInputRef = useRef<string>(''); // ⭐️ textInput을 ref로도 관리
  const isRecordingRef = useRef<boolean>(false); // ⭐️ isRecording을 ref로도 관리
  const currentQuestionIndexRef = useRef<number>(-1); // ⭐️ currentQuestionIndex를 ref로도 관리
  const questionsRef = useRef<Question[]>([]); // ⭐️ questions를 ref로도 관리
  
  // ⭐️ sendAudioToApi 함수 ref
  // (useCallback 안에서 최신 feedbackHistory를 참조하기 위해 sendAudioToApi를 ref로 관리합니다.)
  const sendAudioToApiRef = useRef<((audioBlob: Blob) => Promise<void>) | null>(null);

  // --- 상태 관리 ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // ⭐️ -1: 자기소개 단계
  const [interviewFlow, setInterviewFlow] = useState<ChatMessage[]>([]); // 1. 채팅 UI 상태
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([]); // 2. 최종 피드백 저장 상태
  const [jobUrl, setJobUrl] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const [textInput, setTextInput] = useState(''); // ⭐️ 텍스트 입력창 상태 추가

  // --- UI 상태 관리 ---
  const [isLoading, setIsLoading] = useState(true); // 질문 로딩
  const [isAiLoading, setIsAiLoading] = useState(true); // MediaPipe 로딩
  const [isRecording, setIsRecording] = useState(false); // 음성 녹음 중
  const [isProcessing, setIsProcessing] = useState(false); // 음성 처리 중(STT/Feedback)
  const [isPaused, setIsPaused] = useState(false); // ⭐️ 일시정지 상태 추가
  
  // ⭐️ textInput과 isRecording을 ref에도 동기화
  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);
  
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);
  
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // --- 실시간 점수 상태 ---
  const [expressionScore, setExpressionScore] = useState(70);
  const [toneScore, setToneScore] = useState(60); 
  const [gazeScore, setGazeScore] = useState(80);

  // --- 에러 상태 ---
  const [error, setError] = useState<string | null>(null);
  
  // --- 9. 실시간 표정 분석 로직 (⭐️ isPaused 의존성 추가) ---
  const predictWebcam = useCallback(() => {
    if (isPaused) {
      return;
    }

    if (!videoRef.current || !faceLandmarkerRef.current) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    if (video.currentTime === lastVideoTimeRef.current) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    lastVideoTimeRef.current = video.currentTime;
    const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
    processResults(results.faceBlendshapes);

    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [isPaused]); // ⭐️ isPaused를 의존성 배열에 추가

  // --- 5. useEffect #1: 카메라, 마이크, VAD, 녹음기 설정 (⭐️ VAD start await 수정) ---
  useEffect(() => {
    if (isLoading) {
      return;
    }

    let stream: MediaStream | null = null;
    let vadInstance: MicVAD | null = null;
    let mediaRecorderInstance: MediaRecorder | null = null;

    async function setupDevices() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            },
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
          });
          
          console.log("카메라 스트림 획득 성공:", stream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            const playVideo = async () => {
              if (videoRef.current && videoRef.current.paused) {
                try {
                  await videoRef.current.play();
                  console.log("비디오 재생 시작");
                } catch (err) {
                  console.error("비디오 재생 오류:", err);
                }
              }
            };
            
            videoRef.current.addEventListener("loadedmetadata", playVideo);
            videoRef.current.addEventListener("loadeddata", () => {
              playVideo();
              predictWebcam();
            });
            videoRef.current.addEventListener("play", () => {
              console.log("비디오 재생 중");
              predictWebcam();
            });
            videoRef.current.addEventListener("canplay", playVideo);
            playVideo();
          } else {
            console.error("videoRef.current가 null입니다 (수정 후에도 발생한다면 다른 문제입니다)");
          }

          mediaRecorderInstance = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = mediaRecorderInstance;

          mediaRecorderInstance.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorderInstance.onstop = async () => {
            setIsProcessing(true);
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioChunksRef.current = [];
            if (sendAudioToApiRef.current) {
              await sendAudioToApiRef.current(audioBlob);
            }
          };

          if (stream) {
            const mediaStream = stream; 
            const defaultOptions = getDefaultRealTimeVADOptions("legacy");
            const vadOptions: Partial<RealTimeVADOptions> = {
              ...defaultOptions,
              baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@latest/dist/",
              onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/",
              redemptionMs: 2000, 
              onSpeechStart: () => {
                if (textInputRef.current.trim() === '') {
                  setIsRecording(true);
                  const recorder = mediaRecorderRef.current;
                  if (recorder && recorder.state === 'inactive') {
                    recorder.start();
                  }
                }
              },
              onSpeechEnd: () => {
                if (isRecordingRef.current) {
                  setIsRecording(false);
                  const recorder = mediaRecorderRef.current;
                  if (recorder && recorder.state === 'recording') {
                    recorder.stop();
                  }
                }
              },
              getStream: async () => mediaStream,
              pauseStream: async (s: MediaStream) => {
                s.getTracks().forEach(track => track.enabled = false);
              },
              resumeStream: async (s: MediaStream) => {
                s.getTracks().forEach(track => track.enabled = true);
                return s;
              },
              startOnLoad: false,
            };
            
            vadInstance = await MicVAD.new(vadOptions);
            vadRef.current = vadInstance;
            
            // ⭐️ [수정] await을 추가하여 VAD가 완전히 시작될 때까지 기다립니다.
            console.log("VAD starting...");
            await vadRef.current?.start();
            console.log("VAD started successfully.");
            
          }
          
        } catch (err) {
          console.error("카메라/마이크/VAD 접근 오류:", err); // ⭐️ 에러 메시지 보강
          setError("카메라, 마이크 또는 음성 인식기(VAD) 초기화에 실패했습니다.");
        }
      } else {
        setError("이 브라우저에서는 카메라 기능을 지원하지 않습니다.");
      }
    }

    setupDevices();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      // ⭐️ vadInstance가 null이 아니고, destroy가 함수일 때만 호출
      if (vadInstance && typeof vadInstance.destroy === 'function') {
        vadInstance.destroy();
      }
      if (mediaRecorderInstance && mediaRecorderInstance.state !== "inactive") mediaRecorderInstance.stop();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isLoading, predictWebcam]); // ⭐️ predictWebcam을 의존성 배열에 추가


  // --- 6. useEffect #2: MediaPipe 로드 ---
  useEffect(() => {
    async function setupMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
        });
        setIsAiLoading(false);
        console.log("✅ MediaPipe FaceLandmarker 로드 성공");
      } catch (err) {
        setError("AI 표정 분석 모델 로드에 실패했습니다.");
        setIsAiLoading(false);
      }
    }
    setupMediaPipe();
  }, []);

  // --- 7. useEffect #3: 질문 로드 및 면접 시작 (⭐️⭐️⭐️ API 변수명 수정 ⭐️⭐️⭐️) ---
  useEffect(() => {
    let url = searchParams.get('job_url') || '';
    let category = searchParams.get('job_category') || '';
    
    if (!url && !category && typeof window !== 'undefined') {
      url = sessionStorage.getItem('jobUrl') || '';
      category = sessionStorage.getItem('jobCategory') || '';
    }
    
    setJobUrl(url);
    setJobCategory(category);

    async function fetchQuestions() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // ⭐️ [수정] job_category -> jobTitle, job_url -> url
          body: JSON.stringify({ jobTitle: category, url: url }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        setQuestions(data.questions);
        
        const greetingMessage: ChatMessage = { 
          sender: 'ai', 
          text: '안녕하세요! 오늘 면접 시간 내어주셔서 감사합니다. 저는 합격 코치 AI 면접관입니다. 편하게 대화하듯이 진행하겠으니 긴장하지 마시고, 자연스럽게 답변해 주시면 됩니다. 그럼 먼저 간단하게 자기소개 부탁드릴게요. 1분 정도로 본인에 대해 소개해 주세요.' 
        };
        setInterviewFlow([greetingMessage]);
        
        setCurrentQuestionIndex(-1);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "질문 로딩 중 오류");
        setInterviewFlow([{ sender: 'ai', text: '질문을 불러오는 데 실패했습니다.' }]);
      }
      setIsLoading(false);
    }

    if (url || category) {
      fetchQuestions();
    } else {
      setError("비정상적인 접근입니다. 메인 페이지에서 다시 시작해주세요.");
      setIsLoading(false);
    }
  }, [searchParams]);
  
  // --- 8. useEffect #4: 채팅창 자동 스크롤 ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [interviewFlow]);

  
  const processResults = (blendshapes: any[]) => {
    if (!blendshapes || blendshapes.length === 0) return;
    const categories = blendshapes[0]?.categories;
    if (!categories) return;
    const smileScore = categories.find((shape: any) => shape.categoryName === 'mouthSmileLeft')?.score || 0;
    setExpressionScore(Math.round(smileScore * 100));
    const gazeDemoScore = categories.find((shape: any) => shape.categoryName === 'eyeLookInLeft')?.score || 0;
    setGazeScore(Math.round((1 - gazeDemoScore) * 100));
  };

  // --- 10. 최종 리포트 페이지 이동 함수 (신규) ---
  const goToReportPage = useCallback(() => {
    setIsProcessing(false); 
    setIsPaused(true); 
    
    try {
      sessionStorage.setItem('feedbackHistory', JSON.stringify(feedbackHistory));
      console.log("Saving to sessionStorage:", feedbackHistory);
    } catch (err) {
      console.error("sessionStorage 저장 실패:", err);
      alert("결과 저장에 실패했습니다.");
      return;
    }
    
    router.push('/report');
  }, [router, feedbackHistory]); // ⭐️ feedbackHistory 의존성 추가

  // --- 11. 자연스러운 다음 질문 로드 로직 (수정) ---
  const loadNextQuestion = useCallback(() => {
    const currentIdx = currentQuestionIndexRef.current;
    const currentQuestions = questionsRef.current;
    const nextIndex = currentIdx + 1;

    if (nextIndex < currentQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      
      const nextQuestion = currentQuestions[nextIndex]?.question || "질문을 불러오는 중입니다.";
      
      const transitionPhrases = [
        "네, 잘 들었습니다.", "좋은 답변이었어요.", "이해했습니다.", "감사합니다.", "네, 알겠습니다.",
      ];
      const connectingPhrases = [
        "그럼 이제", "다음으로는", "이번에는", "이제", "그리고",
      ];
      
      let transitionPhrase = '';
      
      if (nextIndex === 0) {
        const firstPhrases = [
          "네, 자기소개 잘 들었습니다. 그럼 이제 본격적으로 면접 질문을 드려볼게요.",
          "감사합니다. 자기소개 잘 들었어요. 이제 몇 가지 질문 드리겠습니다.",
        ];
        transitionPhrase = firstPhrases[Math.floor(Math.random() * firstPhrases.length)];
      } else {
        const randomTransition = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];
        const randomConnecting = connectingPhrases[Math.floor(Math.random() * connectingPhrases.length)];
        transitionPhrase = `${randomTransition} ${randomConnecting} ${nextQuestion}`;
      }
      
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: transitionPhrase }]);
      setIsProcessing(false); 
    } else {
      // 면접 완료 (⭐️ goToReportPage 호출로 변경)
      setIsProcessing(false);
      const endingPhrase = "네, 수고하셨습니다. 모든 면접이 종료되었습니다. 잠시 후 최종 피드백 페이지로 이동합니다.";
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: endingPhrase }]);
      vadRef.current?.pause(); // 음성 감지 중지
      
      setTimeout(() => {
        goToReportPage();
      }, 3000);
    }
  }, [goToReportPage]); // ⭐️ goToReportPage 의존성 추가

  // --- 12. 오디오 전송 로직 (STT 연동 및 점수 저장) ---
  const sendAudioToApi = useCallback(async (audioBlob: Blob) => {
    const currentIdx = currentQuestionIndexRef.current;
    const currentQuestions = questionsRef.current;
    const currentQuestionText = 
      currentIdx === -1 ? "1분 자기소개를 부탁드립니다." : (currentQuestions[currentIdx]?.question || "질문을 불러오는 중입니다.");

    let transcription = "[음성 인식이 되지 않았습니다.]";
    
    try {
      // 1. STT API 호출
      const audioFormData = new FormData();
      audioFormData.append('audio', audioBlob, 'interview_answer.webm');

      const sttResponse = await fetch('/api/stt', {
        method: 'POST',
        body: audioFormData,
      });

      if (sttResponse.ok) {
        const sttResult = await sttResponse.json();
        transcription = (sttResult.transcription || "").trim() || transcription;
      } else {
         console.error("STT API 실패:", await sttResponse.text());
         transcription = "[음성 답변 처리 중 오류가 발생했습니다.]";
      }

    } catch (sttError) {
      console.error("STT API 오류:", sttError);
      transcription = "[음성 답변 처리 중 오류가 발생했습니다.]";
    }

    // 2. 유저 답변을 채팅창에 표시
    setInterviewFlow(prev => [...prev, { sender: 'user', text: transcription }]);

    try {
      // 3. STT로 변환된 텍스트를 피드백 API로 전송
      const feedbackResponse = await fetch('/api/feedback-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestionText, answer: transcription }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('피드백 API 호출에 실패했습니다.');
      }

      const feedbackResult = await feedbackResponse.json();
      if (feedbackResult.error) {
        throw new Error(feedbackResult.error);
      }
      
      // 4. 피드백 결과 저장 (자기소개 제외)
      if (currentIdx >= 0) {
        setFeedbackHistory(prevHistory => [
          ...prevHistory,
          {
            question: currentQuestionText,
            transcription: feedbackResult.transcription,
            feedback: feedbackResult.feedback,
            scores: {
              expression: expressionScore,
              gaze: gazeScore,
              tone: toneScore,
            }
          }
        ]);
      }
      
      // 5. 다음 질문 로드
      loadNextQuestion(); 

    } catch (feedbackError) {
      console.error("피드백 API 오류:", feedbackError);
      setInterviewFlow(prev => [...prev, { sender: 'user', text: "(오류: 텍스트 답변 처리에 실패했습니다.)" }]);
      loadNextQuestion(); 
    }
  }, [loadNextQuestion, expressionScore, gazeScore, toneScore]); 
  
  useEffect(() => {
    sendAudioToApiRef.current = sendAudioToApi;
  }, [sendAudioToApi]);

  // --- 13. 텍스트 답변 전송 로직 (점수 저장 추가) ---
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const answerText = textInput.trim();

    if (!answerText || isProcessing || isRecording || isPaused) return; 

    setIsProcessing(true);
    setTextInput('');
    
    const currentQuestionText = 
      currentQuestionIndex === -1 ? "1분 자기소개를 부탁드립니다." : questions[currentQuestionIndex].question;

    setInterviewFlow(prev => [...prev, { sender: 'user', text: answerText }]);

    try {
      const response = await fetch('/api/feedback-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestionText, answer: answerText }),
      });

      if (!response.ok) {
         throw new Error(await response.text());
      }

      const responseText = await response.text();
      if (!responseText) throw new Error("서버에서 빈 응답을 받았습니다.");
      
      const feedbackResult = JSON.parse(responseText);
      if (feedbackResult.error) throw new Error(feedbackResult.error);

      if (currentQuestionIndex >= 0) {
        setFeedbackHistory(prev => [
          ...prev,
          {
            question: currentQuestionText,
            transcription: feedbackResult.transcription, 
            feedback: feedbackResult.feedback,
            scores: {
              expression: expressionScore,
              gaze: gazeScore,
              tone: toneScore,
            }
          }
        ]);
      }

      loadNextQuestion(); 

    } catch (err) {
      console.error("텍스트 피드백 API 오류:", err);
      setInterviewFlow(prev => [...prev, { sender: 'user', text: "(오류: 텍스트 답변 처리에 실패했습니다.)" }]);
      loadNextQuestion();
    }
  };
  
  // --- 14. 면접 제어 핸들러 (신규) ---
  const handlePauseToggle = () => {
    setIsPaused(prevPaused => {
      const newPausedState = !prevPaused;
      if (newPausedState) {
        // 일시정지
        vadRef.current?.pause();
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      } else {
        // 다시시작
        vadRef.current?.start();
        if (!animationFrameId.current) {
          predictWebcam();
        }
      }
      return newPausedState;
    });
  };

  const handleEndInterview = () => {
    if (window.confirm("면접을 정말로 종료하시겠습니까? 종료 후에는 최종 피드백 페이지로 이동합니다.")) {
      vadRef.current?.pause();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      
      goToReportPage();
    }
  };

  // --- 15. UI 렌더링 ---
  if (error) { 
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
        <Image src="/logo.jpg" alt="합격 코치 로고" width={80} height={80} className="mb-4 rounded-full"/>
        <h2 className="text-2xl font-bold text-red-500">오류가 발생했습니다</h2>
        <p className="mt-4 text-lg text-center">{error}</p>
        <button onClick={() => router.push('/')} className="mt-8 px-6 py-2 bg-teal-600 rounded-lg">메인으로 돌아가기</button>
      </main>
    );
  }

  if (isLoading) {
     return (
       <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
         <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="mt-4 text-xl">질문을 생성하는 중입니다...</p>
       </main>
     );
  }

  return (
    <main className="flex flex-col h-screen bg-slate-900 text-white p-8 overflow-hidden">
      {/* 상단: 비디오 + 실시간 점수 */}
      <div className="w-full flex flex-col md:flex-row gap-6 mb-6">
        {/* 비디오 */}
        <div className="flex-1">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            className="w-full h-auto aspect-video bg-black rounded-lg shadow-lg border border-slate-700"
            style={{ transform: 'scaleX(-1)' }} // ⭐️ 거울 모드
          />
        </div>
        {/* 실시간 점수 바 */}
        <div className="flex-1 p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="text-xl font-semibold mb-4 text-teal-300">실시간 피드백</h3>
          {isAiLoading ? (
            <p className="text-slate-400">AI 표정 분석 모델 로드 중...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <span className="w-24">표정/미소</span>
                <div className="w-full bg-slate-700 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${expressionScore}%` }}></div></div>
                <span className="w-10 text-right">{expressionScore}점</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="w-24">목소리(미구현)</span>
                <div className="w-full bg-slate-700 rounded-full h-3"><div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${toneScore}%` }}></div></div>
                <span className="w-10 text-right">{toneScore}점</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="w-24">시선 처리</span>
                <div className="w-full bg-slate-700 rounded-full h-3"><div className="bg-yellow-500 h-3 rounded-full transition-all" style={{ width: `${gazeScore}%` }}></div></div>
                <span className="w-10 text-right">{gazeScore}점</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단: AI 채팅창 */}
      <div className="flex-1 flex flex-col bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        {/* 채팅 메시지 영역 */}
        <div ref={chatContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
          {interviewFlow.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
              {msg.sender === 'ai' && <Image src="/logo.jpg" alt="AI" width={32} height={32} className="w-8 h-8 rounded-full mr-3" />}
              <div className={`p-4 rounded-lg max-w-lg ${msg.sender === 'ai' ? 'bg-slate-700' : 'bg-teal-700'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* ⭐️ 면접 제어 버튼 추가 (신규) */}
        <div className="p-4 flex justify-center gap-4 border-t border-slate-700 bg-slate-800">
          <button
            onClick={handlePauseToggle}
            disabled={isProcessing} // 피드백 처리 중에는 비활성화
            className={`px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50
              ${isPaused 
                ? 'bg-green-600 hover:bg-green-700' // 다시 시작
                : 'bg-yellow-600 hover:bg-yellow-700' // 일시 정지
              }`}
          >
            {isPaused ? '면접 이어하기' : '일시정지'}
          </button>
          <button
            onClick={handleEndInterview}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
          >
            면접 종료하기
          </button>
        </div>

        {/* 하단 상태 표시줄 */}
        <div className="p-4 border-t border-slate-700 bg-slate-900">
          {isRecording ? (
            <div className="flex items-center justify-center gap-3 text-red-400">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              답변 녹음 중... (말을 멈추면 2초 후 자동 제출됩니다)
            </div>
          ) : isProcessing ? (
            <div className="flex items-center justify-center gap-3 text-yellow-400">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              답변 처리 중... 다음 질문을 준비합니다.
            </div>
          ) : (
            // 텍스트 입력 폼
            <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isPaused ? "면접이 일시정지되었습니다." : (isAiLoading ? "AI 모델 로드 중..." : "음성으로 답변하시거나 여기에 텍스트로 입력 후 전송하세요...")}
                disabled={isProcessing || isAiLoading || isPaused} // ⭐️ isPaused 추가
                className="flex-1 p-3 bg-slate-700 rounded-lg text-white border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <button
                type="submit"
                disabled={isProcessing || isRecording || !textInput.trim() || isPaused} // ⭐️ isPaused 추가
                className="p-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                전송
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

// --- Suspense Wrapper 및 Fallback ---
export default function CameraPageWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CameraPageContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-xl">페이지 로드 중...</p>
    </main>
  );
}