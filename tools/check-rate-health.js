'use strict';
const { freshness } = require('../js/rate-freshness.js');
function assess(meta, pages, run, now = Date.now()) {
  const errors = [];
  if (!meta || freshness(meta.fetchedAt, now) !== 'snapshot') errors.push('운영 금리 수집일이 없거나 잘못됐거나 8일을 초과했습니다.');
  for (const name of ['loan', 'savings']) {
    const html = pages?.[name];
    const date = typeof html === 'string' ? html.match(/data-rates-fetched="([^"]+)"/)?.[1] : null;
    if (!date || date !== meta?.fetchedAt) errors.push(name + ': 운영 표와 데이터 수집일이 다릅니다.');
  }
  if (!run) errors.push('최근 예약 금리 갱신 실행을 확인하지 못했습니다.');
  else if (run.status === 'completed' && run.conclusion !== 'success') errors.push('최근 예약 금리 갱신 실패: ' + run.conclusion);
  else if (!Number.isFinite(Date.parse(run.created_at)) || Date.parse(run.created_at) > now || now - Date.parse(run.created_at) > 8 * 86400000) errors.push('예약 금리 갱신 실행이 8일 넘게 없거나 시각을 확인할 수 없습니다.');
  else if (run.status !== 'completed' && now - Date.parse(run.created_at) > 2 * 3600000) errors.push('금리 갱신이 2시간 넘게 완료되지 않았습니다.');
  return errors;
}
module.exports = { assess };
if (require.main === module) (async () => {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'money-rate-health' };
  if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  async function read(url, json, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
    return json ? response.json() : response.text();
  }
  const base = 'https://money.jwapplab.com';
  const [meta, loan, savings, runs] = await Promise.all([
    read(base + '/data/rates/meta.json', true), read(base + '/loan/', false), read(base + '/savings/', false),
    read('https://api.github.com/repos/jwtoolandapp/money-calc/actions/workflows/refresh-rates.yml/runs?event=schedule&per_page=1', true, { headers })
  ]);
  const errors = assess(meta, { loan, savings }, runs.workflow_runs?.[0]);
  const summary = errors.length ? '금리 상태 확인 실패\n' + errors.join('\n') : '수집일 검사 통과: ' + meta.fetchedAt + ' / 운영 표 날짜 일치 / 최근 예약 실행 ' + (runs.workflow_runs[0].status === 'completed' ? '성공' : '진행 중(2시간 이내, 완료 확인 필요)');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) require('node:fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  if (errors.length) process.exitCode = 1;
})().catch(error => { console.error('금리 상태 확인 불가: ' + error.message); process.exitCode = 1; });
