// app/api/feedback-text/route.ts (3번 요청 - "어눌함" 피드백 프롬프트 수정)
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      console.error('❌ Missing GEMINI_API_KEY in .env.local');
      return NextResponse.json(
        { error: 'AI 피드백 설정이 완료되지 않았습니다. 환경변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Request body parsing error:", parseError);
      return NextResponse.json(
        { error: '요청 데이터 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { question, answer } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: "질문 또는 답변이 누락되었습니다." },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    // ⭐️ [수정] 3번 요청: 텍스트 기반으로 "유창성"과 "명확성" (어눌함)을 판단하도록 프롬프트 수정
    const prompt = `
    아래는 사용자의 면접 답변입니다.
    ---
    질문: ${question}
    답변: ${answer}
    ---
    위 답변을 다음 기준으로 평가하고 피드백을 작성해주세요:
    - 논리성: 질문의 의도를 파악하고 논리적으로 답변했는가?
    - 구체성: 경험이나 예시를 들어 구체적으로 설명하는가?
    - 직무 적합성: 답변 내용이 직무 역량과 잘 연결되는가?
    - 표현력 및 유창성: 문장이 명확하고, 불필요한 군더더기나 어눌한 표현 없이 자연스러운가?
    
    각각에 대해 간단히 언급하고, 마지막에 총평을 2~3문장으로 써주세요.
    응원의 말투로 작성해주세요.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedback = response.text();

    return NextResponse.json({
      transcription: answer, // 텍스트 입력이므로 원본 answer가 transcription
      feedback: feedback,
    });

  } catch (error: any) {
    console.error("❌ [Text Feedback API Error]:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}