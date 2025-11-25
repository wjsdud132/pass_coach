// app/api/stt/route.ts (새 파일)
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// .env.local 파일에서 OPENAI_API_KEY를 읽어옵니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY in .env.local');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: '오디오 파일이 없습니다.' }, { status: 400 });
    }

    // OpenAI Whisper API로 오디오 파일 전송
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1', // STT 모델
      response_format: 'text',
      language: 'ko', // 한국어 설정
    });

    // 변환된 텍스트 반환
    return NextResponse.json({ transcription: transcription as string });

  } catch (error: any) {
    console.error('❌ [STT API Error]:', error);
    const errorMessage = error instanceof Error ? error.message : "STT 처리 중 오류 발생";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}