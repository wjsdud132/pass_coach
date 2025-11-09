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
    const { questions, answers } = await req.json();

    if (!questions || !answers || questions.length !== answers.length) {
      return NextResponse.json(
        { error: '질문과 답변의 개수가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // 모든 질문과 답변을 포맷팅
    const qaPairs = questions.map((q: any, idx: number) => 
      `질문 ${idx + 1}: ${q.question || q}\n답변 ${idx + 1}: ${answers[idx] || ''}`
    ).join('\n\n');

    const prompt = `
    아래는 사용자가 면접에서 답변한 모든 질문과 답변입니다.
    ---
    ${qaPairs}
    ---
    
    위의 모든 답변을 종합적으로 평가하고 피드백을 작성해주세요:
    
    1. 전체적인 답변 품질 평가
    2. 각 답변의 강점과 개선점
    3. 논리성, 구체성, 표현력, 직무 적합성 관점에서의 종합 평가
    4. 면접 전반에 대한 총평과 향후 개선 방향 제시
    
    응원의 말투로 작성해주세요. 3-5문단 정도로 상세하게 작성해주세요.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedback = response.text(); 

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('❌ [Feedback Summary Error]', error);
    return NextResponse.json(
      { error: error.message || 'AI 종합 피드백 생성 실패' },
      { status: 500 }
    );
  }
}

