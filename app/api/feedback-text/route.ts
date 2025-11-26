// app/api/feedback-text/route.ts (말투 및 내용 정리 수정본)
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
    
   
    const prompt = `
    당신은 전문 채용 면접관입니다. 아래 면접 질문과 답변을 분석하세요.

    [질문]
    ${question}

    [답변]
    ${answer}

    [피드백 요청]
    답변을 다음 항목으로 나누어 피드백을 작성해주세요: 이상한 이모티콘이랑 이모지는 사용하지 않습니다.
    마크다운으로 깔끔하게 한 눈에 알아 볼 수 있게 작성합니다 문단 구조도 잘 나눕니다.
    - [Good]: 답변에서 잘한 점 1-2가지.
    - [Bad]: 답변에서 아쉬운 점 1-2가지.
    - [Suggestion]: 답변을 개선하기 위한 구체적인 제안 1-2가지. (예시 답변 포함)
    - [유창성]: 텍스트의 표현이 명확하고 전문적인지, 혹은 어눌하거나 불필요한 내용이 있는지 평가.

    [규칙]
    - 어조: 전문적이고 객관적인 채용 담당자의 어조를 사용하세요. ("~했습니다", "~합니다", "~해야 합니다" 스타일)
    - 형식: 마크다운(Markdown)을 사용하여 항목별로 명확히 구분해주세요.
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