// app/api/feedback-video/route.ts (스타일 수정본)
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
    const { question, videoBase64, videoMimeType } = await req.json();

    if (!videoBase64) {
      return NextResponse.json(
        { error: '오디오 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); 

    // ⭐️ [수정] 프롬프트 스타일 변경
    const prompt = `
    당신은 전문 채용 면접관입니다. 
    아래 면접 [질문]에 대한 지원자의 [답변 오디오]를 듣고 분석하세요.

    [질문]
    ${question}

    [피드백 요청]
    오디오를 듣고, 다음 항목으로 나누어 피드백을 작성해주세요: 그 어디에도 이모지 사용하지 않습니다.

    **[Good]**
    (여기에 답변 내용의 논리성, 구체성 등 잘한 점 1-2가지를 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)

    **[Bad]**
    (여기에 답변 내용에서 아쉬운 점 1-2가지를 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)

    **[Suggestion]**
    (여기에 답변 내용을 개선하기 위한 구체적인 제안 1-2가지를 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)

    **[발음 및 말투]**
    (여기에 목소리 톤, 발음의 명확성, "어..." 같은 불필요한 추임새, 말의 속도(어눌함) 등을 평가하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)

    [규칙]
    - **어조**: 전문적이고 객관적인 채용 담당자의 어조.
    - **형식**: \`**[소제목]**\`과 일반 텍스트 단락만 사용하세요.
    - **금지**: 본문 내용에 \`**\`(굵게)나 \`*\`(글머리 기호)를 절대 사용하지 마세요.
    `;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: videoBase64,
          mimeType: videoMimeType || 'audio/webm',
        },
      },
    ]);

    const response = await result.response;
    const feedback = response.text();

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('❌ [Video Feedback Error]', error);
    return NextResponse.json(
      { error: error.message || 'AI 오디오 피드백 생성 실패' },
      { status: 500 }
    );
  }
}