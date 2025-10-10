// app/api/generate-questions/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('❌ Missing GEMINI_API_KEY in .env.local');
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { jobTitle, url } = await req.json();
    let jobDescription = '';

    // ✅ 1️⃣ URL이 있을 때만 크롤링 시도
    if (url && url.trim() !== '') {
      try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        jobDescription = $('body').text().replace(/\s+/g, ' ').trim();
      } catch (err) {
        console.warn('⚠️ URL을 불러올 수 없습니다. 대신 직군명만 사용합니다.');
      }
    }

    // ✅ 2️⃣ 프롬프트 (한국어 + JSON 강제)
    const prompt = `
당신은 채용 면접 전문가입니다.  
${url ? `다음 채용 공고(${url})` : `"${jobTitle}" 직무`}를 참고하여,  
해당 직무에 맞는 **면접 질문 5개를 한국어로** 생성하세요.

⚠️ 반드시 **JSON 배열 형식으로만** 출력하세요.  
⚠️ JSON 외의 다른 설명, 문장, 마크다운은 포함하지 마세요.

각 항목은 다음 형식을 따라야 합니다:
[
  { "type": "기술", "question": "..." },
  { "type": "행동", "question": "..." },
  { "type": "일반", "question": "..." }
]

${jobDescription ? `직무 설명:\n${jobDescription}` : ''}
`;

    console.log('🧠 Sending prompt to Gemini...');

    // ✅ 3️⃣ 모델 호출
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);

    // ✅ 4️⃣ 응답 텍스트 추출
    const aiResponseText = result.response.text().trim();
    console.log('✅ Raw AI Response:', aiResponseText);

    // ✅ 5️⃣ JSON 배열 부분만 추출
    const jsonMatch = aiResponseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('❌ No valid JSON array found in Gemini response');

    // ✅ 6️⃣ JSON 파싱
    const questions = JSON.parse(jsonMatch[0]);

    // ✅ 7️⃣ 클라이언트로 반환
    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('❌ [Server Error]', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
