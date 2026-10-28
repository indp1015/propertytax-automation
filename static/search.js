/**
 * DataInDP - 공통 검색 및 내 위치 찾기 스크립트
 * 사용 서브사이트: Property Tax, Housing, Mortgage, Insurance, Solar
 * 
 * 의존성: 각 index.html에서 <script>window.BASE_URL = "..."</script> 가 먼저 선언되어야 함
 * 데이터: /static/counties_tax_rates.json (generate_pages.py에서 자동 생성)
 */
(function () {
  'use strict';

  const BASE_URL = window.BASE_URL || '';

  // ─────────────────────────────────────────────
  // 1. 검색 기능 (카운티명 / 주명 / slug 기반)
  // ─────────────────────────────────────────────
  async function performSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    if (!query) return;

    try {
      const response = await fetch(BASE_URL + '/static/counties_tax_rates.json');
      if (!response.ok) throw new Error('JSON fetch failed: ' + response.status);
      const data = await response.json();

      // 1) 정확히 일치하는 카운티 우선 (예: "Los Angeles")
      // 2) 그 다음 부분 일치 (예: "angeles" 또는 "california")
      const normalizedQuery = query.replace(/\s+/g, '-');

      let result = data.find(item => item.slug === normalizedQuery);

      if (!result) {
        result = data.find(item =>
          item.county.toLowerCase() === query ||
          item.county.toLowerCase().includes(query) ||
          item.state.toLowerCase().includes(query) ||
          item.slug.includes(normalizedQuery)
        );
      }

      if (result) {
        window.location.href = BASE_URL + '/counties/' + result.slug + '.html';
      } else {
        alert('해당 지역을 찾을 수 없습니다.\n카운티 이름이나 주 이름을 정확히 입력해주세요.');
      }
    } catch (err) {
      console.error('Search error:', err);
      alert('검색 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }

  // ─────────────────────────────────────────────
  // 2. 내 위치 찾기 기능 (Census Geocoding API)
  // ─────────────────────────────────────────────
  function useMyLocation() {
    const btn = document.getElementById('locationBtn');
    if (!btn) return;

    const originalText = btn.innerText;
    btn.innerText = '⏳ Finding location...';
    btn.style.pointerEvents = 'none';

    const restore = () => {
      btn.innerText = originalText;
      btn.style.pointerEvents = 'auto';
    };

    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
      restore();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const res = await fetch(
            'https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
            '?x=' + lon + '&y=' + lat +
            '&benchmark=Public_AR_Current&vintage=Current_Current&format=json'
          );
          if (!res.ok) throw new Error('Census API error: ' + res.status);
          const data = await res.json();

          const geos = data.result && data.result.geographies;
          if (geos && geos['Counties'] && geos['Counties'].length > 0) {
            const countyName = geos['Counties'][0].NAME.replace(/ County$/, '').trim();
            const stateName = geos['States'][0].NAME;
            const slug = (countyName + '-' + stateName)
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '');

            window.location.href = BASE_URL + '/counties/' + slug + '.html';
          } else {
            alert('위치를 카운티로 변환할 수 없습니다. 검색창을 이용해주세요.');
            restore();
          }
        } catch (err) {
          console.error('Geocoding error:', err);
          alert('위치 정보를 가져오는 중 오류가 발생했습니다. 검색창을 이용해주세요.');
          restore();
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        alert('위치 정보를 가져올 수 없습니다. 브라우저의 위치 권한을 확인해주세요.');
        restore();
      },
      { timeout: 10000, maximumAge: 600000 }  // 10초 타임아웃, 10분 캐시
    );
  }

  // ─────────────────────────────────────────────
  // 3. 초기화: Enter 키 이벤트 바인딩
  // ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('searchInput');
    if (input) {
      input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          performSearch();
        }
      });
    }
  });

  // onclick 속성에서 호출할 수 있도록 전역 노출
  window.performSearch = performSearch;
  window.useMyLocation = useMyLocation;
})();