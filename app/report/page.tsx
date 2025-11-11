// app/report/page.tsx (className 오류 수정 및 부모 <div>로 스타일 이동)

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown'; // 1. 라이브러리 import

// 4. 최종 피드백을 위한 인터페이스 정의 (camera/page.tsx와 동일)
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

// ⭐️ 타이머 포맷팅 헬퍼 함수
const formatTime = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function ReportPage() {
  const router = useRouter();
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([]);
  const [totalTime, setTotalTime] = useState(0);
  const [avgReactionTime, setAvgReactionTime] = useState(0);
  const [finalSummary, setFinalSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  useEffect(() => {
    // 1. SessionStorage에서 데이터 로드
    const historyData = sessionStorage.getItem('feedbackHistory');
    const timeData = sessionStorage.getItem('totalInterviewTime');
    const reactionData = sessionStorage.getItem('reactionTimes');

    if (!historyData || !timeData || !reactionData) {
      console.error("세션 스토리지에 면접 데이터가 없습니다.");
      alert("면접 데이터를 불러오는 데 실패했습니다. 메인 페이지로 이동합니다.");
      router.push('/');
      return;
    }

    let parsedHistory: FeedbackItem[] = [];
    
    try {
      parsedHistory = JSON.parse(historyData);
      const parsedTime: number = parseInt(timeData, 10);
      const parsedReactions: number[] = JSON.parse(reactionData);

      setFeedbackHistory(parsedHistory);
      setTotalTime(parsedTime);

      // 2. 평균 답변 반응 속도 계산
      if (parsedReactions.length > 0) {
        const sum = parsedReactions.reduce((acc, time) => acc + time, 0);
        const avgMs = sum / parsedReactions.length;
        setAvgReactionTime(parseFloat((avgMs / 1000).toFixed(2))); // 초 단위로 변환
      }
      
      setIsLoading(false);

    } catch (err) {
      console.error("면접 데이터 파싱 오류:", err);
      alert("면접 결과 분석 중 오류가 발생했습니다. 메인 페이지로 이동합니다.");
      router.push('/');
      return;
    }

    // 3. 종합 피드백 API 호출 (파싱이 성공한 후에 실행)
    const fetchSummary = async (history: FeedbackItem[]) => {
      if (history.length === 0) {
        setFinalSummary("진행된 면접 질문이 없어 종합 피드백을 생성할 수 없습니다.");
        setIsSummaryLoading(false);
        return;
      }

      setIsSummaryLoading(true);
      try {
        const questions = history.map(item => item.question);
        const answers = history.map(item => item.transcription);

        const response = await fetch('/api/feedback-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions, answers }),
        });
        
        if (!response.ok) {
          throw new Error('종합 피드백 생성 실패');
        }
        
        const data = await response.json();
        setFinalSummary(data.feedback);
      } catch (err) {
        console.error("종합 피드백 로드 오류:", err);
        setFinalSummary("종합 피드백을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsSummaryLoading(false);
      }
    };

    fetchSummary(parsedHistory); 

  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-8">
        <div className="w-16 h-16 border-8 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xl">최종 리포트를 생성하는 중입니다...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-900 text-white p-8 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.jpg" alt="합격 코치 로고" width={80} height={80} className="mb-4 rounded-full"/>
          <h1 className="text-4xl font-extrabold text-white text-center">면접 결과 리포트</h1>
          <p className="text-xl text-slate-400 mt-2">AI 면접 분석 결과입니다.</p>
        </div>

        {/* ⭐️ 3번 요청: 면접 시간 및 응답 속도 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 text-center">
            <h3 className="text-lg font-semibold text-slate-400 mb-2">총 면접 시간</h3>
            <p className="text-4xl font-bold text-teal-400">{formatTime(totalTime)}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 text-center">
            <h3 className="text-lg font-semibold text-slate-400 mb-2">평균 답변 반응 속도</h3>
            <p className="text-4xl font-bold text-teal-400">
              {avgReactionTime} <span className="text-2xl">초</span>
            </p>
            <p className="text-sm text-slate-500 mt-1">(AI 질문 표시 후 답변 시작까지 걸린 시간)</p>
          </div>
        </div>

        {/* 종합 피드백 */}
        <div className="bg-slate-800 border border-teal-800 p-8 rounded-2xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-teal-300 mb-4"> AI 종합 피드백</h2>
          {isSummaryLoading ? (
             <div className="flex items-center justify-center gap-3 text-slate-300">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
              종합 피드백을 생성하는 중입니다...
            </div>
          ) : (
            // ⭐️ [수정] ReactMarkdown을 <div>로 감싸고, className을 <div>로 이동
            <div className="text-slate-200 leading-relaxed prose prose-invert max-w-none">
              <ReactMarkdown>
                {finalSummary}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* 질문별 상세 피드백 */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-teal-300 mb-4"> 질문별 상세 피드백</h2>
          {feedbackHistory.length > 0 ? (
            feedbackHistory.map((item, index) => (
              <details key={index} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden" open={index === 0}>
                <summary className="p-6 cursor-pointer hover:bg-slate-700 font-semibold text-lg flex justify-between items-center">
                  <span className="flex-1">질문 {index + 1}. {item.question}</span>
                  <span className="text-sm text-teal-400 ml-4 shrink-0">자세히 보기 ▼</span>
                </summary>
                
                <div className="bg-slate-800 p-6 border-t border-slate-700">
                  <h4 className="font-bold text-slate-400 mb-2">제출한 답변:</h4>
                  <p className="bg-slate-900 p-4 rounded-md mb-4 text-slate-300 italic">"{item.transcription}"</p>
                  
                  <h4 className="font-bold text-teal-400 mb-2"> AI 상세 피드백:</h4>
                  {/* ⭐️ [수정] 여기도 동일하게 <div>로 감싸고 className 이동 */}
                  <div className="bg-slate-900 p-4 rounded-md text-slate-200 whitespace-pre-line leading-relaxed prose prose-invert max-w-none">
                    <ReactMarkdown>
                      {item.feedback}
                    </ReactMarkdown>
                  </div>
                  
                  <h4 className="font-bold text-blue-400 mt-4 mb-2">비언어적 요소 점수:</h4>
                  <div className="flex flex-wrap gap-4 text-center">
                    <div className="flex-1 min-w-[100px] bg-slate-700 p-3 rounded">
                      <span className="text-sm text-slate-400">표정/미소</span>
                      <p className="text-lg font-bold">{item.scores.expression}점</p>
                    </div>
                     <div className="flex-1 min-w-[100px] bg-slate-700 p-3 rounded">
                      <span className="text-sm text-slate-400">시선 처리</span>
                      <p className="text-lg font-bold">{item.scores.gaze}점</p>
                    </div>
                     <div className="flex-1 min-w-[100px] bg-slate-700 p-3 rounded">
                      <span className="text-sm text-slate-400">목소리(미구현)</span>
                      <p className="text-lg font-bold">{item.scores.tone}점</p>
                    </div>
                  </div>
                </div>
              </details>
            ))
          ) : (
             <p className="text-slate-400 text-center py-4">상세 피드백 데이터가 없습니다.</p>
          )}
        </div>
        
        <div className="text-center mt-12 mb-4">
           <button
            onClick={() => router.push('/')}
            className="w-full max-w-xs bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg text-xl transition-colors shadow-lg"
          >
            메인으로 돌아가기
          </button>
        </div>

      </div>
    </main>
  );
}