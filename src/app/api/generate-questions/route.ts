// app/api/generate-questions/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";

// .env.local 파일에서 API 키를 불러옵니다.
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// URL 없이 직군만 선택했을 때 사용할 샘플 데이터
const mock_questions_data = {
    "프론트엔드 개발자": [
        {"type": "기술 심층", "question": "React의 Virtual DOM 동작 원리와 그 필요성에 대해 설명해주세요."},
        {"type": "경험 기반", "question": "TypeScript를 사용하면서 가장 이점을 본 경험과 어려웠던 점은 무엇인가요?"},
        {"type": "상황 대처", "question": "API 응답이 매우 느린 상황에서, 사용자 경험을 개선하기 위한 프론트엔드 단의 해결책 3가지를 제시해보세요."}
    ],
    "백엔드 개발자": [
        {"type": "기술 심층", "question": "RESTful API의 특징과 idempotency(멱등성)에 대해 설명해주세요."},
        {"type": "경험 기반", "question": "대용량 트래픽을 처리하기 위해 데이터베이스 쿼리를 튜닝해 본 경험이 있나요?"},
        {"type": "상황 대처", "question": "운영 중인 서비스에서 갑자기 서버 CPU 사용량이 100%가 되었다면, 어떻게 원인을 찾고 해결하시겠습니까?"}
    ],
    "UI/UX 디자이너": [
        {"type": "포트폴리오", "question": "본인의 포트폴리오에서 가장 애착이 가는 프로젝트와 그 디자인 과정, 그리고 결과에 대해 설명해주세요."},
        {"type": "경험 기반", "question": "사용자 리서치를 진행했던 경험이 있다면, 어떤 방법론을 사용했고 어떤 인사이트를 얻었는지 말씀해주세요."},
        {"type": "상황 대처", "question": "기획자와 개발자 간에 디자인 구현에 대한 이견이 발생했을 때, 어떻게 조율하고 해결했는지 경험을 말씀해주세요."}
    ]
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_category, job_url } = body;

    if (!job_url && job_category) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const questions = mock_questions_data[job_category as keyof typeof mock_questions_data] || [];
        return NextResponse.json({ questions });
    }

    if (!job_url) {
        throw new Error("채용 공고 URL을 입력해주세요.");
    }
    
    let jobText = '';
    try {
        const response = await axios.get(job_url, {
            timeout: 8000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, aside, form').remove();
        jobText = $('body').text();
        jobText = jobText.replace(/\s\s+/g, ' ').trim().slice(0, 10000);
    } catch (scrapeError) {
        console.error("Scraping failed:", scrapeError);
        throw new Error("채용 공고 URL을 불러오는 데 실패했습니다. 유효한 주소인지, 혹은 사이트에서 접속을 막고 있는지 확인해주세요.");
    }

    const prompt = `
      You are a top-tier HR specialist who creates sharp interview questions based on job descriptions.
      [Job Description Text]
      ${jobText}

      [Mission]
      Based on the text above, generate 5 insightful interview questions to verify a candidate's skills.
      Include a mix of 'Behavioral', 'Technical', and 'Situational' questions.
      Your entire response must be ONLY a valid JSON array format like the example below. Do not include any other text, comments, or markdown formatting.

      [Output Format Example]
      [
        {"type": "Behavioral", "question": "Tell me about a time you had to handle a tight deadline."},
        {"type": "Technical", "question": "Explain the concept of RESTful APIs."}
      ]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const result = await model.generateContent(prompt);
    const aiResponseText = await result.response.text();

    let questions;
    try {
      const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonString = cleanedText.match(/(\[[\s\S]*\])/)?.[0];
      if (!jsonString) throw new Error("Invalid JSON format from AI.");
      questions = JSON.parse(jsonString);
    } catch(parseError) {
      console.error("Failed to parse AI response:", aiResponseText);
      throw new Error("AI로부터 받은 응답을 처리하는 데 실패했습니다.");
    }

    return NextResponse.json({ questions });

  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}