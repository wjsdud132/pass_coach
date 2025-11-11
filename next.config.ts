import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⭐️ VAD 라이브러리를 번들링하도록 설정
  transpilePackages: ['@ricky0123/vad-web'],
  
  webpack: (config, { isServer }) => {
    // .wasm 모듈을 불러올 수 있도록 웹팩 로더 설정 추가
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    
    // ⭐️ 소스 맵 관련 설정으로 인한 소스 파일 요청 방지
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
    return config;
  },
  // ⭐️ 소스 맵 비활성화로 소스 파일 요청 방지
  productionBrowserSourceMaps: false,
};

export default nextConfig;
