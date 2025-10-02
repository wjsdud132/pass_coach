# 합격 코치 (PASS COACH)

AI 기반 맞춤형 모의 면접 서비스입니다. 채용 공고를 분석하여 해당 직무에 특화된 면접 질문을 자동 생성해드립니다.

## 프로그램 소개

**합격 코치**는 Google Gemini AI를 활용하여 채용 공고를 분석하고, 해당 직무에 맞는 맞춤형 면접 질문을 생성하는 웹 애플리케이션입니다.

### 주요 기능
- 📝 **채용 공고 URL 분석**: 실제 채용 공고를 크롤링하여 핵심 요구사항 추출
- 🤖 **AI 맞춤 질문 생성**: Gemini AI를 활용한 직무별 맞춤형 면접 질문 생성
- 💼 **다양한 직군 지원**: 프론트엔드, 백엔드, UI/UX 디자이너 등
- 📱 **반응형 웹 디자인**: 모바일과 데스크톱 모두 지원
- ⚡ **실시간 질문 생성**: 빠른 속도로 질문 생성 및 면접 진행

### 지원 직군
- 프론트엔드 개발자
- 백엔드 개발자  
- UI/UX 디자이너
- 기타 직군 (채용 공고 URL 분석)

## 실행 방법

### 1. 저장소 클론
```bash
git clone https://github.com/wjsdud132/pass_coach.git
cd pass_coach
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 Google AI API 키를 추가하세요:

```bash
GOOGLE_API_KEY=your_google_ai_api_key_here
```

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 브라우저에서 확인
[http://localhost:3000](http://localhost:3000)에서 애플리케이션을 확인할 수 있습니다.

## 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI**: Google Gemini AI
- **Web Scraping**: Axios, Cheerio
- **Deployment**: Vercel (권장)

## 사용 방법

1. **직군 선택 또는 채용 공고 URL 입력**
   - 드롭다운에서 직군을 선택하거나
   - 채용 공고 URL을 직접 입력 (권장)

2. **AI 맞춤 질문 생성**
   - "AI 맞춤 질문 생성하기" 버튼 클릭
   - AI가 채용 공고를 분석하여 질문 생성

3. **모의 면접 진행**
   - 생성된 질문을 순차적으로 확인
   - 실제 면접처럼 답변을 준비해보세요

4. **면접 완료**
   - 모든 질문을 완료하면 면접 종료
