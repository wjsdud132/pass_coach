import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      console.error('❌ Missing GEMINI_API_KEY in .env.local');
      return NextResponse.json(
        { error: 'AI 피드백 설정이 완료되지 않았습니다. 환경변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { questions, videoBase64Array, videoMimeType } = await req.json();

    if (!questions || !videoBase64Array || questions.length !== videoBase64Array.length) {
      return NextResponse.json(
        { error: '질문과 비디오의 개수가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // 모든 질문을 포맷팅
    const questionsText = questions.map((q: any, idx: number) => 
      `질문 ${idx + 1}: ${q.question || q}`
    ).join('\n');

    const prompt = `
    아래는 사용자가 면접에서 답변한 모든 질문과 비디오 답변입니다.
    ---
    ${questionsText}
    ---
    
    위의 모든 비디오 답변을 종합적으로 평가하고 피드백을 작성해주세요:
    
    1. 전체적인 답변 품질 평가 (내용, 논리성, 구체성)
    2. 비언어적 커뮤니케이션 평가 (표정, 자세, 손짓, 시선 처리)
    3. 말투와 발음의 명확성
    4. 각 답변의 강점과 개선점
    5. 논리성, 구체성, 표현력, 직무 적합성 관점에서의 종합 평가
    6. 면접 전반에 대한 총평과 향후 개선 방향 제시
    
    응원의 말투로 작성해주세요. 3-5문단 정도로 상세하게 작성해주세요.
    `;

    // 모든 비디오를 포함하여 요청
    const parts: any[] = [prompt];
    
    for (let i = 0; i < videoBase64Array.length; i++) {
      if (videoBase64Array[i]) {
        parts.push({
          inlineData: {
            data: videoBase64Array[i],
            mimeType: videoMimeType || 'video/webm',
          },
        });
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const feedback = response.text();

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('❌ [Video Feedback Summary Error]', error);
    return NextResponse.json(
      { error: error.message || 'AI 종합 비디오 피드백 생성 실패' },
      { status: 500 }
    );
  }
}




