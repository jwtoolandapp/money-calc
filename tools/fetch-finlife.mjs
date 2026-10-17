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

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && !API_KEY) {
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

  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);

  const body = await response.json();
  const result = body?.result;
  if (!result) throw new Error(`${endpoint}: result 필드 없음 — 응답 형식이 바뀌었을 수 있습니다.`);
  // err_cd 000 이 정상. 그 외는 키 오류/한도초과 등이라 조용히 넘기면 안 된다.
  if (result.err_cd && result.err_cd !== '000') {
    throw new Error(`${endpoint}: API 오류 [${String(result.err_cd).replace(/[^a-zA-Z0-9]/g, '')}]`);
  }
  return result;
}

export async function fetchAllPages(endpoint, load = callApi) {
  const baseList = [];
  const optionList = [];
  let pageNo = 1;
  let maxPage = 1;

  do {
    const result = await load(endpoint, pageNo);
    if (!Array.isArray(result.baseList) || !Array.isArray(result.optionList)) throw new Error(`${endpoint}: invalid product lists`);
    const reportedMax = Number(result.max_page_no);
    if (!Number.isInteger(reportedMax) || reportedMax < 1 || reportedMax > 20) throw new Error(`${endpoint}: invalid/excessive page count`);
    if (pageNo > 1 && reportedMax !== maxPage) throw new Error(`${endpoint}: page count changed during collection`);
    baseList.push(...(result.baseList ?? []));
    optionList.push(...(result.optionList ?? []));
    maxPage = reportedMax;
    pageNo += 1;
  } while (pageNo <= maxPage); // 폭주 방지 상한

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

function productKey(item) {
  if (!item.fin_co_no || !item.fin_prdt_cd) throw new Error('Product identity is incomplete');
  return `${item.fin_co_no}:${item.fin_prdt_cd}`;
}

/** 예·적금: 저축기간(개월)별 기본금리·최고금리를 상품에 붙인다. */
export function shapeSavingProducts({ baseList, optionList }) {
  const optionsByProduct = new Map();
  for (const option of optionList) {
    const list = optionsByProduct.get(productKey(option)) ?? [];
    list.push({
      months: toNumber(option.save_trm),
      rateType: option.intr_rate_type_nm ?? null,
      baseRate: toNumber(option.intr_rate),
      maxRate: toNumber(option.intr_rate2),
    });
    optionsByProduct.set(productKey(option), list);
  }

  return baseList.map((product) => ({
    bank: product.kor_co_nm ?? null,
    name: product.fin_prdt_nm ?? null,
    joinWay: product.join_way ?? null,
    specialCondition: product.spcl_cnd ?? null,
    maxLimit: toNumber(product.max_limit),
    disclosedAt: product.dcls_strt_day ?? null,
    options: (optionsByProduct.get(productKey(product)) ?? [])
      .filter((option) => option.months !== null)
      .sort((a, b) => a.months - b.months),
  }));
}

/** 대출: 금리유형별 평균·최저·최고 금리를 붙인다. */
export function shapeLoanProducts({ baseList, optionList }) {
  const optionsByProduct = new Map();
  for (const option of optionList) {
    const list = optionsByProduct.get(productKey(option)) ?? [];
    list.push({
      rateType: option.lend_rate_type_nm ?? null,
      repayType: option.rpay_type_nm ?? null,
      minRate: toNumber(option.lend_rate_min),
      maxRate: toNumber(option.lend_rate_max),
      averageRate: toNumber(option.lend_rate_avg),
    });
    optionsByProduct.set(productKey(option), list);
  }

  return baseList.map((product) => ({
    bank: product.kor_co_nm ?? null,
    name: product.fin_prdt_nm ?? null,
    joinWay: product.join_way ?? null,
    disclosedAt: product.dcls_strt_day ?? null,
    options: optionsByProduct.get(productKey(product)) ?? [],
  }));
}

// Complete and validate all four responses before replacing any stored snapshot.
export async function collectSnapshot(load = callApi, now = new Date()) {
  const files = new Map(), summary = [];
  for (const dataset of DATASETS) {
    const raw = await fetchAllPages(dataset.endpoint, load);
    const isLoan = dataset.key === 'mortgage' || dataset.key === 'rent';
    const products = isLoan ? shapeLoanProducts(raw) : shapeSavingProducts(raw);
    if (!products.length || products.some(p => !p.bank || !p.name)) throw new Error(`${dataset.key}: empty or unnamed products`);
    const usable = products.some(p => p.options.some(o => isLoan ? o.averageRate > 0 : o.months === 12 && (o.baseRate !== null || o.maxRate !== null)));
    if (!usable) throw new Error(`${dataset.key}: no usable comparison rates`);
    files.set(`${dataset.key}.json`, {label:dataset.label, source:'finlife.fss.or.kr', products});
    summary.push({key:dataset.key,label:dataset.label,count:products.length});
  }
  const fetchedAt = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(now);
  files.set('meta.json', {fetchedAt,finGroup:FIN_GROUP,finGroupLabel:'은행',source:{name:'금융감독원 금융상품통합비교공시',url:'https://finlife.fss.or.kr'},datasets:summary});
  return files;
}

if (isMain) {
  try {
    if (VERIFY_ONLY) {
      const result = await callApi('depositProductsSearch', 1);
      console.log(`인증키 정상. 정기예금 ${result.total_count}건 조회 가능`);
    } else {
      const files = await collectSnapshot();
      await mkdir(OUT_DIR, {recursive:true});
      for (const [name, data] of files) await writeFile(path.join(OUT_DIR,name), JSON.stringify(data,null,2), 'utf8');
      console.log(`data/rates/ 갱신 완료 (기준일 ${files.get('meta.json').fetchedAt})`);
      console.log('다음: node tools/render-rates.mjs 로 정적 HTML 에 반영하세요.');
    }
  } catch (error) {
    // Do not log a fetch cause/URL: it can contain the API credential.
    console.error(`금리 수집 실패: ${error.message.replaceAll(API_KEY, '[redacted]')}`);
    process.exitCode = 1;
  }
}
