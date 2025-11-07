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
    const { question, answer } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
    아래는 사용자의 면접 답변입니다.
    ---
    질문: ${question}
    답변: ${answer}
    ---
    위 답변을 다음 기준으로 평가하고 피드백을 작성해주세요:
    - 논리성
    - 구체성
    - 표현력
    - 직무 적합성
    각각에 대해 간단히 언급하고, 마지막에 총평을 2~3문장으로 써주세요.
    응원의 말투로 작성해주세요.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedback = response.text(); 

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('❌ [Feedback Error]', error);
    return NextResponse.json(
      { error: error.message || 'AI 피드백 생성 실패' },
      { status: 500 }
    );
  }
}


