const { centers, tokens, records } = window.APP_DATA;

const dom = {
  smartSearch: document.getElementById('smartSearch'),
  autocompleteList: document.getElementById('autocompleteList'),
  firstName: document.getElementById('firstName'),
  fatherName: document.getElementById('fatherName'),
  grandfatherName: document.getElementById('grandfatherName'),
  familyName: document.getElementById('familyName'),
  voterId: document.getElementById('voterId'),
  centerMultiSelect: document.getElementById('centerMultiSelect'),
  centerSelectBtn: document.getElementById('centerSelectBtn'),
  centerSelectLabel: document.getElementById('centerSelectLabel'),
  centerDropdown: document.getElementById('centerDropdown'),
  centerOptions: document.getElementById('centerOptions'),
  searchBtn: document.getElementById('searchBtn'),
  resetBtn: document.getElementById('resetBtn'),
  printBtn: document.getElementById('printBtn'),
  loadingState: document.getElementById('loadingState'),
  messageState: document.getElementById('messageState'),
  resultsGrid: document.getElementById('resultsGrid'),
  statusText: document.getElementById('statusText'),
  resultCount: document.getElementById('resultCount'),
  resultState: document.getElementById('resultState'),
  recordCount: document.getElementById('recordCount'),
  centerCount: document.getElementById('centerCount'),
};

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200];
const state = { suggestions: [], activeIndex: -1, matchedRows: [], currentPage: 1, pageSize: 50, selectedCenters: [] };

const normalize = (value) => (value || '').toString().trim().replace(/\s+/g, ' ');
const contains = (source, target) => normalize(source).includes(normalize(target));
const isDigits = (value) => /^\d+$/.test(value);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildCenterOptions() {
  const allSelected = state.selectedCenters.length === centers.length;
  dom.centerOptions.innerHTML = `
    <label class="multi-option select-all"><input type="checkbox" value="__all__" ${allSelected ? 'checked' : ''}><span>اختيار الجميع</span></label>
    ${centers.map((center) => {
      const checked = state.selectedCenters.includes(center) ? 'checked' : '';
      return `<label class="multi-option"><input type="checkbox" value="${escapeHtml(center)}" ${checked}><span>${escapeHtml(center)}</span></label>`;
    }).join('')}
  `;

  dom.centerOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.value === '__all__') {
        state.selectedCenters = checkbox.checked ? [...centers] : [];
        buildCenterOptions();
        updateCenterLabel();
        return;
      }

      if (checkbox.checked) {
        if (!state.selectedCenters.includes(checkbox.value)) state.selectedCenters.push(checkbox.value);
      } else {
        state.selectedCenters = state.selectedCenters.filter((item) => item !== checkbox.value);
      }
      updateCenterLabel();
      const allBox = dom.centerOptions.querySelector('input[value="__all__"]');
      if (allBox) allBox.checked = state.selectedCenters.length === centers.length;
    });
  });

  updateCenterLabel();
}

function updateCenterLabel() {
  const count = state.selectedCenters.length;
  if (!count || count === centers.length) dom.centerSelectLabel.textContent = 'جميع المراكز';
  else if (count === 1) dom.centerSelectLabel.textContent = state.selectedCenters[0];
  else dom.centerSelectLabel.textContent = `تم اختيار ${count} مراكز`;
}

function toggleCenterDropdown(force) {
  const shouldOpen = typeof force === 'boolean' ? force : dom.centerDropdown.classList.contains('hidden');
  dom.centerDropdown.classList.toggle('hidden', !shouldOpen);
  dom.centerSelectBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (shouldOpen) buildCenterOptions();
}

function updateSummary(count, label) {
  dom.resultCount.textContent = count.toLocaleString('en-US');
  dom.resultState.textContent = label;
}

function showMessage(message, stateLabel = 'جاهز') {
  dom.loadingState.classList.add('hidden');
  dom.resultsGrid.innerHTML = '';
  dom.messageState.classList.remove('hidden');
  dom.messageState.innerHTML = `<p>${escapeHtml(message)}</p>`;
  dom.statusText.textContent = message;
  state.matchedRows = [];
  state.currentPage = 1;
  updateSummary(0, stateLabel);
}

function showLoading() {
  dom.messageState.classList.add('hidden');
  dom.resultsGrid.innerHTML = '';
  dom.loadingState.classList.remove('hidden');
  dom.statusText.textContent = 'جاري تنفيذ البحث...';
  updateSummary(0, 'تحميل');
}

function buildRows(rowsSource, startNumber = 1) {
  return rowsSource.map((item, index) => {
    const centerName = centers[item[6]];
    const fullName = `${item[1]} ${item[2]} ${item[3]} ${item[4]}`;
    return `
      <tr>
        <td class="row-number">${startNumber + index}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(item[5])}</td>
        <td>${escapeHtml(centerName)}</td>
      </tr>
    `;
  }).join('');
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.matchedRows.length / state.pageSize));
}

function getVisiblePageNumbers(currentPage, totalPages) {
  const maxButtons = 9;
  if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, currentPage - 4);
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function renderResultsPage() {
  dom.loadingState.classList.add('hidden');
  dom.messageState.classList.add('hidden');

  const totalMatches = state.matchedRows.length;
  if (!totalMatches) {
    showMessage('لا توجد نتائج مطابقة', 'لا توجد نتائج');
    return;
  }

  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalMatches);
  const pageRows = state.matchedRows.slice(startIndex, endIndex);
  const rows = buildRows(pageRows, startIndex + 1);

  const pageNumbers = getVisiblePageNumbers(state.currentPage, totalPages)
    .map((page) => `<button class="page-btn ${page === state.currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`)
    .join('');

  dom.resultsGrid.innerHTML = `
    <div class="results-list-card card">
      <div class="results-controls">
        <div class="results-meta">
          <p class="results-total">عدد النتائج الكلي: ${totalMatches.toLocaleString('en-US')}</p>
          <div class="page-size-wrap">
            <label for="pageSizeSelect">عدد الصفوف في الصفحة:</label>
            <select id="pageSizeSelect" class="page-size-select">
              ${PAGE_SIZE_OPTIONS.map(size => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size}</option>`).join('')}
            </select>
          </div>
        </div>
        ${totalPages > 1 ? `<div class="pagination"><button class="page-btn" data-page="${Math.max(1, state.currentPage - 1)}" ${state.currentPage === 1 ? 'disabled' : ''}>السابق</button>${pageNumbers}<button class="page-btn" data-page="${Math.min(totalPages, state.currentPage + 1)}" ${state.currentPage === totalPages ? 'disabled' : ''}>التالي</button></div>` : ''}
      </div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th>م</th>
              <th>الاسم الكامل</th>
              <th>رقم الناخب</th>
              <th>اسم مركز الاقتراع</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  const fromNo = startIndex + 1;
  const toNo = endIndex;
  dom.statusText.textContent = `تم العثور على ${totalMatches.toLocaleString('en-US')} نتيجة. يتم الآن عرض النتائج من ${fromNo.toLocaleString('en-US')} إلى ${toNo.toLocaleString('en-US')} — صفحة ${state.currentPage} من ${totalPages}.`;
  updateSummary(totalMatches, 'نجاح');

  const pageSizeSelect = document.getElementById('pageSizeSelect');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (event) => {
      state.pageSize = Number(event.target.value);
      state.currentPage = 1;
      renderResultsPage();
    });
  }

  dom.resultsGrid.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const newPage = Number(button.dataset.page);
      if (!newPage || newPage === state.currentPage) return;
      state.currentPage = newPage;
      renderResultsPage();
      window.scrollTo({ top: dom.resultsGrid.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
    });
  });
}

function printAllResults() {
  const totalMatches = state.matchedRows.length;
  if (!totalMatches) {
    showMessage('لا توجد نتائج مطابقة', 'لا توجد نتائج');
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const printDoc = iframe.contentWindow.document;
  printDoc.open();
  printDoc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>نتائج البحث - نظام الاستعلام الذكي للناخبين</title>
  <style>
    body{font-family:Arial,sans-serif;direction:rtl;margin:24px;color:#111}
    h1{margin:0 0 8px;font-size:24px}
    .meta{margin:0 0 18px;font-size:16px;font-weight:700}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #999;padding:8px 10px;text-align:right;vertical-align:top}
    th{background:#f0f4fa}
  </style>
</head>
<body>
  <h1>نتائج البحث</h1>
  <p class="meta">عدد النتائج الكلي: ${totalMatches.toLocaleString('en-US')}</p>
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الاسم الكامل</th>
        <th>رقم الناخب</th>
        <th>اسم مركز الاقتراع</th>
      </tr>
    </thead>
    <tbody>${buildRows(state.matchedRows, 1)}</tbody>
  </table>
</body>
</html>`);
  printDoc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 400);
}

function getFilters() {
  return {
    smart: normalize(dom.smartSearch.value),
    first: normalize(dom.firstName.value),
    father: normalize(dom.fatherName.value),
    grand: normalize(dom.grandfatherName.value),
    family: normalize(dom.familyName.value),
    voterId: normalize(dom.voterId.value),
    centers: [...state.selectedCenters],
  };
}

function hasAnyFilter(filters) {
  return Boolean(filters.smart || filters.first || filters.father || filters.grand || filters.family || filters.voterId || filters.centers.length);
}

function performSearch() {
  const filters = getFilters();

  if (!hasAnyFilter(filters)) {
    showMessage('يرجى إدخال بيانات البحث', 'إدخال ناقص');
    return;
  }

  if (filters.voterId && !isDigits(filters.voterId)) {
    showMessage('رقم الناخب يجب أن يحتوي على أرقام فقط', 'خطأ إدخال');
    return;
  }

  showLoading();

  window.setTimeout(() => {
    try {
      const found = [];

      for (const row of records) {
        const fullName = `${row[1]} ${row[2]} ${row[3]} ${row[4]}`;
        const centerName = centers[row[6]];

        if (filters.smart) {
          const smartIsDigits = isDigits(filters.smart);
          const smartOk = smartIsDigits
            ? row[5] === filters.smart
            : contains(fullName, filters.smart)
              || contains(row[1], filters.smart)
              || contains(row[2], filters.smart)
              || contains(row[3], filters.smart)
              || contains(row[4], filters.smart)
              || contains(centerName, filters.smart);
          if (!smartOk) continue;
        }

        if (filters.first && !contains(row[1], filters.first)) continue;
        if (filters.father && !contains(row[2], filters.father)) continue;
        if (filters.grand && !contains(row[3], filters.grand)) continue;
        if (filters.family && !contains(row[4], filters.family)) continue;
        if (filters.voterId && row[5] !== filters.voterId) continue;
        if (filters.centers.length && !filters.centers.includes(centerName)) continue;

        found.push(row);
      }

      state.matchedRows = found;
      state.currentPage = 1;
      renderResultsPage();
    } catch (error) {
      console.error(error);
      showMessage('حدث خطأ في الاتصال', 'خطأ');
    }
  }, 60);
}

function resetForm() {
  dom.smartSearch.value = '';
  dom.firstName.value = '';
  dom.fatherName.value = '';
  dom.grandfatherName.value = '';
  dom.familyName.value = '';
  dom.voterId.value = '';
  state.selectedCenters = [];
  updateCenterLabel();
  buildCenterOptions();
  toggleCenterDropdown(false);
  state.pageSize = 50;
  state.currentPage = 1;
  hideAutocomplete();
  showMessage('يرجى إدخال بيانات البحث', 'جاهز');
}

function buildSuggestions(query) {
  if (query.length < 2) return [];

  const suggestions = [];
  const seen = new Set();

  for (const token of tokens) {
    if (contains(token, query) && !seen.has(token)) {
      seen.add(token);
      suggestions.push({ value: token, label: `اقتراح اسم: ${token}` });
      if (suggestions.length >= 8) break;
    }
  }

  if (isDigits(query)) {
    for (const row of records) {
      if (row[5].startsWith(query) && !seen.has(row[5])) {
        seen.add(row[5]);
        suggestions.push({ value: row[5], label: `رقم ناخب: ${row[5]}` });
        if (suggestions.length >= 12) break;
      }
    }
  }

  return suggestions;
}

function renderAutocomplete(items) {
  state.suggestions = items;
  state.activeIndex = -1;

  if (!items.length) {
    hideAutocomplete();
    return;
  }

  dom.autocompleteList.innerHTML = items.map((item, index) => `<div class="autocomplete-item" data-index="${index}">${escapeHtml(item.label)}</div>`).join('');
  dom.autocompleteList.classList.remove('hidden');
}

function hideAutocomplete() {
  dom.autocompleteList.classList.add('hidden');
  dom.autocompleteList.innerHTML = '';
  state.suggestions = [];
  state.activeIndex = -1;
}

function applySuggestion(index) {
  const item = state.suggestions[index];
  if (!item) return;
  dom.smartSearch.value = item.value;
  hideAutocomplete();
}

function moveActive(direction) {
  if (!state.suggestions.length) return;
  state.activeIndex += direction;
  if (state.activeIndex < 0) state.activeIndex = state.suggestions.length - 1;
  if (state.activeIndex >= state.suggestions.length) state.activeIndex = 0;
  [...dom.autocompleteList.querySelectorAll('.autocomplete-item')].forEach((el, idx) => el.classList.toggle('active', idx === state.activeIndex));
}

function init() {
  dom.recordCount.textContent = records.length.toLocaleString('en-US');
  dom.centerCount.textContent = centers.length.toLocaleString('en-US');
  buildCenterOptions();
  updateCenterLabel();
  showMessage('يرجى إدخال بيانات البحث', 'جاهز');

  dom.searchBtn.addEventListener('click', performSearch);
  dom.resetBtn.addEventListener('click', resetForm);
  dom.printBtn.addEventListener('click', printAllResults);
  dom.centerSelectBtn.addEventListener('click', () => toggleCenterDropdown());
  dom.voterId.addEventListener('input', () => { dom.voterId.value = dom.voterId.value.replace(/[^\d]/g, ''); });
  dom.smartSearch.addEventListener('input', () => renderAutocomplete(buildSuggestions(normalize(dom.smartSearch.value))));

  dom.smartSearch.addEventListener('keydown', (event) => {
    if (dom.autocompleteList.classList.contains('hidden')) {
      if (event.key === 'Enter') performSearch();
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
    else if (event.key === 'Enter') {
      if (state.activeIndex >= 0) { event.preventDefault(); applySuggestion(state.activeIndex); }
      else { performSearch(); }
    } else if (event.key === 'Escape') { hideAutocomplete(); }
  });

  dom.autocompleteList.addEventListener('click', (event) => {
    const item = event.target.closest('.autocomplete-item');
    if (!item) return;
    applySuggestion(Number(item.dataset.index));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete-wrap')) hideAutocomplete();
  });

  document.addEventListener('click', (event) => {
    if (!dom.centerMultiSelect.contains(event.target)) toggleCenterDropdown(false);
  });

  [dom.firstName, dom.fatherName, dom.grandfatherName, dom.familyName, dom.voterId].forEach((el) => {
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') performSearch();
    });
  });
}

init();
