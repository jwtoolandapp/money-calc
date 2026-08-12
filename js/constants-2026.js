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

      // money-calc 3차 업데이트(2026-08-09) — 기존 2026-07-27 검증 완료 블록은 그대로 두고 추가만 함.
      TRADITIONAL_MARKET_RATE: 0.4,
      PUBLIC_TRANSPORT_RATE: 0.4,
      CULTURE_RATE: 0.3,
      CULTURE_ELIGIBLE_SALARY_LIMIT: 70000000,
      ADDITIONAL_CARD_CAP_BRACKETS: [
        { salaryUpTo: 70000000, cap: 3000000 },
        { salaryUpTo: null, cap: 2000000 },
      ],
      MEDICAL_DEPENDENT_CAP: 7000000,
      MEDICAL_FERTILITY_RATE: 0.3,
      MEDICAL_PREMATURE_RATE: 0.2,
      EDUCATION_CAP_PRESCHOOL_TO_HIGH: 3000000,
      EDUCATION_CAP_COLLEGE: 9000000,
      ADDITIONAL_DEDUCTIONS: {
        ELDERLY_70_UP: 1000000,
        DISABLED: 2000000,
        SINGLE_WOMAN_HEAD: 500000,
        SINGLE_PARENT: 1000000,
      },
      // 검증 완료(2026-08-09): 기부금 이월공제 가능기간 10년. 유형별 한도는 TODO: 원문 재검증.
      DONATION_CARRYFORWARD_YEARS: 10,
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

    FOREIGN_STOCK_TAX: {
      // 검증 완료(2026-08-11): 해외주식 양도소득 기본공제 연 250만원,
      // 양도소득세 20% + 지방소득세(양도소득세의 10%) 2% = 합계 22%.
      // 국세청 양도소득세 안내와 증권사 세금안내를 교차 확인했다.
      //
      // 손익 통산: 같은 과세기간에 실현한 해외주식 양도차익과 차손을 합산한
      // 순이익이 과세 대상이다. 종목별로 따로 계산하지 않는다.
      // 기본공제는 순이익에서 빼는 것이지 세액에서 빼는 것이 아니다.
      //
      // 미반영(간이 계산 특성): 국내주식 대주주 양도세, 환차손익 반영 방식,
      // 이월결손금, 증권거래세는 다루지 않는다. 신고 기한은 다음 해 5월이다.
      BASIC_DEDUCTION: 2500000,
      TAX_RATE: 0.20,
      LOCAL_TAX_RATE_OF_TAX: 0.1,
      FILING_MONTH: 5,
    },

    CAR_TAX: {
      // 검증 완료(2026-08-11): 지방세법 제127조(과세표준과 세율).
      // 비영업용 승용: 1,000cc 이하 80원/cc, 1,600cc 이하 140원/cc, 초과 200원/cc.
      // 영업용 승용: 1,000cc 이하 18원, 1,600cc 이하 18원, 2,000cc 이하 19원,
      //             2,500cc 이하 19원, 초과 24원.
      // 구간 단가를 배기량 전체에 곱한다. 소득세처럼 구간별로 쪼개는 누진이 아니다.
      //
      // 차령 경감(제1항 제2호): 차령 3년 이상인 비영업용 승용자동차는
      //   기분세액 = A/2 − (A/2 × 5/100)(n − 2),  2 ≤ n ≤ 12
      // 12년 초과는 12년으로 본다. 연세액은 두 기분의 합이다.
      //
      // 지방교육세는 자동차세의 30%가 별도로 부과된다(지방세법 제151조).
      //
      // 미반영(간이 계산 특성): 승합·화물·특수·3륜 이하 소형자동차는 배기량이
      // 아니라 종류·적재량별 정액이라 별도 표가 필요해 이 계산기에서는 다루지
      // 않는다. 연납 할인과 지자체별 감면도 제외한다.
      PRIVATE_BRACKETS: [
        { upTo: 1000, perCc: 80 },
        { upTo: 1600, perCc: 140 },
        { upTo: null, perCc: 200 },
      ],
      COMMERCIAL_BRACKETS: [
        { upTo: 1000, perCc: 18 },
        { upTo: 1600, perCc: 18 },
        { upTo: 2000, perCc: 19 },
        { upTo: 2500, perCc: 19 },
        { upTo: null, perCc: 24 },
      ],
      AGE_DISCOUNT_PER_YEAR: 0.05,
      AGE_CAP_YEARS: 12,
      EDUCATION_TAX_RATE: 0.3,
    },

    CAR_ACQUISITION_TAX: {
      // 검증 완료(2026-08-11): 지방세법 제12조제1항제2호 및 시행령 제23조의 자동차 취득세
      // 표준세율. 국가법령정보센터·찾기쉬운 생활법령정보를 교차 확인했다.
      //   비영업용 승용 7% / 경자동차(승용) 4% / 비영업용 승용 외 5% /
      //   경자동차(승용 외) 4% / 영업용 4% / 이륜자동차(125cc 이하) 2%
      // 과세표준은 취득 당시 가액이며, 신차는 부가가치세를 제외한 공급가액이 기준이다.
      //
      // 미반영(간이 계산 특성): 등록 시 지자체별로 매입하는 공채(도시철도채권·지역개발채권)는
      // 지역과 배기량에 따라 매입률이 달라 단일 계산이 불가능하다. 화면에 별도 안내만 한다.
      // 장애인·국가유공자 감면, 다자녀 감면, 하이브리드·전기차 감면도 요건이 복잡해 제외한다.
      VEHICLE_TYPES: [
        { id: 'passenger', label: '승용차 (비영업용)', rate: 0.07 },
        { id: 'passenger-light', label: '경차 · 승용 (배기량 1,000cc 이하)', rate: 0.04 },
        { id: 'non-passenger', label: '승합·화물 (비영업용)', rate: 0.05 },
        { id: 'non-passenger-light', label: '경차 · 승합·화물', rate: 0.04 },
        { id: 'commercial', label: '영업용 (택시·화물운송 등)', rate: 0.04 },
        { id: 'motorcycle', label: '이륜자동차 (125cc 이하)', rate: 0.02 },
      ],
      VAT_RATE: 0.1,
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
        EUR: 0.015, // 2026-08-11 우리은행·KDB산업은행 실측 0.96~1.5% 확인 — TODO: 은행연합회 1차 출처 원문 재검증, 은행별 편차가 큰 참고값
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

    BROKERAGE_FEE: {
      // 검증 완료(2026-08-06): 2021년 10월 국토교통부 공인중개사법 시행규칙 개정 이후 전국 17개
      // 시·도가 동일한 표준 요율표를 조례로 채택(서울시 주택 중개보수 등에 관한 조례 등으로 확인,
      // 창원·구리·수원 등 타 지자체 고시와도 대조 완료). 상한요율이며 실제 보수는 이 범위 내에서
      // 중개의뢰인과 개업공인중개사가 협의해 결정한다.
      HOUSE_SALE_BRACKETS: [
        { upTo: 50000000, rate: 0.006, cap: 250000 },
        { upTo: 200000000, rate: 0.005, cap: 800000 },
        { upTo: 900000000, rate: 0.004, cap: null },
        { upTo: 1200000000, rate: 0.005, cap: null },
        { upTo: 1500000000, rate: 0.006, cap: null },
        { upTo: Infinity, rate: 0.007, cap: null },
      ],
      HOUSE_LEASE_BRACKETS: [
        { upTo: 50000000, rate: 0.005, cap: 200000 },
        { upTo: 100000000, rate: 0.004, cap: 300000 },
        { upTo: 600000000, rate: 0.003, cap: null },
        { upTo: 1200000000, rate: 0.004, cap: null },
        { upTo: 1500000000, rate: 0.005, cap: null },
        { upTo: Infinity, rate: 0.006, cap: null },
      ],
      // 오피스텔 전용면적 85㎡ 이하 + 일정 요건(전용입식부엌·전용수세식화장실·목욕시설 등) 충족 시
      // 협의 없이 고정 요율 적용(한도액 없음).
      OFFICETEL_SMALL_SALE_RATE: 0.005,
      OFFICETEL_SMALL_LEASE_RATE: 0.004,
      // 오피스텔(85㎡ 초과) · 상가 · 토지 등 "그 밖의 중개대상물"은 매매·임대차 구분 없이
      // 거래금액의 0.9% 이내에서 협의(상한요율, 한도액 없음).
      OTHER_PROPERTY_RATE: 0.009,
      // 월세 계약의 중개보수 산정용 환산보증금: 보증금 + (월세 × 100). 단, 그 합산액이
      // 5천만원 미만이면 보증금 + (월세 × 70)을 거래금액으로 본다(공인중개사법 시행규칙 제20조).
      WOLSE_MULTIPLIER: 100,
      WOLSE_MULTIPLIER_LOW: 70,
      WOLSE_LOW_THRESHOLD: 50000000,
      VAT_RATE: 0.1,
    },

    ACQUISITION_TAX: {
      // 검증 완료(2026-08-06): 지방세법 제11조(유상승계취득) 기준. 두 개 이상의 독립 출처(규제지도
      // gyujemap.com 세율표, 부동산 취득세 계산기 jiptax.com)를 교차 대조해 취득세·지방교육세·
      // 농어촌특별세 올인세율(예: 1주택 6억 이하 1.3%, 9억 초과 3.5%, 다주택 중과 8%→9.0%,
      // 12%→13.4%)이 정확히 일치함을 확인. 유상취득(매매)만 반영하며 상속·증여(무상취득)·
      // 신축(원시취득)·생애최초 특례감면은 세율 체계가 달라 이 계산기에서는 다루지 않는다
      // (간이 계산 특성상 미반영 — 정확한 감면 여부는 관할 시·군·구청·위택스에서 확인 필요).
      HOUSE_STANDARD: {
        LOW_THRESHOLD: 600000000,
        LOW_RATE: 0.01,
        HIGH_THRESHOLD: 900000000,
        HIGH_RATE: 0.03,
        // 6억 초과~9억 이하 구간 공식: (취득가액 ÷ 3억원 × 2 − 3)%. 소수점 둘째 자리(%)에서 반올림.
        MID_DIVISOR: 300000000,
      },
      // 다주택·법인 중과세율. 조정대상지역 여부에 따라 2주택·3주택 세율이 달라진다.
      HEAVY_RATE_8: 0.08,
      HEAVY_RATE_12: 0.12,
      NON_HOUSE_RATE: 0.04,
      // 지방교육세: 표준세율(1~3%) 구간은 취득세율의 1/10, 중과세율(8%·12%) 구간은 세율과 무관하게
      // 0.4% 고정. 주택 외 부동산(4%)도 취득세율의 1/10인 0.4%.
      EDU_TAX_STANDARD_RATIO: 0.1,
      EDU_TAX_HEAVY_FIXED: 0.004,
      // 농어촌특별세: 전용면적 85㎡ 이하는 비과세. 85㎡ 초과 시 표준세율 0.2%, 8% 중과 0.6%,
      // 12% 중과 1.0%. 주택 외 부동산은 면적과 무관하게 0.2%.
      AGRI_TAX_AREA_THRESHOLD: 85,
      AGRI_TAX_STANDARD: 0.002,
      AGRI_TAX_HEAVY_8: 0.006,
      AGRI_TAX_HEAVY_12: 0.01,
      AGRI_TAX_NON_HOUSE: 0.002,

      // money-calc 3차 업데이트(2026-08-09) — 생애최초 감면 및 무상취득 세율.
      FIRST_TIME_BUYER_EXEMPTION: {
        PRICE_LIMIT: 1200000000,
        EXEMPTION_CAP: 2000000,
        REQUIRES_RESIDENCE: true,
      },
      INHERITANCE_RATE: {
        STANDARD: 0.028, // TODO: 상속 표준세율 원문 재검증
        SINGLE_HOUSE_SPECIAL: 0.008,
      },
      GIFT_RATE: {
        STANDARD: 0.035,
        HEAVY_REGULATED: 0.12, // TODO: 2025-10-15 대책 이후 중과 적용요건 원문 재검증
      },
    },

    /* money-calc 3차 신규 계산기 상수 — 업데이트3차_빌드지침.md 기준 */
    PROPERTY_HOLDING_TAX: {
      // 2026-08-09 검증 기준: 2026년 주택 재산세·종부세 시행 기준.
      SINGLE_HOUSE_SPECIAL_PRICE_LIMIT: 900000000,
      FAIR_MARKET_VALUE_RATIO: { SPECIAL_LOW: 0.43, SPECIAL_MID: 0.44, SPECIAL_HIGH: 0.45, STANDARD: 0.6 },
      HOUSE_TAX_BRACKETS_STANDARD: [
        { upTo: 60000000, rate: 0.001, quickDeduction: 0 },
        { upTo: 150000000, rate: 0.0015, quickDeduction: 30000 },
        { upTo: 300000000, rate: 0.0025, quickDeduction: 180000 },
        { upTo: null, rate: 0.004, quickDeduction: 630000 },
      ],
      HOUSE_TAX_BRACKETS_SPECIAL: [
        { upTo: 60000000, rate: 0.0005, quickDeduction: 0 },
        { upTo: 150000000, rate: 0.001, quickDeduction: 30000 },
        { upTo: 300000000, rate: 0.002, quickDeduction: 180000 },
        { upTo: null, rate: 0.0035, quickDeduction: 630000 },
      ], // 검증 완료(2026-08-11, 지방세법 제111조의2① 원문 직접 확인 — 전 구간 일치)
         // 한시 조항: 법률 제17769호 부칙 제2조에 따라 2026년 12월 28일까지 성립한 납세의무에 한정하여 유효.
         // 2027년 연장 여부는 미확정이므로 다음 연도 상수 갱신 시 반드시 재확인할 것.
      URBAN_AREA_RATE: 0.0014,
      LOCAL_EDU_TAX_RATE: 0.2,
      COMPREHENSIVE_TAX_DEDUCTION: { SINGLE_HOUSE: 1200000000, STANDARD: 900000000 },
      COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO: 0.6,
      COMPREHENSIVE_TAX_BRACKETS_UNDER_2: [
        { upTo: 300000000, rate: 0.005, quickDeduction: 0 },
        { upTo: 600000000, rate: 0.007, quickDeduction: 600000 },
        { upTo: 1200000000, rate: 0.01, quickDeduction: 2400000 },
        { upTo: 2500000000, rate: 0.013, quickDeduction: 6000000 },
        { upTo: 5000000000, rate: 0.015, quickDeduction: 11000000 },
        { upTo: 9400000000, rate: 0.02, quickDeduction: 36000000 },
        { upTo: null, rate: 0.027, quickDeduction: 101800000 },
      ], // TODO: 누진공제액은 세율표 역산값 — 시행령 원문 대조 필요
      COMPREHENSIVE_TAX_BRACKETS_OVER_3: [
        { upTo: 300000000, rate: 0.005, quickDeduction: 0 },
        { upTo: 600000000, rate: 0.007, quickDeduction: 600000 },
        { upTo: 1200000000, rate: 0.01, quickDeduction: 2400000 },
        { upTo: 2500000000, rate: 0.02, quickDeduction: 14400000 },
        { upTo: 5000000000, rate: 0.03, quickDeduction: 39400000 },
        { upTo: 9400000000, rate: 0.04, quickDeduction: 89400000 },
        { upTo: null, rate: 0.05, quickDeduction: 183400000 },
      ], // 검증 완료(2026-08-11, 종합부동산세법 제9조① 원문 역산 대조 — 기존 4개 구간의 60만원 오차 수정)
      // 종합부동산세법 시행령 제4조의3① 재산세액공제 정밀 산식:
      // 공제액 = 주택분 재산세 부과세액 합계 ×
      // [(종부세 과세표준 × 지방세법 시행령 제109조제1항제2호 공정시장가액비율) ×
      //  지방세법 제111조제1항제3호 표준세율] ÷ 주택 합산 재산세 표준세율 상당액.
      // 종부세 탭은 개별 주택이 아닌 공시가격 합계만 입력받아 분모의 가상 재산세 상당액을 재현할 수 없으므로,
      // 현재는 재산세 탭에서 계산한 재산세 본세를 차감하는 간이화를 유지한다.
      // 검증 완료(2026-08-11, 종합부동산세법 제9조⑤~⑨ 원문 직접 확인).
      COMPREHENSIVE_TAX_CREDIT: {
        ELDERLY_BRACKETS: [
          { minAge: 60, maxAge: 65, rate: 0.2 },
          { minAge: 65, maxAge: 70, rate: 0.3 },
          { minAge: 70, maxAge: null, rate: 0.4 },
        ],
        LONG_TERM_BRACKETS: [
          { minYears: 5, maxYears: 10, rate: 0.2 },
          { minYears: 10, maxYears: 15, rate: 0.4 },
          { minYears: 15, maxYears: null, rate: 0.5 },
        ],
        CREDIT_CAP: 0.8,
      },
    },
    INHERITANCE_GIFT_TAX: {
      // 2026-08-09 검증 기준: 국세청 상속·증여세 세율 및 공제 원문 직접 확인.
      TAX_BRACKETS: [
        { upTo: 100000000, rate: 0.1, quickDeduction: 0 },
        { upTo: 500000000, rate: 0.2, quickDeduction: 10000000 },
        { upTo: 1000000000, rate: 0.3, quickDeduction: 60000000 },
        { upTo: 3000000000, rate: 0.4, quickDeduction: 160000000 },
        { upTo: null, rate: 0.5, quickDeduction: 460000000 },
      ],
      REPORT_TAX_CREDIT_RATE: 0.03,
      INHERITANCE: {
        MINOR_ADULT_AGE: 19,
        BASIC_DEDUCTION: 200000000, LUMP_SUM_DEDUCTION: 500000000, SPOUSE_MIN_DEDUCTION: 500000000,
        CHILD_DEDUCTION: 50000000, MINOR_DEDUCTION_PER_YEAR: 10000000, ELDERLY_DEDUCTION: 50000000,
        FINANCIAL_ASSET_DEDUCTION_BRACKETS: [
          { upTo: 20000000, rate: 1, cap: null }, { upTo: 100000000, rate: 0, cap: 20000000 },
          { upTo: 1000000000, rate: 0.2, cap: null }, { upTo: null, rate: 0, cap: 200000000 },
        ],
      },
      GIFT: { SPOUSE: 600000000, ADULT_CHILD: 50000000, MINOR_CHILD: 20000000, PARENT_FROM_CHILD: 50000000, OTHER_RELATIVE: 10000000, MARRIAGE_CHILDBIRTH_EXTRA: 100000000 },
    },
    NATIONAL_PENSION: {
      // 2026-08-09 검증 기준: 국민연금공단 2026년 A값·보험료율·수급연령 원문 확인.
      A_VALUE_2026: 3193511,
      PROPORTIONAL_CONSTANT: 1.29, // 참고용 상수. 이번 선형 근사 계산에는 사용하지 않음.
      INCOME_REPLACEMENT_RATE: 0.43,
      MAX_CREDITED_YEARS: 40, // 2026-08-09 결정: 40년 가입 소득대체율 벤치마크용 선형 근사 상한.
      CONTRIBUTION_RATE: 0.095,
      INCOME_CEILING: 6590000,
      INCOME_FLOOR: 410000,
      EARLY_PENSION: { MAX_YEARS: 5, REDUCTION_PER_YEAR: 0.06 },
      DEFERRED_PENSION: { MAX_YEARS: 5, INCREASE_PER_YEAR: 0.072 },
      PENSION_AGE_BY_BIRTH_YEAR: [
        { birthYearUpTo: 1956, normalAge: 61, earlyAge: 56 }, { birthYearUpTo: 1960, normalAge: 62, earlyAge: 57 },
        { birthYearUpTo: 1964, normalAge: 63, earlyAge: 58 }, { birthYearUpTo: 1968, normalAge: 64, earlyAge: 59 },
        { birthYearUpTo: null, normalAge: 65, earlyAge: 60 },
      ],
    },
    FOUR_MAJOR_INSURANCE: {
      // 2026-08-09 검증 기준: 2026년 근로자 부담분 요율.
      NATIONAL_PENSION_RATE: 0.0475, NATIONAL_PENSION_CEILING: 6590000, NATIONAL_PENSION_FLOOR: 410000,
      HEALTH_INSURANCE_RATE: 0.03595, LONG_TERM_CARE_RATE_OF_HEALTH: 0.1314, EMPLOYMENT_INSURANCE_RATE: 0.009,
      LOCAL_INCOME_TAX_RATE: 0.1,
      MEAL_ALLOWANCE_TAX_FREE: 200000, // TODO: 비과세 식대 한도 시행령 원문 재검증
      // 2026.3.1 이후 원천징수분 적용. 2026-08-11 2차 출처 4곳 교차검증 일치.
      // TODO: 국세청 원문 고시 직접 확인은 다음 검증 라운드로 이월.
      WITHHOLDING_CHILD_ADDON: { ONE: 20830, TWO: 45830, PER_ADDITIONAL_AFTER_TWO: 33330 },
    },
    SEVERANCE_PAY: {
      // 2026-08-09 검증 기준: 국세청 퇴직소득세 계산방법·계산사례 원문 확인.
      MIN_SERVICE_DAYS_FOR_ELIGIBILITY: 365, AVERAGE_WAGE_DAYS: 30, BONUS_MONTHLY_RATIO: 1 / 12 * 3,
      SERVICE_YEAR_DEDUCTION_BRACKETS: [
        { upToYears: 5, perYear: 1000000, base: 0 }, { upToYears: 10, perYear: 2000000, base: 5000000 },
        { upToYears: 20, perYear: 2500000, base: 15000000 }, { upToYears: null, perYear: 3000000, base: 40000000 },
      ],
      CONVERTED_SALARY_DEDUCTION_BRACKETS: [
        { upTo: 8000000, rate: 1, base: 0 }, { upTo: 70000000, rate: 0.6, base: 8000000 },
        { upTo: 100000000, rate: 0.55, base: 45200000 }, { upTo: 300000000, rate: 0.45, base: 61700000 },
        { upTo: null, rate: 0.35, base: 151700000 },
      ],
    },
    // 2026-08-09 검증 기준: 고용노동부 주휴수당 산식 및 2026년 최저임금.
    WEEKLY_HOLIDAY_PAY: { ELIGIBILITY_MIN_WEEKLY_HOURS: 15, STANDARD_WEEKLY_HOURS: 40, STANDARD_DAILY_HOURS: 8 },
    MINIMUM_WAGE: { YEAR: 2026, HOURLY: 10320, MONTHLY_209H: 2156880 },

    /*
     * 근로기준법 제60조(연차 유급휴가).
     *
     * 1년간 80% 이상 출근하면 15일. 3년 이상 계속 근로한 경우 최초 1년을
     * 초과하는 매 2년마다 1일을 더하되 총 25일을 넘지 못한다. 1년 미만
     * 근로자는 1개월 개근할 때마다 1일이 생기고 최대 11일이다.
     *
     * 209는 주 40시간 근로자의 월 통상임금 산정 기준시간이다(주휴시간 포함).
     */
    ANNUAL_LEAVE: {
      BASE_DAYS: 15,
      // 가산은 3년차부터, 2년마다 1일.
      EXTRA_START_YEAR: 3,
      EXTRA_EVERY_YEARS: 2,
      MAX_DAYS: 25,
      // 1년 미만 근로자: 1개월 개근당 1일, 최대 11일.
      UNDER_ONE_YEAR_MAX_DAYS: 11,
      MONTHLY_STANDARD_HOURS: 209,
      STANDARD_DAILY_HOURS: 8,
    },

    /*
     * 근로기준법 제56조(연장·야간 및 휴일 근로).
     *
     * 연장근로와 야간근로(오후 10시~다음 날 오전 6시)는 통상임금의 50% 이상을
     * 가산한다. 휴일근로는 8시간 이내 50%, 8시간을 초과한 시간은 100%를
     * 가산한다. 가산 사유가 겹치면 각각 더해진다 — 야간에 한 연장근로는
     * 연장 50% + 야간 50% 로 통상임금의 2배가 된다.
     *
     * 상시 5명 미만 사업장에는 이 가산 규정이 적용되지 않는다(근로기준법
     * 제11조 및 시행령 제7조 별표1). 가산 없이 통상임금만 지급하면 된다.
     */
    OVERTIME_PAY: {
      MONTHLY_STANDARD_HOURS: 209,
      OVERTIME_PREMIUM: 0.5,
      NIGHT_PREMIUM: 0.5,
      HOLIDAY_PREMIUM_WITHIN_8H: 0.5,
      HOLIDAY_PREMIUM_OVER_8H: 1,
      HOLIDAY_PREMIUM_THRESHOLD_HOURS: 8,
      SMALL_WORKPLACE_HEADCOUNT: 5,
    },

    /* money-calc 4차 1단계 신규 계산기 상수 — 업데이트4차_1단계_빌드지침.md 기준 */
    UNEMPLOYMENT_BENEFIT: {
      // 검증 완료(2026-08-11): 고용보험법·시행령 및 2026년 최저임금 기준.
      BENEFIT_RATE: 0.6,
      BASE_WAGE_CAP: 113500,
      MINIMUM_WAGE_HOURLY_2026: 10320, // TODO: 연도 갱신 시 반드시 재확인
      STANDARD_DAILY_HOURS: 8,
      MIN_BENEFIT_RATE_OF_MIN_WAGE: 0.8,
      WAITING_PERIOD_DAYS: 7,
      ELIGIBLE_DAYS_TABLE: [
        { minInsuredYears: 0, maxInsuredYears: 1, under50: 120, over50OrDisabled: 120 },
        { minInsuredYears: 1, maxInsuredYears: 3, under50: 150, over50OrDisabled: 180 },
        { minInsuredYears: 3, maxInsuredYears: 5, under50: 180, over50OrDisabled: 210 },
        { minInsuredYears: 5, maxInsuredYears: 10, under50: 210, over50OrDisabled: 240 },
        { minInsuredYears: 10, maxInsuredYears: null, under50: 240, over50OrDisabled: 270 },
      ],
    },
    PARENTAL_LEAVE_PAY: {
      // 검증 완료(2026-08-11): 고용보험법 시행령의 2026년 육아휴직급여 지급 구간 기준.
      STANDARD: [
        { fromMonth: 1, toMonth: 3, rate: 1, cap: 2500000 },
        { fromMonth: 4, toMonth: 6, rate: 1, cap: 2000000 },
        { fromMonth: 7, toMonth: null, rate: 0.8, cap: 1600000 },
      ],
      SIX_PLUS_SIX: [
        { month: 1, cap: 2500000 }, { month: 2, cap: 2500000 }, { month: 3, cap: 3000000 },
        { month: 4, cap: 3500000 }, { month: 5, cap: 4000000 }, { month: 6, cap: 4500000 },
      ],
      SIX_PLUS_SIX_AFTER_MONTH: 6,
      POST_SIX_PLUS_SIX_RATE: 0.8,
      POST_SIX_PLUS_SIX_CAP: 1600000,
      FLOOR: 700000,
    },
    YOUTH_LEAP_ACCOUNT: {
      // 검증 완료(2026-08-11): 서민금융진흥원 청년도약계좌 상품안내의 2025.1월 납입분 이후 지급 구조.
      MATURITY_MONTHS: 60,
      MAX_MONTHLY_DEPOSIT: 700000,
      NEW_ENROLLMENT_CLOSED: true,
      NEW_ENROLLMENT_CLOSED_DATE: '2025-12-31',
      MATCHING_BRACKETS: [
        { incomeUpTo: 24000000, matchCapFirst: 400000, rateFirst: 0.06, rateRemaining: 0.03, maxMonthly: 33000 },
        { incomeUpTo: 36000000, matchCapFirst: 500000, rateFirst: 0.046, rateRemaining: 0.03, maxMonthly: 29000 },
        { incomeUpTo: 48000000, matchCapFirst: 600000, rateFirst: 0.037, rateRemaining: 0.03, maxMonthly: 25200 },
        { incomeUpTo: 60000000, matchCapFirst: 700000, rateFirst: 0.03, rateRemaining: 0, maxMonthly: 21000 },
        { incomeUpTo: 75000000, matchCapFirst: 0, rateFirst: 0, rateRemaining: 0, maxMonthly: 0 },
      ],
    },
    YOUTH_TOMORROW_SAVINGS: {
      // 검증 완료(2026-08-11): 청년내일저축계좌 3년 만기 및 대상별 월 정액 지원 구조.
      // TODO: 월 10만원 미만 저축 시 정부지원금 비례 삭감 여부 확인 필요.
      MATURITY_MONTHS: 36,
      GENERAL: { monthlyGovSupport: 100000 },
      NEAR_POVERTY_OR_BELOW: { monthlyGovSupport: 300000 },
      MIN_MONTHLY_DEPOSIT: 100000,
      MAX_MONTHLY_DEPOSIT: 500000,
    },
    LOCAL_HEALTH_INSURANCE: {
      // 검증 완료(2026-08-11): 국민건강보험법·시행령의 2026년 지역가입자 소득보험료율 및 상·하한.
      INCOME_RATE: 0.0719,
      PROPERTY_SCORE_UNIT_AMOUNT: 211.5,
      MAX_MONTHLY_PREMIUM: 4591740,
      MIN_MONTHLY_PREMIUM: 20160,
      // TODO: 재산보험료부과점수 등급표(시행령 별표 4)는 후속 라운드에서 구현.
    },
  };
  global.CALC_CONSTANTS_2026 = Object.freeze(constants);
})(window);
