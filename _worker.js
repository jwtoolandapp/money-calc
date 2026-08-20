// pages.dev 미러만 운영 도메인으로 301. 커스텀 도메인 요청은 그대로 정적 자산 서빙.
// 애드센스 "가치가 별로 없는 콘텐츠" 대응 — 중복 색인 제거 (2026-08-19)
const MIRRORS = { "money-calc-2ou.pages.dev": "money.jwapplab.com" };

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const target = MIRRORS[url.hostname];
    if (target) {
      url.protocol = "https:";
      url.hostname = target;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
