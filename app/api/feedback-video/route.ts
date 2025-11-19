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
        { error: '비디오 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
    아래는 사용자의 면접 답변 비디오입니다.
    ---
    질문: ${question}
    ---
    
    이 비디오를 보고 다음 기준으로 평가하고 피드백을 작성해주세요:
    - 말하는 내용의 논리성과 구체성
    - 표정과 눈 접촉 (시선 처리)
    - 자세와 손짓 (비언어적 커뮤니케이션)
    - 말투와 발음의 명확성
    - 전반적인 자신감과 표현력
    - 직무 적합성
    
    각각에 대해 간단히 언급하고, 마지막에 총평을 2~3문장으로 써주세요.
    응원의 말투로 작성해주세요.
    `;

    // 비디오를 base64에서 File 객체로 변환
    const videoData = Buffer.from(videoBase64, 'base64');
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: videoBase64,
          mimeType: videoMimeType || 'video/webm',
        },
      },
    ]);

    const response = await result.response;
    const feedback = response.text();

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('❌ [Video Feedback Error]', error);
    return NextResponse.json(
      { error: error.message || 'AI 비디오 피드백 생성 실패' },
      { status: 500 }
    );
  }
}


