// app/camera/page.tsx (videoRef.current가 null입니다 오류 수정본)

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

// 4. 최종 피드백을 위한 인터페이스 정의
type FeedbackItem = {
  question: string;
  transcription: string;
  feedback: string;
  // (필요시 점수 등 추가)
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
  const sendAudioToApiRef = useRef<((audioBlob: Blob) => Promise<void>) | null>(null); // ⭐️ sendAudioToApi 함수 ref

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

  //
  // --- ⭐️⭐️⭐️ 5. [수정된 부분] (111행 ~ 227행) ⭐️⭐️⭐️ ---
  //
  useEffect(() => {
    // ⭐️ [수정] isLoading이 true이면(아직 <video> 태그가 렌더링 안됨)
    // 함수를 즉시 종료합니다.
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
          
          // ⭐️ isLoading이 false가 된 후이므로, videoRef.current는 이제 null이 아닙니다.
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            // ⭐️ 비디오가 제대로 재생되도록 여러 이벤트에서 play() 호출
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
            
            // loadedmetadata 이벤트에서 재생 시도
            videoRef.current.addEventListener("loadedmetadata", playVideo);
            
            // loadeddata 이벤트에서 재생 시도 및 표정 분석 시작
            videoRef.current.addEventListener("loadeddata", () => {
              playVideo();
              // (faceLandmarkerRef.current가 준비되었는지는 predictWebcam 내부에서 확인)
              predictWebcam();
            });
            
            // play 이벤트 리스너 추가
            videoRef.current.addEventListener("play", () => {
              console.log("비디오 재생 중");
              // ⭐️ play 이벤트에서도 predictWebcam을 호출하여 루프 시작 보장
              predictWebcam();
            });
            
            // canplay 이벤트에서도 재생 시도
            videoRef.current.addEventListener("canplay", playVideo);
            
            // 즉시 재생 시도
            playVideo();
          } else {
            // 이 else 문은 이제 실행되지 않아야 합니다.
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
            // sendAudioToApi 함수가 정의된 후 호출
            if (sendAudioToApiRef.current) {
              await sendAudioToApiRef.current(audioBlob);
            }
          };

          if (stream) {
            const mediaStream = stream; 
            // ⭐️ 기본 VAD 옵션을 가져와서 필요한 부분만 오버라이드
            const defaultOptions = getDefaultRealTimeVADOptions("legacy");
            const vadOptions: Partial<RealTimeVADOptions> = {
              ...defaultOptions, // 기본 옵션 사용 (모델 경로 등 자동 설정)
              // ⭐️ CDN에서 모델 파일을 가져오도록 baseAssetPath 설정
              baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@latest/dist/",
              onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/",
              redemptionMs: 2000, 
              onSpeechStart: () => {
                // ⭐️ 텍스트 입력 중이 아닐 때만 녹음 시작 (ref 사용)
                if (textInputRef.current.trim() === '') {
                  setIsRecording(true);
                  const recorder = mediaRecorderRef.current;
                  if (recorder && recorder.state === 'inactive') {
                    recorder.start();
                  }
                }
              },
              onSpeechEnd: () => {
                // ⭐️ ref를 사용하여 최신 상태 확인
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
          }
          
        } catch (err) {
          console.error("카메라/마이크 접근 오류:", err);
          setError("카메라와 마이크 접근 권한을 허용해주세요.");
        }
      } else {
        setError("이 브라우저에서는 카메라 기능을 지원하지 않습니다.");
      }
    }

    setupDevices();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (vadInstance) vadInstance.destroy();
      if (mediaRecorderInstance && mediaRecorderInstance.state !== "inactive") mediaRecorderInstance.stop();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isLoading]); // ⭐️ [수정] isLoading을 의존성 배열에 추가
  // --- (여기까지 111행 ~ 227행 수정 완료) ---


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

  // --- 7. useEffect #3: 질문 로드 및 면접 시작 (⭐️ 대화형으로 수정됨) ---
  useEffect(() => {
    // ⭐️ URL 파라미터 또는 sessionStorage에서 정보 가져오기
    let url = searchParams.get('job_url') || '';
    let category = searchParams.get('job_category') || '';
    
    // URL 파라미터가 없으면 sessionStorage에서 가져오기
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
          body: JSON.stringify({ job_category: category, job_url: url }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        setQuestions(data.questions);
        
        // ⭐️ (요청 2) AI 인사말로 면접 시작 - 자연스럽고 친근하게
        const greetingMessage: ChatMessage = { 
          sender: 'ai', 
          text: '안녕하세요! 오늘 면접 시간 내어주셔서 감사합니다. 저는 합격 코치 AI 면접관입니다. 편하게 대화하듯이 진행하겠으니 긴장하지 마시고, 자연스럽게 답변해 주시면 됩니다. 그럼 먼저 간단하게 자기소개 부탁드릴게요. 1분 정도로 본인에 대해 소개해 주세요.' 
        };
        setInterviewFlow([greetingMessage]);
        
        setCurrentQuestionIndex(-1); // 현재 인덱스를 -1 (자기소개 단계)로 설정
        vadRef.current?.start(); // VAD 시작
        
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

  // --- 9. 실시간 표정 분석 로직 (⭐️ 검은 화면/ROI 오류 수정됨) ---
  const predictWebcam = useCallback(() => {
    // ⭐️ 1. 필수 ref들이 준비되었는지 확인
    if (!videoRef.current || !faceLandmarkerRef.current) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const video = videoRef.current;

    // ⭐️ 2. [핵심] 비디오 프레임이 실제로 사용 가능한지 확인
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // ⭐️ 3. 동일한 프레임을 중복 처리하지 않도록 방지
    if (video.currentTime === lastVideoTimeRef.current) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // ⭐️ 4. 모든 검사를 통과했으므로, 예측 수행
    lastVideoTimeRef.current = video.currentTime;
    const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
    processResults(results.faceBlendshapes);

    // ⭐️ 5. 다음 프레임 요청
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, []); // 의존성 배열은 [] 유지
  
  const processResults = (blendshapes: any[]) => {
    if (!blendshapes || blendshapes.length === 0) return;
    const categories = blendshapes[0]?.categories;
    if (!categories) return;
    const smileScore = categories.find((shape: any) => shape.categoryName === 'mouthSmileLeft')?.score || 0;
    setExpressionScore(Math.round(smileScore * 100));
    const gazeDemoScore = categories.find((shape: any) => shape.categoryName === 'eyeLookInLeft')?.score || 0;
    setGazeScore(Math.round((1 - gazeDemoScore) * 100));
  };
  
  const startPrediction = useCallback(() => {
    if (faceLandmarkerRef.current && videoRef.current) predictWebcam();
  }, [predictWebcam]);

  // --- 12. (요청 3) 자연스러운 다음 질문 로드 로직 - 대화형식으로 개선 ---
  const loadNextQuestion = useCallback(() => {
    const currentIdx = currentQuestionIndexRef.current;
    const currentQuestions = questionsRef.current;
    const nextIndex = currentIdx + 1;
    if (nextIndex < currentQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      
      const nextQuestion = currentQuestions[nextIndex]?.question || "질문을 불러오는 중입니다.";
      
      // ⭐️ 자연스러운 전환 문구 배열 (랜덤하게 선택)
      const transitionPhrases = [
        "네, 잘 들었습니다.",
        "좋은 답변이었어요.",
        "이해했습니다.",
        "감사합니다.",
        "네, 알겠습니다.",
      ];
      
      const connectingPhrases = [
        "그럼 이제",
        "다음으로는",
        "이번에는",
        "이제",
        "그리고",
      ];
      
      let transitionPhrase = '';
      
      if (nextIndex === 0) {
        // 자기소개 후 첫 질문
        const firstPhrases = [
          "네, 자기소개 잘 들었습니다. 그럼 이제 본격적으로 면접 질문을 드려볼게요.",
          "감사합니다. 자기소개 잘 들었어요. 이제 몇 가지 질문 드리겠습니다.",
          "네, 이해했습니다. 그럼 이제 면접 질문을 시작하겠습니다.",
        ];
        transitionPhrase = firstPhrases[Math.floor(Math.random() * firstPhrases.length)];
      } else {
        // 중간 질문들 - 더 자연스럽게
        const randomTransition = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];
        const randomConnecting = connectingPhrases[Math.floor(Math.random() * connectingPhrases.length)];
        transitionPhrase = `${randomTransition} ${randomConnecting} ${nextQuestion}`;
      }
      
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: transitionPhrase }]);
      setIsProcessing(false); 
    } else {
      // 면접 완료 - 더 자연스럽게
      setIsProcessing(false);
      const endingPhrases = [
        "네, 수고하셨습니다. 오늘 면접 잘 들었어요. 잠시 후 최종 피드백을 준비해드리겠습니다.",
        "감사합니다. 면접이 모두 종료되었습니다. 잠시 후 결과를 확인해보세요.",
        "네, 면접 완료되었습니다. 수고하셨어요. 곧 피드백을 제공해드리겠습니다.",
      ];
      const endingPhrase = endingPhrases[Math.floor(Math.random() * endingPhrases.length)];
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: endingPhrase }]);
      vadRef.current?.pause(); // 음성 감지 중지
      
      setTimeout(() => {
        // TODO: feedbackHistory를 /api/feedback-summary로 보내고 요약 페이지로 이동
        // router.push('/report/summary', { state: { feedbackHistory } }); 
        alert("면접 종료! (최종 피드백 페이지로 이동 - 기능 구현 필요)");
      }, 3000);
    }
  }, []);

  // --- 10. 오디오 전송 로직 (⭐️ 질문 텍스트 전송 추가) ---
  const sendAudioToApi = useCallback(async (audioBlob: Blob) => {
    const currentIdx = currentQuestionIndexRef.current;
    const currentQuestions = questionsRef.current;
    const currentQuestionText = 
      currentIdx === -1 ? "1분 자기소개를 부탁드립니다." : (currentQuestions[currentIdx]?.question || "질문을 불러오는 중입니다.");

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'interview_answer.webm');
      formData.append('question', currentQuestionText); // ⭐️ 질문 텍스트 추가
      
      // ⭐️ '/api/feedback' API가 formData를 처리하도록 수정 필요
      // 현재 /api/feedback (text/page.tsx에서 사용)은 JSON을 기대합니다.
      // /api/feedback-video 또는 별도 API를 사용해야 할 수 있습니다.
      // 여기서는 '/api/feedback'이 text/page.tsx와 동일한 API라고 가정하고,
      // 텍스트 기반 피드백 API(/api/feedback-text)를 호출하는 로직으로 임시 변경합니다.
      // (추후 오디오 STT API로 변경 필요)
      
      // 임시: STT가 없으므로 오디오 Blob을 보내는 대신 임시 텍스트를 보냄
      // 실제로는 여기서 STT API를 호출해야 합니다.
      const tempTranscription = "[음성 답변 녹음됨 (STT 기능 필요)]";

      const response = await fetch('/api/feedback-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestionText, answer: tempTranscription }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "오디오 답변 처리에 실패했습니다.";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error("서버에서 빈 응답을 받았습니다.");
      }

      const feedbackResult = JSON.parse(responseText);
      
      setInterviewFlow(prev => [...prev, { sender: 'user', text: feedbackResult.transcription || "(답변이 인식되지 않았습니다.)" }]);
      
      if (currentIdx >= 0) {
        setFeedbackHistory(prev => [
          ...prev,
          {
            question: currentQuestionText,
            transcription: feedbackResult.transcription,
            feedback: feedbackResult.feedback,
          }
        ]);
      }
      
      loadNextQuestion(); // 다음 질문 로드

    } catch (err) {
      console.error("오디오 피드백 API 오류:", err);
      setInterviewFlow(prev => [...prev, { sender: 'user', text: "(오류: 오디오 답변 처리에 실패했습니다.)" }]);
      loadNextQuestion(); 
    }
  }, [loadNextQuestion]);
  
  // ⭐️ sendAudioToApi 함수를 ref에 저장
  useEffect(() => {
    sendAudioToApiRef.current = sendAudioToApi;
  }, [sendAudioToApi]);

  // --- ⭐️ 11. 텍스트 답변 전송 로직 (신규) ---
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const answerText = textInput.trim();

    if (!answerText || isProcessing || isRecording) return;

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
        const errorText = await response.text();
        let errorMessage = "텍스트 답변 처리에 실패했습니다.";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error("서버에서 빈 응답을 받았습니다.");
      }

      const feedbackResult = JSON.parse(responseText);
      
      if (feedbackResult.error) {
        throw new Error(feedbackResult.error);
      }

      // (요청 4) 자기소개(index -1)를 제외하고 피드백 저장
      if (currentQuestionIndex >= 0) {
        setFeedbackHistory(prev => [
          ...prev,
          {
            question: currentQuestionText,
            transcription: feedbackResult.transcription, 
            feedback: feedbackResult.feedback,
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

  // --- 13. UI 렌더링 (⭐️ 사이드바 제거, 텍스트 입력창 추가) ---
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

  // ⭐️ [수정] isLoading이 true일 때만 로딩 화면을 보여줍니다.
  if (isLoading) {
     return (
       <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
         <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="mt-4 text-xl">질문을 생성하는 중입니다...</p>
       </main>
     );
  }

  // ⭐️ isLoading이 false가 되면 아래의 면접 UI가 렌더링됩니다.
  return (
    // (요청 1) 사이드바 제거, 메인 컨텐츠가 전체 화면 사용
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
            style={{ transform: 'scaleX(-1)' }} // ⭐️ 거울 모드 (자연스러운 느낌)
          />
        </div>
        {/* 실시간 점수 바 (요청 3) */}
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

      {/* 하단: AI 채팅창 (요청 2) */}
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
            // ⭐️ 텍스트 입력 폼 (신규)
            <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isAiLoading ? "AI 모델 로드 중..." : "음성으로 답변하시거나 여기에 텍스트로 입력 후 전송하세요..."}
                disabled={isProcessing || isAiLoading}
                className="flex-1 p-3 bg-slate-700 rounded-lg text-white border border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <button
                type="submit"
                disabled={isProcessing || isRecording || !textInput.trim()}
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