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

    // ✅ 1️⃣ 공고 내용 크롤링
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const jobDescription = $('body').text().replace(/\s+/g, ' ').trim();

    // ✅ 2️⃣ 프롬프트 (JSON만 반환하도록 강제)
    const prompt = `
You are an expert interviewer.
Based on the following job description for "${jobTitle}",
generate EXACTLY 5 interview questions in PURE JSON.
⚠️ Output ONLY JSON array — no explanations or markdown.

Each item must include:
- "type": one of ["Technical", "Behavioral", "General"]
- "question": a single clear question.

Job Description:
${jobDescription}

Return ONLY:
[
  { "type": "Technical", "question": "..." },
  { "type": "Behavioral", "question": "..." },
  { "type": "General", "question": "..." }
]
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
