/**
 * 금융감독원 금융상품통합비교공시(finlife) API 에서 은행 예·적금·대출 금리를 받아
 * data/rates/*.json 으로 저장한다.
 *
 * 왜 빌드타임인가:
 *   money-calc 는 Cloudflare Pages 정적 사이트다. 브라우저에서 직접 부르면
 *   (1) CORS 에 막히고 (2) 인증키가 노출되고 (3) 네이버 Yeti 는 JS 를 안 돌려서
 *   금리 표를 못 읽는다. 그래서 여기서 받아 JSON 으로 커밋하고,
 *   tools/render-rates.mjs 가 정적 HTML 로 굽는다.
 *
 * 인증키 발급: https://finlife.fss.or.kr → 오픈API → 인증키 신청 (무료·즉시)
 *
 * 사용법:
 *   FINLIFE_API_KEY=xxxx node tools/fetch-finlife.mjs
 *   node tools/fetch-finlife.mjs --verify      키 유효성만 1회 호출로 확인
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'rates');
const BASE = 'https://finlife.fss.or.kr/finlifeapi';
const API_KEY = process.env.FINLIFE_API_KEY;
const VERIFY_ONLY = process.argv.includes('--verify');

// 020000 = 은행. 저축은행(030300)까지 넓히면 금리는 높지만 상품 성격이 달라
// 계산기 기본값 참고용으로는 은행만 쓴다.
const FIN_GROUP = '020000';

const DATASETS = [
  { key: 'deposit', endpoint: 'depositProductsSearch', label: '정기예금' },
  { key: 'saving', endpoint: 'savingProductsSearch', label: '적금' },
  { key: 'mortgage', endpoint: 'mortgageLoanProductsSearch', label: '주택담보대출' },
  { key: 'rent', endpoint: 'rentHouseLoanProductsSearch', label: '전세자금대출' },
];

if (!API_KEY) {
  console.error(
    '환경변수 FINLIFE_API_KEY 가 없습니다.\n' +
    '  발급: https://finlife.fss.or.kr → 오픈API → 인증키 신청 (무료)\n' +
    '  실행: FINLIFE_API_KEY=발급받은키 node tools/fetch-finlife.mjs'
  );
  process.exit(2);
}

async function callApi(endpoint, pageNo) {
  const url = `${BASE}/${endpoint}.json?auth=${encodeURIComponent(API_KEY)}` +
    `&topFinGrpNo=${FIN_GROUP}&pageNo=${pageNo}`;

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);

  const body = await response.json();
  const result = body?.result;
  if (!result) throw new Error(`${endpoint}: result 필드 없음 — 응답 형식이 바뀌었을 수 있습니다.`);
  // err_cd 000 이 정상. 그 외는 키 오류/한도초과 등이라 조용히 넘기면 안 된다.
  if (result.err_cd && result.err_cd !== '000') {
    throw new Error(`${endpoint}: [${result.err_cd}] ${result.err_msg ?? '알 수 없는 오류'}`);
  }
  return result;
}

async function fetchAllPages(endpoint) {
  const baseList = [];
  const optionList = [];
  let pageNo = 1;
  let maxPage = 1;

  do {
    const result = await callApi(endpoint, pageNo);
    baseList.push(...(result.baseList ?? []));
    optionList.push(...(result.optionList ?? []));
    maxPage = Number(result.max_page_no) || 1;
    pageNo += 1;
  } while (pageNo <= maxPage && pageNo <= 20); // 폭주 방지 상한

  return { baseList, optionList };
}

const toNumber = (value) => {
  // 이 API 는 값이 없는 항목을 빈 문자열로 준다. Number('') 는 0 이므로
  // 그대로 두면 "평균금리 0.00%" 같은 가짜 숫자가 만들어지고,
  // 낮은 금리 순 정렬에서 그 상품들이 맨 위를 차지한다.
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** 예·적금: 저축기간(개월)별 기본금리·최고금리를 상품에 붙인다. */
function shapeSavingProducts({ baseList, optionList }) {
  const optionsByProduct = new Map();
  for (const option of optionList) {
    const list = optionsByProduct.get(option.fin_prdt_cd) ?? [];
    list.push({
      months: toNumber(option.save_trm),
      rateType: option.intr_rate_type_nm ?? null,
      baseRate: toNumber(option.intr_rate),
      maxRate: toNumber(option.intr_rate2),
    });
    optionsByProduct.set(option.fin_prdt_cd, list);
  }

  return baseList.map((product) => ({
    bank: product.kor_co_nm ?? null,
    name: product.fin_prdt_nm ?? null,
    joinWay: product.join_way ?? null,
    specialCondition: product.spcl_cnd ?? null,
    maxLimit: toNumber(product.max_limit),
    disclosedAt: product.dcls_strt_day ?? null,
    options: (optionsByProduct.get(product.fin_prdt_cd) ?? [])
      .filter((option) => option.months !== null)
      .sort((a, b) => a.months - b.months),
  }));
}

/** 대출: 금리유형별 평균·최저·최고 금리를 붙인다. */
function shapeLoanProducts({ baseList, optionList }) {
  const optionsByProduct = new Map();
  for (const option of optionList) {
    const list = optionsByProduct.get(option.fin_prdt_cd) ?? [];
    list.push({
      rateType: option.lend_rate_type_nm ?? null,
      repayType: option.rpay_type_nm ?? null,
      minRate: toNumber(option.lend_rate_min),
      maxRate: toNumber(option.lend_rate_max),
      averageRate: toNumber(option.lend_rate_avg),
    });
    optionsByProduct.set(option.fin_prdt_cd, list);
  }

  return baseList.map((product) => ({
    bank: product.kor_co_nm ?? null,
    name: product.fin_prdt_nm ?? null,
    joinWay: product.join_way ?? null,
    disclosedAt: product.dcls_strt_day ?? null,
    options: optionsByProduct.get(product.fin_prdt_cd) ?? [],
  }));
}

// process.exit() 을 쓰지 않는다. fetch 소켓이 아직 열린 상태에서 강제 종료하면
// Windows 의 libuv 가 assertion 으로 죽으면서 종료코드가 127 로 나온다.
// exitCode 만 세팅하고 이벤트 루프가 알아서 비워지게 둔다.
if (VERIFY_ONLY) {
  try {
    const result = await callApi('depositProductsSearch', 1);
    console.log(`인증키 정상. 정기예금 ${result.total_count}건 조회 가능 (${result.max_page_no}페이지)`);
  } catch (error) {
    console.error(`인증키 확인 실패: ${error.message}`);
    process.exitCode = 1;
  }
} else {

await mkdir(OUT_DIR, { recursive: true });

const summary = [];
for (const dataset of DATASETS) {
  const raw = await fetchAllPages(dataset.endpoint);
  const isLoan = dataset.key === 'mortgage' || dataset.key === 'rent';
  const products = isLoan ? shapeLoanProducts(raw) : shapeSavingProducts(raw);

  await writeFile(
    path.join(OUT_DIR, `${dataset.key}.json`),
    JSON.stringify({ label: dataset.label, source: 'finlife.fss.or.kr', products }, null, 2),
    'utf8'
  );
  summary.push({ key: dataset.key, label: dataset.label, count: products.length });
  console.log(`  ${dataset.label}: ${products.length}개 상품`);
}

// 기준일은 페이지에 반드시 표기한다. 언제 받은 금리인지 안 밝히면
// 금리 정보는 오히려 신뢰를 깎는다.
// 한국 이용자에게 보여줄 날짜이므로 KST 로 찍는다. toISOString() 은 UTC 라
// 한국 새벽에 돌리면 기준일이 하루 전으로 나온다.
const fetchedAt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
await writeFile(
  path.join(OUT_DIR, 'meta.json'),
  JSON.stringify({
    fetchedAt,
    finGroup: FIN_GROUP,
    finGroupLabel: '은행',
    source: {
      name: '금융감독원 금융상품통합비교공시',
      url: 'https://finlife.fss.or.kr',
    },
    datasets: summary,
  }, null, 2),
  'utf8'
);

console.log(`\ndata/rates/ 갱신 완료 (기준일 ${fetchedAt})`);
console.log('다음: node tools/render-rates.mjs 로 정적 HTML 에 반영하세요.');

}
