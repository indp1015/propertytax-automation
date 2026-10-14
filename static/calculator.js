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
      buildStateMap();
      populateStateSelect();
      // 국민 평균 표시
      const el = document.getElementById('nationalAvg');
      if (el) el.textContent = nationalAvgRate.toFixed(2) + '%';
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