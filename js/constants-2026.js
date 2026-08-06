(function (global) {
  'use strict';

  /**
   * 머니데스크 2026 계산 상수 모음.
   * 제도·세율·점수·공제 한도는 반드시 이 파일에서만 관리합니다.
   *
   * [검증 이력]
   * 2026-07-27 Claude 1차 검증 완료 — 소득세율표·근로소득공제·카드공제·연금계좌·
   * 월세·청약 배점표·중도상환수수료 부과기간을 공개 자료와 대조. 상세는 각 항목 주석.
   * "간이 계산 특성상 미반영" 표시가 있는 항목은 의도적 단순화이며 오류가 아님.
   */
  const constants = {
    META: {
      REFERENCE_YEAR: 2026,
      SITE_NAME: '머니데스크',
    },

    MATH: {
      ZERO: 0,
      ONE: 1,
      TWO: 2,
      HUNDRED: 100,
      DECIMAL_BASE: 10,
      MONTHS_PER_YEAR: 12,
      DAYS_PER_MONTH: 30,
      DAYS_PER_YEAR: 365,
      WON_ROUNDING_DIGITS: 0,
      RATE_DISPLAY_DIGITS: 2,
    },

    STOCK_AVERAGE: {
      // UI 표시 기준(제도 상수 아님).
      ASSET_TYPES: {
        krw: { label: '원', moneyUnit: '원', priceDigits: 0, quantityDigits: 0 },
        usd: { label: '달러', moneyUnit: '달러', priceDigits: 2, quantityDigits: 4 },
        coin: { label: '코인', moneyUnit: '원', priceDigits: 0, quantityDigits: 8 },
      },
      TARGET_EPSILON: 0.00000001,
      MIN_PURCHASE_ROWS: 1,
    },

    LOAN: {
      RATE_DIVISOR: 100,
      MONTHS_PER_YEAR: 12,
      MIN_TERM_MONTHS: 1,
      // 계산기 안전 범위: 최대 50년(제도 한도 아님).
      MAX_TERM_MONTHS: 600,
      // 검증 완료(2026-07-27): 중도상환수수료 부과기간은 통상 대출 실행일부터 3년(36개월),
      // 3년 경과 시 면제가 일반적. 금융사·상품별 상이하므로 UI에서 사용자 입력을 우선한다.
      PREPAYMENT_FEE_TOTAL_MONTHS: 36,
      // 참고(2026-07-27 검증): 2025-01-13 이후 신규 체결 대출부터 중도상환수수료가 대폭 인하됨.
      // 주담대 평균 약 1.2~1.4% → 약 0.6~0.7%. 그 이전 체결 대출은 종전 요율 적용.
      // 요율은 사용자 입력값이므로 상수로 강제하지 않고, 페이지 도움말에 이 기준을 안내할 것.
      PREPAYMENT_FEE_HINT: {
        NEW_LOAN_SINCE: '2025-01-13',
        TYPICAL_RATE_NEW: 0.7,   // % (2025-01-13 이후 신규, 주담대 평균)
        TYPICAL_RATE_OLD: 1.4,   // % (그 이전 체결, 주담대 고정금리 평균)
      },
      // 대환 비교는 원리금균등 상환을 공통 가정으로 사용(간이 비교 목적. 화면에 가정 명시할 것).
      REFINANCE_ASSUMED_METHOD: 'annuity',
      METHODS: {
        ANNUITY: 'annuity',
        EQUAL_PRINCIPAL: 'equal-principal',
        BULLET: 'bullet',
      },
    },

    CHUNGYAK: {
      // 검증 완료(2026-07-27): 민영주택 가점제 84점 = 무주택기간 32 + 부양가족 35 + 통장 17.
      // 무주택기간: 1년 미만 2점, 1년마다 +2점, 15년 이상 32점.
      // 기산일 = 만 30세가 된 날(그 전에 혼인했다면 혼인신고일). 유주택 이력 시 무주택자가 된 날부터.
      HOMELESS: {
        START_AGE: 30,
        BASE_POINTS: 2,
        POINTS_PER_YEAR: 2,
        MAX_YEARS: 15,
        MAX_POINTS: 32,
        CURRENT_HOMEOWNER_POINTS: 0,
      },
      // 검증 완료(2026-07-27): 부양가족 0명 5점, 1명당 +5점, 6명 이상 35점(본인 제외).
      // 직계존속은 3년 이상 동일 주민등록등본, 자녀는 만 30세 미만 미혼(30세 이상은 1년 이상 동거 시).
      DEPENDENTS: {
        BASE_POINTS: 5,
        POINTS_PER_PERSON: 5,
        MAX_PEOPLE: 6,
        MAX_POINTS: 35,
        ASCENDANT_REGISTRY_YEARS: 3,
        CHILD_MAX_AGE_EXCLUSIVE: 30,
      },
      // 검증 완료(2026-07-27): 통장 가입기간 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 +1점, 15년 이상 17점.
      ACCOUNT: {
        UNDER_SIX_MONTHS_POINTS: 1,
        SIX_TO_TWELVE_MONTHS_POINTS: 2,
        MONTHS_BEFORE_SECOND_BAND: 6,
        MAX_YEARS: 15,
        MAX_POINTS: 17,
      },
      TOTAL_MAX_POINTS: 84,
    },

    YEAR_END_TAX: {
      RATE_DIVISOR: 100,
      WON: 1,
      TEN_THOUSAND_WON: 10000,

      // 검증 완료(2026-07-27): 근로소득공제 —
      // 500만 이하 70% / ~1,500만 350만+초과분 40% / ~4,500만 750만+15% / ~1억 1,200만+5% / 초과 1,475만+2%.
      EARNED_INCOME_DEDUCTION_BRACKETS: [
        { upTo: 5000000, base: 0, excessFrom: 0, rate: 0.7 },
        { upTo: 15000000, base: 3500000, excessFrom: 5000000, rate: 0.4 },
        { upTo: 45000000, base: 7500000, excessFrom: 15000000, rate: 0.15 },
        { upTo: 100000000, base: 12000000, excessFrom: 45000000, rate: 0.05 },
        { upTo: null, base: 14750000, excessFrom: 100000000, rate: 0.02 },
      ],
      EARNED_INCOME_DEDUCTION_CAP: 20000000, // 공제 한도 2,000만원 — 검증 완료

      // 검증 완료(2026-07-27): 기본공제 1인당 150만원(본인 포함).
      // 간이 계산 특성상 미반영: 경로우대·장애인 등 추가공제, 소득요건(연 100만원) 판정.
      PERSONAL_DEDUCTION_PER_PERSON: 1500000,
      TAXPAYER_COUNT: 1,

      // 검증 완료(2026-07-27): 카드 소득공제 — 총급여 25% 초과 사용분부터,
      // 신용카드 15% / 체크카드·현금영수증 30%. 한도 총급여 7천만 이하 300만, 초과 250만.
      // 간이 계산 특성상 미반영: 전통시장·대중교통 40% 추가공제, 도서·공연 30%.
      CARD_THRESHOLD_RATE: 0.25,
      CREDIT_CARD_DEDUCTION_RATE: 0.15,
      DEBIT_CASH_DEDUCTION_RATE: 0.3,
      CARD_CAP_BRACKETS: [
        { salaryUpTo: 70000000, cap: 3000000 },
        { salaryUpTo: null, cap: 2500000 },
      ],

      // 검증 완료(2026-07-27): 종합소득세 기본세율표(누진공제 방식) —
      // 1,400만 6%/0 · 5,000만 15%/126만 · 8,800만 24%/576만 · 1.5억 35%/1,544만
      // · 3억 38%/1,994만 · 5억 40%/2,594만 · 10억 42%/3,594만 · 초과 45%/6,594만.
      INCOME_TAX_BRACKETS: [
        { upTo: 14000000, rate: 0.06, quickDeduction: 0 },
        { upTo: 50000000, rate: 0.15, quickDeduction: 1260000 },
        { upTo: 88000000, rate: 0.24, quickDeduction: 5760000 },
        { upTo: 150000000, rate: 0.35, quickDeduction: 15440000 },
        { upTo: 300000000, rate: 0.38, quickDeduction: 19940000 },
        { upTo: 500000000, rate: 0.4, quickDeduction: 25940000 },
        { upTo: 1000000000, rate: 0.42, quickDeduction: 35940000 },
        { upTo: null, rate: 0.45, quickDeduction: 65940000 },
      ],

      // 검증 완료(2026-07-27): 근로소득 세액공제 — 산출세액 130만 이하 55%, 초과분 71.5만+30%.
      // 상한은 실제로는 총급여 구간 내 점감(슬라이딩)이지만 간이 계산 특성상 구간 고정값 사용.
      // 1.2억 초과 구간(하한 20만)을 추가해 고소득 구간 과대계상을 줄임(2026-07-27).
      EARNED_TAX_CREDIT: {
        FIRST_TAX_THRESHOLD: 1300000,
        FIRST_RATE: 0.55,
        EXCESS_RATE: 0.3,
        EXCESS_BASE: 715000,
        SALARY_CAP_BRACKETS: [
          { salaryUpTo: 33000000, cap: 740000 },
          { salaryUpTo: 70000000, cap: 660000 },
          { salaryUpTo: 120000000, cap: 500000 },
          { salaryUpTo: null, cap: 200000 },
        ],
      },

      // 검증 완료(2026-07-27): 연금계좌 세액공제 — 총급여 5,500만 이하 15%, 초과 12%.
      // 연금저축 한도 600만, IRP 합산 900만. (지방소득세 포함 시 16.5%/13.2%이나
      // 본 계산기는 소득세 기준으로 통일 — 화면 표기와 일치 여부 확인할 것.)
      PENSION: {
        HIGH_RATE_SALARY_LIMIT: 55000000,
        HIGH_RATE: 0.15,
        STANDARD_RATE: 0.12,
        PENSION_SAVINGS_CAP: 6000000,
        COMBINED_CAP: 9000000,
      },

      // 검증 완료(2026-07-27): 의료비 — 총급여 3% 초과분의 15%.
      // 간이 계산 특성상 미반영: 일반 부양가족분 한도 700만원, 난임 30%·미숙아 20% 우대율.
      MEDICAL: { SALARY_THRESHOLD_RATE: 0.03, CREDIT_RATE: 0.15 },
      // 검증 완료(2026-07-27): 교육비 15%. 미반영: 대상별 한도(취학전·초중고 300만, 대학 900만).
      EDUCATION: { CREDIT_RATE: 0.15 },

      // 검증 완료(2026-07-27): 월세 세액공제 — 총급여 8,000만 이하(무주택 세대주),
      // 5,500만 이하 17% / 초과 15%, 지급액 한도 연 1,000만원.
      RENT: {
        ELIGIBLE_SALARY_LIMIT: 80000000,
        HIGH_RATE_SALARY_LIMIT: 55000000,
        HIGH_RATE: 0.17,
        STANDARD_RATE: 0.15,
        PAYMENT_CAP: 10000000,
      },

      // 검증 완료(2026-07-27): 기부금 — 1천만원 이하 15%, 초과분 30%.
      // 간이 계산 특성상 미반영: 유형별(법정/지정) 한도, 이월공제, 고액기부 한시 우대율.
      DONATION: {
        FIRST_THRESHOLD: 10000000,
        FIRST_RATE: 0.15,
        EXCESS_RATE: 0.3,
      },

      // 검증 완료(2026-08-06): 기납부세액 자동 추정은 이제 js/withholding-table-2026.js의
      // 국세청 근로소득 간이세액표 원본 조견표(사용자 제공 hwpx 파일에서 추출)를 사용한다.
      // 아래 비율은 그 모듈이 로드되지 않았을 때만 쓰이는 방어적 폴백값(의도적 단순화 — 유지).
      WITHHELD_ESTIMATE_RATE: 0.07,
    },

    /*
     * ──────────────────────────────────────────────────────────────
     * 사이트 v2 신규 계산기 상수 — 2026-07-27 업데이트 지침 기준
     * 기존 검증 완료 블록과 분리된 추가 전용 섹션입니다.
     * ──────────────────────────────────────────────────────────────
     */
    FINANCIAL_TAX: {
      // 2026-07-27 업데이트 지침 기준: 이자소득 원천징수 15.4% = 소득세 14% + 지방소득세 1.4%.
      INTEREST_INCOME_TAX_RATE: 0.154,
      INTEREST_INCOME_TAX_RATE_NATIONAL: 0.14,
      INTEREST_INCOME_TAX_RATE_LOCAL: 0.014,
      // 2026-07-27 업데이트 지침 기준: 국내 배당소득 간이 원천징수율 15.4%.
      DIVIDEND_WITHHOLDING_TAX_RATE: 0.154,
    },

    SAVINGS: {
      // 계산기 표시 규칙: 월 단위 납입·복리 계산.
      COMPOUNDING_PERIODS_PER_YEAR: 12,
      // 브라우저 과부하 방지용 안전 범위(제도 한도 아님).
      MAX_MONTHS: 1200,
    },

    DSR: {
      // 2026-07-27 업데이트 지침 기준 일반 DSR 한도. 차주·금융권·상품별 실제 규제는 달라질 수 있음.
      STANDARD_LIMIT_RATE: 0.4,
      // 검증 완료(2026-08-04): 스트레스 DSR 가산금리는 지역에 따라 차등 적용된다 —
      // 수도권(METRO) 3.0%p, 비수도권(NON_METRO) 1.5%p. 단계·대출유형별 세부 차등은 간이 계산 특성상 미반영.
      STRESS_RATE_ADDITION: {
        NON_METRO: 1.5,
        METRO: 3.0,
      },
      // 브라우저 과부하 방지용 UI 안전 범위(제도 한도 아님).
      MAX_EXISTING_LOANS: 20,
      MAX_TERM_YEARS: 50,
    },

    LOTTO_TAX: {
      // 2026-07-27 업데이트 지침 기준: 기타소득세·지방소득세 포함, 3억원 이하 22%·초과분 33%.
      THRESHOLD: 300000000,
      LOWER_RATE: 0.22,
      UPPER_RATE: 0.33,
      // 검증 완료(2026-08-04): 복권 당첨금은 200만원까지 비과세(소득세법령 특례). 일반 기타소득 비과세
      // 한도(5만원)와는 다른 별도 규정이므로 혼동 주의.
      TAX_FREE_UP_TO: 2000000,
      // 검증 완료(2026-08-05): 1등 평균 당첨금 프리셋. 회차별 변동되나 최근 1등 기대 당첨금 수준(약 19~20억)과
      // 근사한 값으로 참고용 예시 입력에 사용. 실제 회차 금액은 사용자가 직접 입력.
      AVERAGE_FIRST_PRIZE: 2000000000,
    },

    GOAL_SAVING: {
      // 브라우저 과부하 방지용 최대 계산기간 100년(제도 한도 아님).
      MAX_MONTHS: 1200,
      MIN_MONTHS: 1,
    },

    FX: {
      // 검증 완료(2026-08-05): 국제브랜드(Visa/Mastercard) 해외서비스수수료는 통상 1.0~1.1% 범위.
      // 상한값(1.1%)을 기본값으로 채택(보수적으로 높게 잡아 사용자가 실제 청구액보다 적게 예상하지 않도록).
      DEFAULT_BRAND_FEE_RATE: 0.011,
      // 검증 완료(2026-08-05): 카드사 해외이용수수료는 카드사별 0.18~0.35% 범위(신한카드 0.18% 등). 중간값 채택.
      DEFAULT_ISSUER_FEE_RATE: 0.0025,
      // 검증 완료(2026-08-05): 달러(USD) 현찰 환전 스프레드는 시중은행 표준 1.75% 확인(은행연합회 환전수수료 비교 기준).
      CASH_SPREAD_USD: 0.0175,
      CASH_SPREADS: {
        // USD만 직접 검증 완료(2026-08-05, 1.75%). EUR/EUR·JPY·기타통화는 USD 대비 상대적 추정치이며
        // 통화별 실측 데이터로 추가 검증 권장 — TODO: EUR/JPY/OTHER 개별 검증
        USD: 0.0175,
        EUR: 0.0199,
        JPY: 0.0175,
        OTHER: 0.02,
      },
      // 2026-07-27 업데이트 지침의 DCC 일반 추가비용 경고 범위.
      DCC_WARNING_MIN: 0.03,
      DCC_WARNING_MAX: 0.08,
      CURRENCIES: {
        USD: { label: '미국 달러', symbol: '$', rateUnit: '1달러' },
        EUR: { label: '유로', symbol: '€', rateUnit: '1유로' },
        JPY: { label: '일본 엔', symbol: '¥', rateUnit: '1엔' },
        OTHER: { label: '기타 통화', symbol: '', rateUnit: '외화 1단위' },
      },
    },

    FIRE: {
      // 검증 완료(2026-08-06): "4% 룰"은 1998년 Trinity Study(미국 대학 3곳 공동연구)에서 유래한
      // 안전 인출률(SWR) 통념 기준. 연 지출의 25배(=1/0.04)를 은퇴자산 목표로 삼는 것이 표준.
      // 최근에는 저금리·장수 리스크를 고려해 3.5%를 더 보수적으로 권장하는 논의도 있어 사용자가
      // 직접 조정할 수 있게 기본값만 4%로 두고 입력 가능하게 한다.
      DEFAULT_WITHDRAWAL_RATE: 4,
      MIN_WITHDRAWAL_RATE: 1,
      MAX_WITHDRAWAL_RATE: 10,
      // 목표 은퇴자산 도달 계산의 안전 상한(브라우저 과부하 방지용, 제도 한도 아님). GOAL_SAVING과 동일 기준.
      MAX_MONTHS: 1200,
      MIN_MONTHS: 1,
    },
  };

  global.CALC_CONSTANTS_2026 = Object.freeze(constants);
})(window);
