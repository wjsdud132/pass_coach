// app/camera/page.tsx (모든 오류 수정 및 기능 통합 최종본)

'use client';

// 1. 필요한 훅들과 컴포넌트를 모두 import 합니다.
import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';

// 2. MediaPipe(표정)와 VAD(음성) 라이브러리를 import 합니다.
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
  transcription: string; // STT로 변환된 텍스트
  feedback: string;      // AI의 피드백 (음성/텍스트 기반)
  scores: {
    expression: number;
    gaze: number;
    tone: number;
  };
};

// ⭐️ 3번 요청: 타이머 포맷팅 헬퍼 함수
const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


function CameraPageContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatContainerRef = useRef<HTMLDivElement>(null); 

  // --- AI, 녹음, 분석 루프를 위한 Ref ---
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const vadRef = useRef<MicVAD | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const textInputRef = useRef<string>(''); 
  const isRecordingRef = useRef<boolean>(false); 
  const currentQuestionIndexRef = useRef<number>(-1); 
  const questionsRef = useRef<Question[]>([]); 
  
  const sendAudioToApiRef = useRef<((audioBlob: Blob) => Promise<void>) | null>(null);
  
  // ⭐️ 4번 오류 해결: feedbackHistory의 최신 상태를 참조하기 위한 Ref
  const feedbackHistoryRef = useRef<FeedbackItem[]>([]);

  // --- ⭐️ 3번 요청 (타이머, 응답시간) ---
  const [elapsedTime, setElapsedTime] = useState(0); // 면접 경과 시간 (초)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // 타이머 ID
  const questionTimestampRef = useRef<number>(Date.now()); // AI 질문 종료 시각
  const reactionTimesRef = useRef<number[]>([]); // 질문별 답변 반응 시간 (ms)

  // --- 상태 관리 ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); 
  const [interviewFlow, setInterviewFlow] = useState<ChatMessage[]>([]); 
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([]); 
  const [jobUrl, setJobUrl] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const [textInput, setTextInput] = useState(''); 

  // --- UI 상태 관리 ---
  const [isLoading, setIsLoading] = useState(true); 
  const [isAiLoading, setIsAiLoading] = useState(true); 
  const [isRecording, setIsRecording] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isPaused, setIsPaused] = useState(false); // ⭐️ 일시정지 상태
  
  // Ref 동기화
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

  // ⭐️ 4번 오류 해결: state가 변경될 때마다 ref를 동기화
  useEffect(() => {
    feedbackHistoryRef.current = feedbackHistory;
  }, [feedbackHistory]);


  // --- 실시간 점수 상태 ---
  const [expressionScore, setExpressionScore] = useState(70);
  const [toneScore, setToneScore] = useState(60); 
  const [gazeScore, setGazeScore] = useState(80);

  // --- 에러 상태 ---
  const [error, setError] = useState<string | null>(null);

  // --- '고급 방법' (Blob to Base64 헬퍼) ---
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // "data:audio/webm;base64," 같은 접두사 제거
        resolve(base64data.split(',')[1]); 
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // --- ⭐️ 1번 요청 (AI 음성 출력) ---
  // --- [제거됨] speak 함수 ---


  // --- 5. useEffect #1: 카메라, 마이크, VAD, 녹음기 설정 (⭐️ 2, 3번 오류 수정) ---
  useEffect(() => {
    // ⭐️ 2번 오류 수정: isLoading이 true이면 (아직 <video> 태그 렌더링 전) 실행하지 않음
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
            
            // ⭐️ 2번 오류 수정: 'play' 이벤트에서 predictWebcam을 시작하여 안정성 확보
            videoRef.current.addEventListener("loadedmetadata", playVideo);
            videoRef.current.addEventListener("loadeddata", playVideo);
            videoRef.current.addEventListener("play", () => {
              console.log("비디오 재생 중");
              predictWebcam(); // ⭐️ 여기서 표정 분석 루프 시작
            });
            videoRef.current.addEventListener("canplay", playVideo);
            playVideo(); // ⭐️ 즉시 재생 시도
          } else {
             console.error("videoRef.current is null. Cannot attach stream.");
             setError("비디오 요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.");
             return; // ⭐️ videoRef가 없으면 VAD/MediaRecorder 설정을 중단
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
                // ⭐️ 3번: 답변 반응 시간 측정
                const reactionTime = Date.now() - questionTimestampRef.current;
                // 자기소개(-1) 이후의 질문(0부터)에 대해서만 반응 시간 기록
                if (currentQuestionIndexRef.current >= 0) {
                  reactionTimesRef.current.push(reactionTime); 
                  console.log(`Reaction time: ${reactionTime}ms`);
                }
                
                if (textInputRef.current.trim() === '') {
                  setIsRecording(true);
                  const recorder = mediaRecorderRef.current;
                  if (recorder && recorder.state === 'inactive') {
                    console.log("VAD: Speech Start -> Recording Start");
                    recorder.start();
                  }
                }
              },
              onSpeechEnd: () => {
                if (isRecordingRef.current) {
                  setIsRecording(false);
                  const recorder = mediaRecorderRef.current;
                  if (recorder && recorder.state === 'recording') {
                    console.log("VAD: Speech End -> Recording Stop");
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
              startOnLoad: false, // ⭐️ 자동으로 시작하지 않음
            };
            
            vadInstance = await MicVAD.new(vadOptions);
            vadRef.current = vadInstance;
            
            // ⭐️ 3번 오류 수정: VAD 시작 로직을 useEffect #7로 이동시킴
            // (질문이 로드된 후 VAD가 시작되어야 함)

          }
          
        } catch (err) {
          console.error("카메라/마이크/VAD 접근 오류:", err);
          setError("카메라와 마이크 접근 권한을 허용해주세요. 오류가 지속되면 페이지를 새로고침해주세요.");
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
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); // ⭐️ 타이머 정리
    };
  }, [isLoading]); // ⭐️ isLoading이 false가 되면 이 Effect가 실행됨


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

  // --- 7. useEffect #3: 질문 로드 및 면접 시작 (⭐️ 2, 3번 수정) ---
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
          // ⭐️ [수정] 2번 요청: API가 기대하는 'jobTitle'과 'url'로 키 이름을 변경
          body: JSON.stringify({ jobTitle: category, url: url }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || '질문 생성에 실패했습니다.');
        }

        setQuestions(data.questions);
        
        const greetingMessage: ChatMessage = { 
          sender: 'ai', 
          text: '안녕하세요! 오늘 면접 시간 내어주셔서 감사합니다. 저는 합격 코치 AI 면접관입니다. 편하게 대화하듯이 진행하겠으니 긴장하지 마시고, 자연스럽게 답변해 주시면 됩니다. 그럼 먼저 간단하게 자기소개 부탁드릴게요. 1분 정도로 본인에 대해 소개해 주세요.' 
        };
        setInterviewFlow([greetingMessage]);
        
        // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
        // speak(greetingMessage.text); 
        
        setCurrentQuestionIndex(-1);
        
        // ⭐️ 3번 오류 수정: VAD를 여기서 시작 (setupDevices에서 VAD 인스턴스가 생성된 후)
        setTimeout(() => {
           if (vadRef.current) {
             console.log("VAD Start on Question Load");
             vadRef.current.start();
           } else {
             console.warn("VAD Ref not ready, retrying...");
             setTimeout(() => vadRef.current?.start(), 1000); // 1초 후 재시도
           }
        }, 500); // 0.5초 딜레이
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "질문 로딩 중 오류");
        setInterviewFlow([{ sender: 'ai', text: '질문을 불러오는 데 실패했습니다.' }]);
      }
      setIsLoading(false); // ⭐️ 로딩 완료 -> 이때 useEffect #1이 실행됨
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

  // --- ⭐️ 9. useEffect #5: 타이머 로직 (3번 요청) ---
  useEffect(() => {
    // isLoading이 false이고, isPaused가 false일 때 타이머 실행
    if (!isLoading && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);
    } else if (timerIntervalRef.current) {
      // isPaused가 true가 되거나, isLoading이 true면 타이머 중지
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isLoading, isPaused]); // isLoading과 isPaused 상태가 변경될 때마다 실행

  // --- 10. 실시간 표정 분석 로직 (predictWebcam) ---
  const predictWebcam = useCallback(() => {
    // ⭐️ 3번 오류 수정: 일시정지 상태면 분석 중지
    if (isPaused) {
      return;
    }

    if (!videoRef.current || !faceLandmarkerRef.current) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const video = videoRef.current;

    // ⭐️ 2번 오류 수정: 비디오가 준비되지 않았거나, 일시정지되었거나, 너비가 0이면 루프만 계속 돌림
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
  
  const processResults = (blendshapes: any[]) => {
    if (!blendshapes || blendshapes.length === 0) return;
    const categories = blendshapes[0]?.categories;
    if (!categories) return;
    const smileScore = categories.find((shape: any) => shape.categoryName === 'mouthSmileLeft')?.score || 0;
    setExpressionScore(Math.round(smileScore * 100));
    const gazeDemoScore = categories.find((shape: any) => shape.categoryName === 'eyeLookInLeft')?.score || 0;
    setGazeScore(Math.round((1 - gazeDemoScore) * 100));
  };

  // --- 11. 최종 리포트 페이지 이동 함수 (⭐️ 3, 4번 오류 수정) ---
  const goToReportPage = useCallback(() => {
    setIsProcessing(false); 
    setIsPaused(true); // ⭐️ 타이머가 이 상태 변경으로 멈춤
    
    try {
      // ⭐️ 4번 오류 수정: state 대신 ref에서 최신 데이터를 읽어 저장
      sessionStorage.setItem('feedbackHistory', JSON.stringify(feedbackHistoryRef.current));
      // ⭐️ 3번 요청: 면접 시간 및 응답 시간 저장
      sessionStorage.setItem('totalInterviewTime', elapsedTime.toString());
      sessionStorage.setItem('reactionTimes', JSON.stringify(reactionTimesRef.current)); 
      
      console.log("Saving to sessionStorage:", {
        feedbackHistory: feedbackHistoryRef.current,
        elapsedTime,
        reactionTimes: reactionTimesRef.current
      });

    } catch (err) {
      console.error("sessionStorage 저장 실패:", err);
      alert("결과 저장에 실패했습니다.");
      return; // ⭐️ 저장 실패 시 이동 중단
    }
    
    // ⭐️ /report 페이지로 이동
    router.push('/report');
  }, [router, elapsedTime]); // ⭐️ 4번 오류 수정: feedbackHistory 의존성 제거 (ref 사용)

  // --- 12. 자연스러운 다음 질문 로드 로직 (⭐️ 1, 3번 수정) ---
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
      
      if (nextIndex === 0) { // 자기소개 -> 첫 질문
        const firstPhrases = [
          "네, 자기소개 잘 들었습니다. 그럼 이제 본격적으로 면접 질문을 드려볼게요.",
          "감사합니다. 자기소개 잘 들었어요. 이제 몇 가지 질문 드리겠습니다.",
        ];
        transitionPhrase = firstPhrases[Math.floor(Math.random() * firstPhrases.length)] + " " + nextQuestion;
      } else { // 일반 질문 -> 다음 질문
        const randomTransition = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];
        const randomConnecting = connectingPhrases[Math.floor(Math.random() * connectingPhrases.length)];
        transitionPhrase = `${randomTransition} ${randomConnecting} ${nextQuestion}`;
      }
      
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: transitionPhrase }]);
      // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
      // speak(transitionPhrase);
      setIsProcessing(false); 

      // ⭐️ 3번 오류 수정: AI가 질문을 표시한 후, VAD를 다시 시작
      setTimeout(() => {
        if (!isPaused) {
           console.log("VAD Start for next question");
           vadRef.current?.start();
           questionTimestampRef.current = Date.now(); // ⭐️ 3번: 반응 시간 측정을 위해 현재 시각 기록
        }
      }, 500); // 0.5초 후 VAD 시작

    } else {
      // 면접 완료
      setIsProcessing(false);
      const endingPhrase = "네, 수고하셨습니다. 모든 면접이 종료되었습니다. 잠시 후 최종 피드백 페이지로 이동합니다.";
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: endingPhrase }]);
      // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
      // speak(endingPhrase); 
      vadRef.current?.pause(); // 음성 감지 중지
      
      // ⭐️ 4번 오류 수정: goToReportPage가 올바르게 호출되도록 함
      setTimeout(() => {
        goToReportPage();
      }, 3000); // 3초 후 리포트 페이지로 이동
    }
  }, [goToReportPage, isPaused]); // ⭐️ isPaused 의존성 추가

  // --- 13. [수정됨] 오디오 전송 로직 (STT와 "고급 음성 피드백" 병렬 처리) ---
  const sendAudioToApi = useCallback(async (audioBlob: Blob) => {
    const currentIdx = currentQuestionIndexRef.current;
    const currentQuestions = questionsRef.current;
    const currentQuestionText = 
      currentIdx === -1 ? "1분 자기소개를 부탁드립니다." : (currentQuestions[currentIdx]?.question || "질문을 불러오는 중입니다.");

    let transcription = "[음성 인식이 되지 않았습니다.]";
    let feedback = "[피드백을 생성하지 못했습니다.]";

    try {
      // STT API용 FormData 준비
      const audioFormData = new FormData();
      audioFormData.append('audio', audioBlob, 'interview_answer.webm');

      // --- ⭐️ Promise.all을 사용하여 STT와 음성 피드백 API를 병렬로 호출 ---
      const [sttResponse, feedbackResponse] = await Promise.all([
        
        // 1. STT API 호출 (/api/stt)
        fetch('/api/stt', {
          method: 'POST',
          body: audioFormData,
        }),
        
        // 2. "고급 음성 피드백" API 호출 (/api/feedback-video)
        (async () => {
          try {
            const audioBase64 = await blobToBase64(audioBlob);
            return fetch('/api/feedback-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                question: currentQuestionText, 
                videoBase64: audioBase64, // ⭐️ 오디오 데이터를 Base64로 전송
                videoMimeType: 'audio/webm' // ⭐️ 정확한 MimeType 명시
              }),
            });
          } catch (error) {
            console.error("Base64 변환 또는 음성 피드백 요청 실패:", error);
            return new Response(JSON.stringify({ error: "음성 피드백 API 호출 실패" }), { status: 500 });
          }
        })()
      ]);

      // --- 1. STT 응답 처리 ---
      if (sttResponse.ok) {
        const sttResult = await sttResponse.json();
        transcription = (sttResult.transcription || "").trim() || transcription;
      } else {
         console.error("STT API 실패:", await sttResponse.text());
         transcription = "[음성 답변 처리 중 오류가 발생했습니다.]";
      }

      // --- 2. 음성 피드백 응답 처리 ---
      if (feedbackResponse.ok) {
        const feedbackResult = await feedbackResponse.json();
        if (feedbackResult.error) {
          throw new Error(feedbackResult.error);
        }
        feedback = feedbackResult.feedback; // ⭐️ 이것이 "고급 피드백" (말투 포함)
      } else {
        console.error("음성 피드백 API 실패:", await feedbackResponse.text());
        feedback = "[AI 피드백 생성 중 오류가 발생했습니다.]";
      }

      // --- 3. UI 업데이트 및 상태 저장 ---
      setInterviewFlow(prev => [...prev, { sender: 'user', text: transcription }]);

      if (currentIdx >= 0) { // 자기소개는 피드백 히스토리에 저장 안함
        setFeedbackHistory(prevHistory => [
          ...prevHistory,
          {
            question: currentQuestionText,
            transcription: transcription, // ⭐️ STT 결과
            feedback: feedback,         // ⭐️ 음성 분석 피드백 결과
            scores: {
              expression: expressionScore,
              gaze: gazeScore,
              tone: toneScore, 
            }
          }
        ]);
      }
      
      loadNextQuestion(); // ⭐️ 다음 질문 로드 (VAD 시작 로직 포함됨)

    } catch (error) {
      console.error("STT 또는 피드백 API 처리 중 전반적 오류:", error);
      setInterviewFlow(prev => [...prev, { sender: 'user', text: transcription }]);
      const errorMsg = "(오류: 답변 피드백 생성에 실패했습니다. 다음 질문으로 넘어갑니다.)";
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: errorMsg }]);
      // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
      // speak(errorMsg); 
      loadNextQuestion(); 
    }
  }, [loadNextQuestion, expressionScore, gazeScore, toneScore, isPaused]); // ⭐️ isPaused 의존성 추가
  
  // ⭐️ sendAudioToApi 함수를 ref에 저장
  useEffect(() => {
    sendAudioToApiRef.current = sendAudioToApi;
  }, [sendAudioToApi]);

  // --- 14. 텍스트 답변 전송 로직 (⭐️ 3번 오류 수정) ---
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
      // ⭐️ 텍스트 답변은 /api/feedback-text API를 사용 (프롬프트가 수정됨)
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

      if (currentQuestionIndex >= 0) { // 자기소개는 저장 안함
        setFeedbackHistory(prev => [
          ...prev,
          {
            question: currentQuestionText,
            transcription: feedbackResult.transcription, 
            feedback: feedbackResult.feedback, // ⭐️ 텍스트 기반 피드백 (유창성 포함)
            scores: {
              expression: expressionScore,
              gaze: gazeScore,
              tone: toneScore,
            }
          }
        ]);
      }

      loadNextQuestion(); // ⭐️ 다음 질문 로드 (VAD 시작 로직 포함됨)

    } catch (err) {
      console.error("텍스트 피드백 API 오류:", err);
      const errorMsg = "(오류: 텍스트 답변 처리에 실패했습니다. 다음 질문으로 넘어갑니다.)";
      setInterviewFlow(prev => [...prev, { sender: 'ai', text: errorMsg }]);
      // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
      // speak(errorMsg);
      loadNextQuestion();
    }
  };
  
  // --- 15. 면접 제어 핸들러 (⭐️ 1, 3번 오류 수정) ---
  const handlePauseToggle = () => {
    // ⭐️ isPaused 상태를 직접 토글
    setIsPaused(prevPaused => {
      const newPausedState = !prevPaused;
      if (newPausedState) {
        // 일시정지
        console.log("Pausing interview...");
        // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
        // window.speechSynthesis.cancel(); 
        vadRef.current?.pause(); // ⭐️ VAD 중지
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      } else {
        // 다시시작
        console.log("Resuming interview...");
        vadRef.current?.start(); // ⭐️ VAD 즉시 다시 시작
        if (!animationFrameId.current) {
          predictWebcam(); // ⭐️ 표정 분석 다시 시작
        }
      }
      return newPausedState;
    });
  };

  const handleEndInterview = () => {
    if (window.confirm("면접을 정말로 종료하시겠습니까? 종료 후에는 최종 피드백 페이지로 이동합니다.")) {
      vadRef.current?.pause();
      // ⭐️ [제거됨] 1번 요청: AI 음성(TTS) 제거
      // window.speechSynthesis.cancel(); 
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      
      // ⭐️ 3, 4번 요청: 타이머 중지 및 리포트 페이지 이동
      setIsPaused(true); // ⭐️ 타이머 중지를 위해 isPaused를 true로 설정
      goToReportPage();
    }
  };

  // --- 16. UI 렌더링 (⭐️ 3번 요청: 타이머 UI 추가) ---
  if (error) { 
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

  if (isLoading) {
     return (
       <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800 p-8">
         <div className="text-center bg-white/80 border border-sky-100 rounded-3xl px-10 py-12 shadow-xl">
           <div className="w-16 h-16 border-8 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
           <p className="mt-6 text-2xl font-semibold text-slate-900">맞춤 질문을 준비 중입니다...</p>
           <p className="mt-2 text-slate-500">채용 공고에서 핵심 역량을 추출하고 있어요.</p>
         </div>
       </main>
     );
  }

  return (
    <main className="flex flex-col h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900 p-8 overflow-hidden">
      {/* 헤더 */}
      <header className="text-center mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Camera Studio</p>
        <h2 className="mt-3 text-4xl font-bold text-slate-900">AI 모의 면접 (카메라)</h2>
        <p className="mt-4 text-lg text-slate-500">실시간 표정 분석과 음성 인식으로 면접을 진행합니다.</p>
      </header>

      {/* ⭐️ 상단: 비디오 + 실시간 점수 + 타이머 */}
      <div className="w-full flex flex-col md:flex-row gap-6 mb-6">
        {/* 비디오 */}
        <div className="flex-1">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            className="w-full h-auto aspect-video bg-black rounded-3xl shadow-2xl shadow-sky-100 border border-sky-100"
            style={{ transform: 'scaleX(-1)' }} // ⭐️ 2번 오류 수정: 비디오 안정성을 위해 transform 유지
          />
        </div>
        {/* 실시간 점수 바 + 타이머 */}
        <div className="flex-1 p-6 bg-white/90 border border-sky-100 rounded-3xl shadow-2xl shadow-sky-100 backdrop-blur flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-semibold text-slate-900">실시간 피드백</h3>
             {/* ⭐️ 3번 요청: 타이머 UI */}
             <div className="text-2xl font-mono text-sky-600 bg-sky-50 border border-sky-200 px-3 py-1 rounded-2xl">
               {formatTime(elapsedTime)}
             </div>
          </div>

          {isAiLoading ? (
            <p className="text-slate-500">AI 표정 분석 모델 로드 중...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <span className="w-24 text-slate-700 font-medium">표정/미소</span>
                <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-gradient-to-r from-blue-400 to-blue-500 h-3 rounded-full transition-all" style={{ width: `${expressionScore}%` }}></div></div>
                <span className="w-10 text-right text-slate-900 font-semibold">{expressionScore}점</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="w-24 text-slate-700 font-medium">시선/응시</span>
                <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all" style={{ width: `${gazeScore}%` }}></div></div>
                <span className="w-10 text-right text-slate-900 font-semibold">{gazeScore}점</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="w-24 text-slate-700 font-medium">음성/톤</span>
                <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-gradient-to-r from-purple-400 to-purple-500 h-3 rounded-full transition-all" style={{ width: `${toneScore}%` }}></div></div>
                <span className="w-10 text-right text-slate-900 font-semibold">{toneScore}점</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 하단: AI 채팅창 */}
      <div className="flex-1 flex flex-col bg-white/90 border border-sky-100 rounded-3xl shadow-2xl shadow-sky-100 backdrop-blur overflow-hidden">
        {/* 채팅 메시지 영역 */}
        <div ref={chatContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
          {interviewFlow.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
              {msg.sender === 'ai' && <Image src="/logo.jpg" alt="AI" width={32} height={32} className="w-8 h-8 rounded-full mr-3" />}
              <div className={`p-4 rounded-2xl max-w-lg ${msg.sender === 'ai' ? 'bg-sky-50 border border-sky-100 text-slate-800' : 'bg-gradient-to-r from-sky-500 to-emerald-400 text-white'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* ⭐️ 3번 요청: 면접 제어 버튼 */}
        <div className="p-4 flex justify-center gap-4 border-t border-sky-100 bg-white/50">
          <button
            onClick={handlePauseToggle}
            disabled={isProcessing} 
            className={`px-6 py-3 rounded-2xl font-semibold transition-all disabled:opacity-50 hover:-translate-y-0.5
              ${isPaused 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-100' // 다시 시작
                : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg shadow-yellow-100' // 일시 정지
              }`}
          >
            {isPaused ? '면접 이어하기' : '일시정지'}
          </button>
          <button
            onClick={handleEndInterview}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold transition-all hover:-translate-y-0.5 shadow-lg shadow-rose-100"
          >
            면접 종료하기
          </button>
        </div>

        {/* 하단 상태 표시줄 */}
        <div className="p-4 border-t border-sky-100 bg-white/50">
          {isRecording ? (
            <div className="flex items-center justify-center gap-3 text-rose-500">
              <span className="w-3 h-3 bg-rose-500 rounded-full animate-pulse"></span>
              <span className="font-medium">답변 녹음 중... (말을 멈추면 2초 후 자동 제출됩니다)</span>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center justify-center gap-3 text-sky-500">
              <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="font-medium">답변 처리 중... 다음 질문을 준비합니다.</span>
            </div>
          ) : (
            // 텍스트 입력 폼
            <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isPaused ? "면접이 일시정지되었습니다." : (isAiLoading ? "AI 모델 로드 중..." : "음성으로 답변하시거나 여기에 텍스트로 입력 후 전송하세요...")}
                disabled={isProcessing || isAiLoading || isPaused} 
                className="flex-1 p-3 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 outline-none"
              />
              <button
                type="submit"
                disabled={isProcessing || isRecording || !textInput.trim() || isPaused} 
                className="p-3 bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 rounded-2xl text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-100 hover:-translate-y-0.5"
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

// Next.js page 컴포넌트 (Suspense로 감싸서 useSearchParams 사용)
export default function CameraPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-800 p-8">
        <div className="text-center bg-white/80 border border-sky-100 rounded-3xl px-10 py-12 shadow-xl">
          <div className="w-16 h-16 border-8 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-2xl font-semibold text-slate-900">로딩 중...</p>
        </div>
      </main>
    }>
      <CameraPageContent />
    </Suspense>
  );
}