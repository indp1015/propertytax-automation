/**
 * DataInDP - 공통 검색 스크립트 (자동완성 + 인기지역 매핑 추가)
 */
(function () {
  'use strict';

  const BASE_URL = window.BASE_URL || '';
  let searchData = []; // JSON 데이터를 메모리에 캐싱

  // ─────────────────────────────────────────────
  // 1. 초기화 (JSON 데이터 로드 및 이벤트 바인딩)
  // ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async function () {
    const input = document.getElementById('searchInput');
    if (!input) return;

    // 데이터 미리 로드
    try {
      const response = await fetch(BASE_URL + '/static/counties_tax_rates.json');
      searchData = await response.json();
      
      setupPopularLinks(); // 인기 지역 링크 정확한 주소로 변경
    } catch (err) {
      console.error('Failed to load search data:', err);
    }

    // 엔터키 이벤트
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });

    // 🆕 입력할 때마다 자동완성 실행
    input.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      const suggestionsBox = document.getElementById('searchSuggestions');
      
      if (!query) {
        suggestionsBox.style.display = 'none';
        return;
      }

      // 카운티명 또는 주명으로 필터링 (최대 10개)
      const matches = searchData.filter(item => 
        item.county.toLowerCase().includes(query) || 
        item.state.toLowerCase().includes(query)
      ).slice(0, 10);

      if (matches.length > 0) {
        suggestionsBox.innerHTML = matches.map(item => 
          `<div class="suggestion-item" data-slug="${item.slug}">
             <strong>${item.county}</strong>, ${item.state}
           </div>`
        ).join('');
        suggestionsBox.style.display = 'block';
      } else {
        suggestionsBox.style.display = 'none';
      }
    });

    // 🆕 추천 목록 클릭 이벤트 (이벤트 위임)
    document.getElementById('searchSuggestions').addEventListener('click', function(e) {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const slug = item.getAttribute('data-slug');
        window.location.href = BASE_URL + '/counties/' + slug + '.html';
      }
    });

    // 🆕 바깥 영역 클릭 시 드롭다운 닫기
    document.addEventListener('click', function(e) {
      const box = document.getElementById('searchSuggestions');
      if (box && !e.target.closest('.search-box')) {
        box.style.display = 'none';
      }
    });
  });

  // ─────────────────────────────────────────────
  // 2. 인기 지역 링크 자동 매핑 (404 방지)
  // ─────────────────────────────────────────────
  function setupPopularLinks() {
    // 도시명과 실제 카운티명 매핑 (Houston은 Harris County에 있음)
    const popularMap = {
      'pop-la': { county: 'los angeles', state: 'california' },
      'pop-houston': { county: 'harris', state: 'texas' },
      'pop-chicago': { county: 'cook', state: 'illinois' },
      'pop-phoenix': { county: 'maricopa', state: 'arizona' }
    };

    Object.keys(popularMap).forEach(id => {
      const target = popularMap[id];
      const el = document.getElementById(id);
      if (!el) return;

      // JSON 데이터에서 정확한 slug 찾기 (county 이름과 state 이름이 포함된 것)
      const found = searchData.find(item => 
        item.county.toLowerCase().includes(target.county) && 
        item.state.toLowerCase().includes(target.state)
      );

      if (found) {
        el.href = BASE_URL + '/counties/' + found.slug + '.html';
      } else {
        console.warn(`Popular link not found: ${id}`);
        el.style.display = 'none'; // 매핑 실패 시 링크 숨김
      }
    });
  }

  // ─────────────────────────────────────────────
  // 3. 검색 실행 (Find 버튼 / 엔터)
  // ─────────────────────────────────────────────
  function performSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    if (!query) return;

    if (searchData.length === 0) {
      alert('검색 데이터를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const normalizedQuery = query.replace(/\s+/g, '-');
    let result = searchData.find(item => item.slug === normalizedQuery);

    if (!result) {
      result = searchData.find(item =>
        item.county.toLowerCase() === query ||
        item.county.toLowerCase().includes(query) ||
        item.state.toLowerCase().includes(query)
      );
    }

    if (result) {
      window.location.href = BASE_URL + '/counties/' + result.slug + '.html';
    } else {
      alert('해당 지역을 찾을 수 없습니다.\n카운티 이름이나 주 이름을 정확히 입력해주세요.');
    }
  }

  // ─────────────────────────────────────────────
  // 4. 내 위치 찾기
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
          alert('위치 정보를 가져오는 중 오류가 발생했습니다.');
          restore();
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        alert('위치 정보를 가져올 수 없습니다. 브라우저 권한을 확인해주세요.');
        restore();
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  // onclick 속성에서 호출할 수 있도록 전역 노출
  window.performSearch = performSearch;
  window.useMyLocation = useMyLocation;
})();