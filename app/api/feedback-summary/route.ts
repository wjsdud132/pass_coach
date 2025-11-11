// app/api/feedback-summary/route.ts (스타일 수정본)
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

    const qaPairs = questions.map((q: any, idx: number) => 
      `[질문 ${idx + 1}: ${q.question || q}]\n[답변 ${idx + 1}: ${answers[idx] || '(답변 안 함)'}]`
    ).join('\n\n');

    // ⭐️ [수정] 프롬프트 스타일 변경 (이미지 참고)
    const prompt = `
    당신은 전문 채용 담당자입니다. 
    아래는 지원자가 면접에서 답변한 모든 질문과 답변 (STT 변환 텍스트)입니다.
    ---
    ${qaPairs}
    ---
    
    위의 모든 답변을 종합적으로 평가하고, 전문 채용 담당자의 어조로 최종 피드백을 작성해주세요.
    다음 항목을 반드시 포함하여 마크다운으로 구조화하세요: 그 어디에도 이모지 사용하지 않습니다.
    

    ### 1. 종합 평가
    (여기에 면접 전반에 대한 총평을 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)
    

    ### 2. 주요 강점 (Top 3)
    (여기에 가장 인상 깊었거나 잘한 점 3가지를 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)
    

    ### 3. 주요 약점 (Top 3)
    (여기에 가장 시급하게 개선해야 할 점 3가지를 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)
    

    ### 4. 최종 조언
    (여기에 지원자를 위한 최종 핵심 조언 1-2문장을 작성하세요. **내용에는 절대 \`**\`나 \`*\`를 사용하지 마세요.**)

    [규칙]
    - **어조**: 전문적이고 객관적인 채용 담당자의 어조. ("~했습니다", "~합니다", "~해야 합니다" 스타일)
    - **형식**: 오직 '###' 제목과 일반 텍스트 단락만 사용하세요.
    - **금지**: 본문 내용에 \`**\`(굵게)나 \`*\`(글머리 기호)를 절대 사용하지 마세요.
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