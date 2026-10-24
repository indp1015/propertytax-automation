/**
 * Property Tax Calculator 2026
 */

(function() {
  'use strict';

  let countyData = null;
  let stateMap = {};
  let nationalAvgRate = 1.10;  // 폴백
  let stateAvgRates = {};      // {state: avg_rate}

  // 카운티 데이터 로드
  fetch('/static/counties_tax_rates.json')
    .then(r => r.json())
    .then(data => {
      countyData = data.counties;
      stateAvgRates = data.state_avg_rates || {};
      nationalAvgRate = data.national_avg_rate || 1.10;
            // 🆕 insurance base URL 저장 (역방향 링크용)
      window.__insuranceBaseUrl = data.insurance_base_url || 'https://insurance.dataindp.com';
      buildStateMap();
      populateStateSelect();
      // 국민 평균 표시
      const el = document.getElementById('nationalAvg');
      if (el) el.textContent = nationalAvgRate.toFixed(2) + '%';
      // 🆕 insurance 역방향 링크 초기 상태 (county 미선택 시 숨김)
      updateInsuranceLink();

      // 🆕 URL 파라미터 적용 후 최초 계산 (fetch 완료 후 반드시 재계산)
      applyUrlParams();
      calculate();
    })
    .catch(err => console.error('데이터 로드 실패:', err));

  function buildStateMap() {
    for (const [fips, info] of Object.entries(countyData)) {
      // info: [name, state, median_tax, effective_rate]
      const state = info[1];
      if (!stateMap[state]) stateMap[state] = [];
      stateMap[state].push([fips, ...info]);
    }
    for (const state in stateMap) {
      stateMap[state].sort((a, b) => a[1].localeCompare(b[1]));
    }
  }

  function populateStateSelect() {
    const sel = document.getElementById('stateSelect');
    Object.keys(stateMap).sort().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  // 이벤트 바인딩
  ['homeValue', 'assessmentRatio', 'exemption', 'stateSelect', 'countySelect']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handleInput);
        el.addEventListener('change', handleInput);
      }
    });

  function handleInput(e) {
    if (e && e.target.id === 'stateSelect') {
      populateCountySelect(e.target.value);
    }
    calculate();
  }

  function populateCountySelect(state) {
    const sel = document.getElementById('countySelect');
    sel.innerHTML = '<option value="">-- Select County --</option>';
    if (!state || !stateMap[state]) return;

    for (const [fips, name, st, tax, rate] of stateMap[state]) {
      const opt = document.createElement('option');
      opt.value = fips;
      opt.textContent = name;
      opt.dataset.rate = rate;
      opt.dataset.tax = tax;
      sel.appendChild(opt);
    }
  }

  // 🆕 URL 파라미터 초기값 적용 (?state=AL&county=01089&price=299200)
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);

    const priceParam  = params.get('price');
    const stateParam  = (params.get('state')  || '').trim().toUpperCase();
    // FIPS는 leading zero가 있을 수 있으므로 5자리로 정규화
    const rawCounty   = (params.get('county') || '').trim();
    const countyParam = rawCounty ? rawCounty.padStart(5, '0') : '';

    // 1) price → homeValue
    if (priceParam) {
      const price = parseFloat(priceParam);
      if (isFinite(price) && price > 0) {
        document.getElementById('homeValue').value = Math.round(price);
      }
    }

    // 2) county만 있고 state가 없으면 FIPS로 주 약자 역조회
    let effectiveState = stateParam;
    if (!effectiveState && countyParam && countyData && countyData[countyParam]) {
      effectiveState = countyData[countyParam][1];  // info = [name, state, median_tax, rate]
    }

    // 3) state → stateSelect 지정 + county 목록 채우기
    if (effectiveState) {
      const stateSel = document.getElementById('stateSelect');
      const hasState = Array.from(stateSel.options).some(o => o.value === effectiveState);
      if (hasState) {
        stateSel.value = effectiveState;
        populateCountySelect(effectiveState);   // ← 수동 호출 (change 이벤트는 안 뜸)

        // 4) county(FIPS) → countySelect 지정
        if (countyParam) {
          const countySel = document.getElementById('countySelect');
          const hasCounty = Array.from(countySel.options).some(o => o.value === countyParam);
          if (hasCounty) {
            countySel.value = countyParam;
          } else {
            console.warn('[property-tax] County FIPS not found in state:', countyParam);
          }
        }
      } else {
        console.warn('[property-tax] State not found in data:', effectiveState);
      }
    }
  }

  function calculate() {
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;

  function calculate() {
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
    const assessmentRatio = parseFloat(document.getElementById('assessmentRatio').value) || 100;
    const exemption = parseFloat(document.getElementById('exemption').value) || 0;

    const countySel = document.getElementById('countySelect');
    const opt = countySel.options[countySel.selectedIndex];
    const rate = opt && opt.dataset.rate ? parseFloat(opt.dataset.rate) : 0;

    // Taxable value after assessment ratio and exemption
    const assessedValue = homeValue * (assessmentRatio / 100);
    const taxableValue = Math.max(0, assessedValue - exemption);

    // Annual tax
    const annualTax = taxableValue * (rate / 100);
    const monthlyTax = annualTax / 12;
    const fiveYearTotal = annualTax * 5;

    // 출력
    document.getElementById('annualTax').textContent = fmt(annualTax);
    document.getElementById('annualAmount').textContent = fmt(annualTax);
    document.getElementById('monthlyAmount').textContent = fmt(monthlyTax);
    document.getElementById('taxableValue').textContent = fmt(taxableValue);
    document.getElementById('effectiveRate').textContent = rate.toFixed(2) + '%';
    document.getElementById('fiveYearTotal').textContent = fmt(fiveYearTotal);
    document.getElementById('effectiveInfo').textContent = 'Effective Rate: ' + rate.toFixed(2) + '%';

    // 주 평균 표시
    const stateSel = document.getElementById('stateSelect');
    const state = stateSel.value;
    if (state && stateAvgRates[state]) {
      document.getElementById('stateAvg').textContent = stateAvgRates[state].toFixed(2) + '%';
    } else {
      document.getElementById('stateAvg').textContent = '—';
    }

    // 비교 박스
    checkComparison(rate, state);
    updateInsuranceLink();   // 🆕
  }
  // 🆕 insurance 역방향 링크 생성/노출
  function updateInsuranceLink() {
    const box = document.getElementById('insuranceLinkBox');
    const link = document.getElementById('insuranceLink');
    if (!box || !link) return;

    const countySel = document.getElementById('countySelect');
    const fips = countySel && countySel.value;

    // county 미선택 또는 메타데이터 없음 → 숨김
    if (!fips || !countyData || !countyData[fips]) {
      box.style.display = 'none';
      link.removeAttribute('href');
      return;
    }

    const info = countyData[fips];
    const slug = info.length >= 5 ? info[4] : null;

    // slug 없으면 숨김 (매칭 실패 케이스)
    if (!slug) {
      box.style.display = 'none';
      link.removeAttribute('href');
      return;
    }

    // insurance_base_url 은 fetch 한 data 에서 가져옴 (아래 4-C 참고)
    const baseUrl = window.__insuranceBaseUrl || 'https://insurance.dataindp.com';
    link.href = `${baseUrl}/counties/${encodeURIComponent(slug)}.html`;
    box.style.display = 'block';
  }

  function checkComparison(rate, state) {
    const box = document.getElementById('comparisonBox');
    if (!rate || !state) {
      box.innerHTML = '<p class="limit-hint">💡 Select a county to compare your rate with the local average.</p>';
      return;
    }

    const stateAvg = stateAvgRates[state] || 0;
    const diff = rate - stateAvg;

    let msg = '';
    if (Math.abs(diff) < 0.05) {
      msg = `Your county's rate (${rate.toFixed(2)}%) is <strong>about equal to</strong> the state average (${stateAvg.toFixed(2)}%).`;
    } else if (diff > 0) {
      msg = `Your county's rate (${rate.toFixed(2)}%) is <strong class="up">${diff.toFixed(2)}% above</strong> the state average (${stateAvg.toFixed(2)}%).`;
    } else {
      msg = `Your county's rate (${rate.toFixed(2)}%) is <strong class="down">${Math.abs(diff).toFixed(2)}% below</strong> the state average (${stateAvg.toFixed(2)}%).`;
    }
    box.innerHTML = '<p>' + msg + '</p>';
  }

  function fmt(n) {
    if (!isFinite(n) || n < 0) return '$0';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  // 페이지 로드 시 자동 계산
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(calculate, 500);
  });

})();