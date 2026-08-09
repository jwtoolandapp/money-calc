(function (global) {
  'use strict';
  const C=global.CALC_CONSTANTS_2026,U=global.MoneyCalc;if(!C||!U)return;const TAX=C.INHERITANCE_GIFT_TAX,ZERO=C.MATH.ZERO;
  const nonNegative=(v)=>Math.max(ZERO,U.parseNumber(v));
  const taxFrom=(base)=>{const b=TAX.TAX_BRACKETS.find((x)=>x.upTo==null||base<=x.upTo)||TAX.TAX_BRACKETS[TAX.TAX_BRACKETS.length-1];return Math.max(ZERO,base*b.rate-b.quickDeduction);};
  function calculateInheritance(input){
    const estate=nonNegative(input.estate),childCount=Math.floor(nonNegative(input.childCount)),minorAges=Array.isArray(input.minorAges)?input.minorAges:[];
    const childDeduction=childCount*TAX.INHERITANCE.CHILD_DEDUCTION;
    const minorDeduction=minorAges.reduce((sum,age)=>sum+Math.max(ZERO,TAX.INHERITANCE.MINOR_ADULT_AGE-Math.floor(nonNegative(age)))*TAX.INHERITANCE.MINOR_DEDUCTION_PER_YEAR,ZERO);
    const elderlyDeduction=Math.floor(nonNegative(input.elderlyCount))*TAX.INHERITANCE.ELDERLY_DEDUCTION;
    const personalDeduction=childDeduction+minorDeduction+elderlyDeduction;
    const baseAndPersonal=TAX.INHERITANCE.BASIC_DEDUCTION+personalDeduction;
    const selectedGeneralDeduction=Math.max(baseAndPersonal,TAX.INHERITANCE.LUMP_SUM_DEDUCTION);
    const spouseDeduction=input.spouse===true||input.spouse==='1'?TAX.INHERITANCE.SPOUSE_MIN_DEDUCTION:ZERO;
    const totalDeduction=selectedGeneralDeduction+spouseDeduction;
    const taxableBase=Math.max(ZERO,estate-totalDeduction),calculatedTax=taxFrom(taxableBase),reportCredit=calculatedTax*TAX.REPORT_TAX_CREDIT_RATE;
    return{estate,childCount,minorAges,childDeduction,minorDeduction,elderlyDeduction,personalDeduction,selectedGeneralDeduction,spouseDeduction,totalDeduction,taxableBase,calculatedTax,reportCredit,payableTax:calculatedTax-reportCredit};
  }
  function calculateGift(input){
    const gift=nonNegative(input.gift),relationship=input.relationship||'adultChild';const map={spouse:TAX.GIFT.SPOUSE,adultChild:TAX.GIFT.ADULT_CHILD,minorChild:TAX.GIFT.MINOR_CHILD,parentFromChild:TAX.GIFT.PARENT_FROM_CHILD,other:TAX.GIFT.OTHER_RELATIVE};
    const relationDeduction=map[relationship]||TAX.GIFT.OTHER_RELATIVE,extra=input.extra===true||input.extra==='1'?TAX.GIFT.MARRIAGE_CHILDBIRTH_EXTRA:ZERO,totalDeduction=relationDeduction+extra;
    const taxableBase=Math.max(ZERO,gift-totalDeduction),calculatedTax=taxFrom(taxableBase),reportCredit=calculatedTax*TAX.REPORT_TAX_CREDIT_RATE;
    return{gift,relationship,relationDeduction,extra,totalDeduction,taxableBase,calculatedTax,reportCredit,payableTax:calculatedTax-reportCredit,hasPriorGift:input.hasPriorGift===true||input.hasPriorGift==='1'};
  }
  global.MoneyCalcCalculators=global.MoneyCalcCalculators||{};global.MoneyCalcCalculators.inheritanceGiftTax=Object.freeze({calculateInheritance,calculateGift});
  if(typeof document==='undefined')return;
  function init(){
    const form=document.getElementById('inheritance-gift-form');if(!form)return;let mode='inheritance';const buttons=Array.from(document.querySelectorAll('[data-tax-mode]')),panels=Array.from(form.querySelectorAll('[data-tax-panel]')),agesMount=document.getElementById('minor-age-fields');
    const initialParams=U.queryParams();if(initialParams.get('mode')==='gift')mode='gift';
    function syncAgeFields(count,preserve){const old=preserve?Array.from(agesMount.querySelectorAll('input')).map((x)=>x.value):[];agesMount.innerHTML='';for(let i=0;i<count;i+=1){const wrap=document.createElement('div');wrap.className='field';wrap.innerHTML=`<label for="minor-age-${i}">미성년 자녀 ${i+1} 만 나이</label><div class="input-wrap"><input id="minor-age-${i}" name="minorAge${i}" class="control" type="number" min="0" max="18" step="1" value="${old[i]||initialParams.get(`minorAge${i}`)||0}"><span class="unit">세</span></div>`;agesMount.appendChild(wrap);}}
    U.restoreForm(form);syncAgeFields(Math.floor(U.parseNumber(form.elements.minorCount.value)),false);U.setupNumericInputs(form);
    const value=(name)=>form.elements[name]?U.parseNumber(form.elements[name].value):ZERO;
    const rows=(items)=>{document.getElementById('inheritance-result-details').innerHTML=items.map(([a,b])=>`<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');};
    function render(){buttons.forEach((b)=>b.setAttribute('aria-pressed',b.dataset.taxMode===mode?'true':'false'));panels.forEach((p)=>U.setHidden(p,p.dataset.taxPanel!==mode));let result;
      if(mode==='inheritance'){const minorAges=Array.from(agesMount.querySelectorAll('input')).map((x)=>U.parseNumber(x.value));result=calculateInheritance({estate:value('estate'),spouse:form.elements.spouse.checked,childCount:value('childCount'),minorAges,elderlyCount:value('elderlyCount')});document.getElementById('inheritance-result-label').textContent='예상 상속세';document.getElementById('inheritance-result-value').textContent=U.formatWon(result.payableTax);document.getElementById('inheritance-result-summary').textContent=`일괄공제와 기초·인적공제 중 ${result.selectedGeneralDeduction===TAX.INHERITANCE.LUMP_SUM_DEDUCTION?'일괄공제':'기초·인적공제'}가 적용됐습니다.`;rows([['자녀공제',U.formatWon(result.childDeduction)],['미성년자공제',U.formatWon(result.minorDeduction)],['배우자공제',U.formatWon(result.spouseDeduction)],['과세표준',U.formatWon(result.taxableBase)],['신고세액공제',U.formatWon(result.reportCredit)]]);
      }else{result=calculateGift({gift:value('gift'),relationship:form.elements.relationship.value,extra:form.elements.extra.checked,hasPriorGift:form.elements.hasPriorGift.checked});document.getElementById('inheritance-result-label').textContent='예상 증여세';document.getElementById('inheritance-result-value').textContent=U.formatWon(result.payableTax);document.getElementById('inheritance-result-summary').textContent=result.hasPriorGift?'최근 10년 내 동일인 증여분 합산은 계산에 미반영했습니다.':'관계별 공제와 신고세액공제 3%를 적용했습니다.';rows([['관계별 공제',U.formatWon(result.relationDeduction)],['혼인·출산 추가공제',U.formatWon(result.extra)],['과세표준',U.formatWon(result.taxableBase)],['신고세액공제',U.formatWon(result.reportCredit)]]);}
      const q=U.formToParams(form);q.set('mode',mode);U.setQuery(q);return result;}
    form.elements.minorCount.addEventListener('input',()=>{syncAgeFields(Math.floor(value('minorCount')),true);render();});buttons.forEach((b)=>b.addEventListener('click',()=>{mode=b.dataset.taxMode;render();}));form.addEventListener('input',render);form.addEventListener('change',render);U.bindCopyLink(document.getElementById('copy-inheritance-link'),()=>global.location.href);render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
