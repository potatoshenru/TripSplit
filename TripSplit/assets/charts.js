const chartColors = ['#b56f18', '#557f3f', '#b84a3d', '#386fa4', '#8a5f9e', '#c76f2d', '#2f7f74', '#9a6b3f'];
let chartHitRegions = [];

function getSelectedChartType() {
  return document.querySelector('input[name="chart_type"]:checked')?.value || 'pie';
}

function groupExpensesByCategory() {
  const totals = new Map();
  expenses.forEach(expense => {
    const amount = Number(expense.twd || 0);
    if (!amount) return;
    const rawLabel = String(expense.category || '').trim();
    const label = /^\d{4}-\d{2}-\d{2}$/.test(rawLabel) ? (expense.title || '未分類') : (rawLabel || '未分類');
    totals.set(label, (totals.get(label) || 0) + amount);
  });

  return Array.from(totals, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function getExpenseTrendRows() {
  const totals = new Map();
  expenses.forEach((expense, index) => {
    const amount = Number(expense.twd || 0);
    if (!amount) return;
    const date = String(expense.date || '').slice(0, 10);
    const label = date || `第 ${index + 1} 筆`;
    totals.set(label, (totals.get(label) || 0) + amount);
  });

  return Array.from(totals, ([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const timeA = Date.parse(a.label);
      const timeB = Date.parse(b.label);
      if (Number.isFinite(timeA) && Number.isFinite(timeB)) return timeA - timeB;
      return 0;
    });
}

function getCategoryCumulativeTrendData() {
  const dateSet = new Set();
  const categoryDateTotals = new Map();

  expenses.forEach((expense, index) => {
    const amount = Number(expense.twd || 0);
    if (!amount) return;
    const date = String(expense.date || '').slice(0, 10) || `第 ${index + 1} 筆`;
    const category = String(expense.category || '').trim() || '未分類';
    dateSet.add(date);
    const key = `${category}__${date}`;
    categoryDateTotals.set(key, (categoryDateTotals.get(key) || 0) + amount);
  });

  const dates = Array.from(dateSet).sort((a, b) => {
    const timeA = Date.parse(a);
    const timeB = Date.parse(b);
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) return timeA - timeB;
    return 0;
  });

  const categoryTotals = new Map();
  categoryDateTotals.forEach((value, key) => {
    const category = key.split('__')[0];
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + value);
  });

  const categories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category]) => category);

  const series = categories.map((category, index) => {
    let running = 0;
    const points = dates.map((date) => {
      running += Number(categoryDateTotals.get(`${category}__${date}`) || 0);
      return { label: date, value: running };
    });
    return { label: category, color: chartColors[index % chartColors.length], points, value: running };
  });

  return { dates, series };
}

function getCurrencyRows() {
  const totals = new Map();
  expenses.forEach((expense) => {
    const currency = String(expense.currency || 'TWD').trim().toUpperCase() || 'TWD';
    const amountOriginal = Number(expense.amount || 0);
    const amountTwd = Number(expense.twd || amountOriginal * Number(expense.rate || 1) || 0);
    if (!amountTwd) return;

    const current = totals.get(currency) || { label: currency, value: 0, originalTotal: 0, count: 0 };
    current.value += amountTwd;
    current.originalTotal += amountOriginal;
    current.count += 1;
    totals.set(currency, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

function getDailyHeatmapRows() {
  return getExpenseTrendRows();
}

function groupExpensesByPayer() {
  const totals = new Map();
  expenses.forEach(expense => {
    const amount = Number(expense.twd || 0);
    if (!amount) return;
    const label = String(expense.payer || '').trim() || '未指定';
    totals.set(label, (totals.get(label) || 0) + amount);
  });

  return Array.from(totals, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function getBalanceChartRows() {
  if (typeof computeMemberBalances !== 'function') return [];
  return computeMemberBalances()
    .filter(item => item.balance !== 0)
    .map(item => ({
      label: item.name || '未命名',
      value: Math.abs(item.balance),
      rawValue: item.balance,
      direction: item.balance > 0 ? '應收' : '應付'
    }))
    .sort((a, b) => Math.abs(b.rawValue) - Math.abs(a.rawValue));
}

function setupChartCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  return { context, width: rect.width, height: rect.height };
}

function formatCompactMoney(value) {
  const amount = Math.round(Number(value || 0));
  if (Math.abs(amount) >= 1000000) return `${Math.round(amount / 10000) / 100}M`;
  if (Math.abs(amount) >= 10000) return `${Math.round(amount / 100) / 10}K`;
  return money.format(amount);
}

function getChartUiScale(context) {
  return context?.canvas?.id === 'chart-zoom-canvas' ? 1.85 : 1;
}

function isZoomChart(context) {
  return context?.canvas?.id === 'chart-zoom-canvas';
}

function drawPieChart(context, rows, width, height) {
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const radius = Math.min(width, height) * 0.32;
  const innerRadius = radius * 0.52;
  const centerX = width / 2;
  const centerY = height / 2;
  let start = -Math.PI / 2;

  rows.forEach((item, index) => {
    const angle = (item.value / total) * Math.PI * 2;
    const end = start + angle;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, radius, start, end);
    context.closePath();
    context.fillStyle = chartColors[index % chartColors.length];
    context.fill();
    chartHitRegions.push({
      type: 'pie',
      label: item.label,
      value: item.value,
      total,
      centerX,
      centerY,
      radius,
      innerRadius,
      start,
      end
    });
    start = end;
  });

  context.beginPath();
  context.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  context.fillStyle = '#fffdf8';
  context.fill();
  context.fillStyle = '#251b12';
  context.font = '800 14px sans-serif';
  context.textAlign = 'center';
  context.fillText('總支出', centerX, centerY - 4);
  context.font = '950 18px sans-serif';
  context.fillText(`NT$ ${money.format(Math.round(total))}`, centerX, centerY + 20);
}

function drawBarChart(context, rows, width, height) {
  const scale = getChartUiScale(context);
  const padding = { top: 34 * scale, right: 16 * scale, bottom: 54 * scale, left: 28 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.map(item => item.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const slotWidth = chartWidth / Math.max(rows.length, 1);
  const maxBarWidth = isZoomChart(context) ? slotWidth * 0.82 : 58;
  const barWidth = Math.max(18 * scale, Math.min(maxBarWidth, slotWidth * 0.56));
  const baselineY = padding.top + chartHeight;

  context.strokeStyle = '#e7d8c2';
  context.lineWidth = 1;
  for (let index = 0; index <= 3; index += 1) {
    const y = padding.top + chartHeight * (index / 3);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }

  rows.forEach((item, index) => {
    const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
    const barHeight = Math.max(4, (item.value / maxValue) * chartHeight);
    const y = baselineY - barHeight;
    context.fillStyle = chartColors[index % chartColors.length];
    context.fillRect(x, y, barWidth, barHeight);
    chartHitRegions.push({
      type: 'bar',
      label: item.label,
      value: item.value,
      total,
      x,
      y,
      width: barWidth,
      height: barHeight
    });

    context.fillStyle = '#251b12';
    context.font = `900 ${11 * scale}px sans-serif`;
    context.textAlign = 'center';
    context.fillText(`NT$ ${formatCompactMoney(item.value)}`, x + barWidth / 2, Math.max(14 * scale, y - 8 * scale));

    context.fillStyle = '#7a6a5b';
    context.font = `800 ${11 * scale}px sans-serif`;
    context.fillText(item.label.slice(0, 6), x + barWidth / 2, height - 22 * scale);
  });
}

function drawLineChart(context, rows, width, height) {
  const padding = { top: 26, right: 28, bottom: 40, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.map(item => item.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const points = rows.map((item, index) => {
    const x = padding.left + (rows.length === 1 ? chartWidth / 2 : (chartWidth * index) / (rows.length - 1));
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });

  context.strokeStyle = '#e7d8c2';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + chartHeight);
  context.lineTo(width - padding.right, padding.top + chartHeight);
  context.stroke();

  context.strokeStyle = '#386fa4';
  context.lineWidth = 3;
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  points.forEach(point => {
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fillStyle = '#b56f18';
    context.fill();
    chartHitRegions.push({
      type: 'point',
      label: point.label,
      value: point.value,
      total,
      x: point.x,
      y: point.y,
      radius: 10
    });
  });

  context.fillStyle = '#7a6a5b';
  context.font = '800 11px sans-serif';
  context.textAlign = 'center';
  points.forEach((point, index) => {
    if (rows.length > 5 && index % Math.ceil(rows.length / 5) !== 0 && index !== rows.length - 1) return;
    context.fillText(point.label.slice(5) || point.label.slice(0, 6), point.x, height - 16);
  });
}

function drawCategoryCumulativeLineChart(context, data, width, height) {
  const { dates = [], series = [] } = data || {};
  if (!dates.length || !series.length) return;

  const padding = { top: 26, right: 28, bottom: 40, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...series.flatMap(item => item.points.map(point => point.value)), 1);

  context.strokeStyle = '#e7d8c2';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + chartHeight);
  context.lineTo(width - padding.right, padding.top + chartHeight);
  context.stroke();

  series.forEach((line, lineIndex) => {
    const points = line.points.map((point, index) => {
      const x = padding.left + (dates.length === 1 ? chartWidth / 2 : (chartWidth * index) / (dates.length - 1));
      const y = padding.top + chartHeight - (point.value / maxValue) * chartHeight;
      return { ...point, x, y, seriesLabel: line.label, color: line.color };
    });

    context.strokeStyle = line.color || chartColors[lineIndex % chartColors.length];
    context.lineWidth = 2.5;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();

    points.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      context.fillStyle = point.color;
      context.fill();
      chartHitRegions.push({
        type: 'category_trend_point',
        label: point.label,
        category: point.seriesLabel,
        value: point.value,
        x: point.x,
        y: point.y,
        radius: 10
      });
    });
  });

  context.fillStyle = '#7a6a5b';
  context.font = '800 11px sans-serif';
  context.textAlign = 'center';
  dates.forEach((date, index) => {
    if (dates.length > 5 && index % Math.ceil(dates.length / 5) !== 0 && index !== dates.length - 1) return;
    const x = padding.left + (dates.length === 1 ? chartWidth / 2 : (chartWidth * index) / (dates.length - 1));
    context.fillText(date.slice(5) || date.slice(0, 6), x, height - 16);
  });
}

function drawHeatmapChart(context, rows, width, height) {
  const scale = getChartUiScale(context);
  const padding = { top: 18 * scale, right: 14 * scale, bottom: 18 * scale, left: 14 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const columns = 7;
  const cellGap = 6 * scale;
  const maxCellSize = isZoomChart(context) ? 999 : 34;
  const cellSize = Math.max(18 * scale, Math.min(maxCellSize, (chartWidth - cellGap * (columns - 1)) / columns));
  const rowsNeeded = Math.ceil(rows.length / columns);
  const totalHeight = rowsNeeded * cellSize + Math.max(0, rowsNeeded - 1) * cellGap;
  const totalWidth = columns * cellSize + cellGap * (columns - 1);
  const startX = padding.left + Math.max(0, (chartWidth - totalWidth) / 2);
  const startY = padding.top + Math.max(0, (chartHeight - totalHeight) / 2);
  const maxValue = Math.max(...rows.map(item => item.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  rows.forEach((item, index) => {
    const rowIndex = Math.floor(index / columns);
    const colIndex = index % columns;
    const x = startX + colIndex * (cellSize + cellGap);
    const y = startY + rowIndex * (cellSize + cellGap);
    const intensity = Math.min(1, item.value / maxValue);
    const lightness = 95 - intensity * 46;
    context.fillStyle = `hsl(32 76% ${lightness}%)`;
    context.fillRect(x, y, cellSize, cellSize);

    context.strokeStyle = '#e7d8c2';
    context.strokeRect(x, y, cellSize, cellSize);

    chartHitRegions.push({
      type: 'heat_cell',
      label: item.label,
      value: item.value,
      total,
      x,
      y,
      width: cellSize,
      height: cellSize
    });

    context.fillStyle = intensity > 0.48 ? '#fffaf2' : '#6b5742';
    context.font = `900 ${10 * scale}px sans-serif`;
    context.textAlign = 'center';
    context.fillText(String(item.label).slice(-2), x + cellSize / 2, y + cellSize * 0.62);
  });
}

function drawHorizontalBarChart(context, rows, width, height, options = {}) {
  const scale = getChartUiScale(context);
  const padding = { top: 24 * scale, right: 14 * scale, bottom: 18 * scale, left: 86 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.map(item => Math.abs(item.value || item.rawValue || 0)), 1);
  const total = rows.reduce((sum, row) => sum + Math.abs(row.value || row.rawValue || 0), 0);
  const rowGap = 10 * scale;
  const rowHeight = Math.max(18 * scale, Math.min(isZoomChart(context) ? 130 : 34, (chartHeight - rowGap * (rows.length - 1)) / Math.max(rows.length, 1)));
  const valueReserve = isZoomChart(context)
    ? Math.min(width * 0.35, Math.max(180 * scale, width * 0.22))
    : Math.min(104, Math.max(76, width * 0.28));
  const maxBarWidth = Math.max(36 * scale, chartWidth - valueReserve);

  context.strokeStyle = '#e7d8c2';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, height - padding.bottom);
  context.stroke();

  rows.forEach((item, index) => {
    const value = Math.abs(item.value || item.rawValue || 0);
    const barWidth = Math.max(5, (value / maxValue) * maxBarWidth);
    const x = padding.left;
    const y = padding.top + index * (rowHeight + rowGap);
    const isNegative = Number(item.rawValue || item.value) < 0;
    const color = options.balanceMode
      ? (isNegative ? '#b84a3d' : '#557f3f')
      : chartColors[index % chartColors.length];

    context.fillStyle = color;
    context.fillRect(x, y, barWidth, rowHeight);

    chartHitRegions.push({
      type: options.balanceMode ? 'balance' : 'payer',
      label: item.label,
      value,
      rawValue: item.rawValue,
      direction: item.direction,
      total,
      x,
      y,
      width: barWidth,
      height: rowHeight
    });

    const label = String(item.label || '未命名');
    context.fillStyle = '#251b12';
    context.font = `900 ${11 * scale}px sans-serif`;
    context.textAlign = 'right';
    context.fillText(label.slice(0, 8), padding.left - 8 * scale, y + rowHeight * .68);

    const prefix = options.balanceMode ? `${item.direction} ` : '';
    const valueText = `${prefix}NT$ ${formatCompactMoney(value)}`;
    const outsideX = x + barWidth + 8 * scale;
    const valueWidth = context.measureText(valueText).width;

    if (outsideX + valueWidth <= width - padding.right) {
      context.textAlign = 'left';
      context.fillStyle = '#251b12';
      context.fillText(valueText, outsideX, y + rowHeight * .68);
    } else {
      context.textAlign = 'right';
      context.fillStyle = '#fffaf2';
      context.fillText(valueText, x + barWidth - 6 * scale, y + rowHeight * .68);
    }
  });
}

let budgetChartHitRegions = [];
let zoomChartHitRegions = [];
let chartInteractionsBound = false;
let chartZoomMode = null;

function getSelectedBudgetChartType() {
  return document.querySelector('input[name="chart_type_budget"]:checked')?.value || 'budget_actual';
}


function renderChartLegend(rows, options = {}) {
  const legend = $(options.legendSelector || '#chart-legend');
  if (!legend) return;
  const colorByLabel = options.colorByLabel || {};

  legend.innerHTML = rows.map((item, index) => {
    const swatchColor = colorByLabel[item.label]
      || (item.direction ? (item.rawValue < 0 ? '#b84a3d' : '#557f3f') : chartColors[index % chartColors.length]);
    const suffix = options.currencyMode
      ? `（${item.count || 0} 筆｜原始 ${Math.round(item.originalTotal || 0)} ${item.label}）`
      : options.budgetMode
        ? `${item.budgetText || `實際 NT$ ${money.format(Math.round(item.value || 0))}`}`
        : `${item.direction ? `${item.direction} ` : ''}NT$ ${money.format(Math.round(item.value || 0))}`;

    return `
      <div class="chart-legend-item">
        <span class="chart-swatch" style="background:${swatchColor}"></span>
        <span>${item.label}・${suffix}</span>
      </div>
    `;
  }).join('');
}

function formatChartTooltip(region) {
  const percent = region.total ? `${Math.round((region.value / region.total) * 1000) / 10}%` : '0%';
  if (region.type === 'point') return `<strong>日期：${region.label}</strong><span>金額：NT$ ${money.format(Math.round(region.value))}</span><span>占比：${percent}</span>`;
  if (region.type === 'category_trend_point') return `<strong>${region.category}｜${region.label}</strong><span>累積：NT$ ${money.format(Math.round(region.value))}</span>`;
  if (region.type === 'payer') return `<strong>付款人：${region.label}</strong><span>墊付：NT$ ${money.format(Math.round(region.value))}</span><span>占比：${percent}</span>`;
  if (region.type === 'balance') return `<strong>${region.label}：${region.direction}</strong><span>金額：NT$ ${money.format(Math.round(region.value))}</span>`;
  if (region.type === 'currency') return `<strong>幣別：${region.label}</strong><span>換算：NT$ ${money.format(Math.round(region.value))}</span><span>原始合計：${Math.round(region.originalTotal || 0)} ${region.label}</span><span>筆數：${region.count || 0}</span>`;
  if (region.type === 'heat_cell') return `<strong>日期：${region.label}</strong><span>花費：NT$ ${money.format(Math.round(region.value))}</span><span>占比：${percent}</span>`;
  if (region.type === 'budget_actual') return `<strong>${region.label}</strong><span>實際：NT$ ${money.format(Math.round(region.value))}</span><span>推估預算：NT$ ${money.format(Math.round(region.budget || 0))}</span>`;
  if (region.type === 'burnup_actual' || region.type === 'burnup_budget') return `<strong>${region.label}</strong><span>${region.series}：NT$ ${money.format(Math.round(region.value))}</span>`;
  if (region.type === 'member_net') return `<strong>${region.member}｜${region.label}</strong><span>淨額：NT$ ${money.format(Math.round(region.value))}</span>`;
  if (region.type === 'matrix_cell') return `<strong>${region.category} × ${region.member}</strong><span>花費：NT$ ${money.format(Math.round(region.value))}</span>`;
  if (region.type === 'weekday') return `<strong>${region.label}</strong><span>總額：NT$ ${money.format(Math.round(region.value))}</span><span>平均：NT$ ${money.format(Math.round(region.avg || 0))}</span><span>筆數：${region.count || 0}</span>`;
  return `<strong>分類：${region.label}</strong><span>金額：NT$ ${money.format(Math.round(region.value))}</span><span>占比：${percent}</span>`;
}

function normalizeAngle(angle) {
  const fullCircle = Math.PI * 2;
  return ((angle % fullCircle) + fullCircle) % fullCircle;
}

function angleIsBetween(angle, start, end) {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  if (normalizedStart <= normalizedEnd) return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd;
  return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
}

function getChartRegionAt(x, y, regions) {
  return (regions || []).find(region => {
    if (region.type === 'pie' || region.type === 'currency') {
      const dx = x - region.centerX;
      const dy = y - region.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      return distance >= region.innerRadius && distance <= region.radius && angleIsBetween(angle, region.start, region.end);
    }
    if (region.type === 'bar' || region.type === 'payer' || region.type === 'balance' || region.type === 'heat_cell' || region.type === 'matrix_cell') {
      return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
    }
    if (region.x !== undefined && region.y !== undefined && region.radius) {
      const dx = x - region.x;
      const dy = y - region.y;
      return Math.sqrt(dx * dx + dy * dy) <= region.radius;
    }
    return false;
  });
}

function moveChartTooltip(region, clientX, clientY, options = {}) {
  const tooltip = $(options.tooltipSelector || '#chart-tooltip');
  const canvas = $(options.canvasSelector || '#expense-chart');
  const wrap = canvas?.closest('.chart-wrap');
  if (!tooltip || !wrap || !region) return;

  const rect = wrap.getBoundingClientRect();
  tooltip.innerHTML = formatChartTooltip(region);
  tooltip.style.display = 'block';

  const tooltipWidth = tooltip.offsetWidth || 180;
  const tooltipHeight = tooltip.offsetHeight || 70;
  const left = Math.min(Math.max(10, clientX - rect.left + 12), rect.width - tooltipWidth - 10);
  const top = Math.min(Math.max(10, clientY - rect.top + 12), rect.height - tooltipHeight - 10);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideChartTooltip(options = {}) {
  const tooltip = $(options.tooltipSelector || '#chart-tooltip');
  const canvas = $(options.canvasSelector || '#expense-chart');
  if (tooltip) tooltip.style.display = 'none';
  if (canvas) canvas.classList.remove('is-interactive');
}

function getSortedExpenseEntries() {
  return expenses
    .map((expense, index) => ({
      ...expense,
      amountTwd: Number(expense.twd || 0),
      dateLabel: String(expense.date || '').slice(0, 10) || `第 ${index + 1} 筆`,
      order: index
    }))
    .filter(item => item.amountTwd > 0)
    .sort((a, b) => {
      const tA = Date.parse(a.dateLabel);
      const tB = Date.parse(b.dateLabel);
      if (Number.isFinite(tA) && Number.isFinite(tB)) return tA - tB;
      return a.order - b.order;
    });
}

function getBudgetVsActualRows() {
  const categoryRows = groupExpensesByCategory().slice(0, 6);
  const total = categoryRows.reduce((sum, item) => sum + item.value, 0);
  const totalBudget = total * 1.12;
  const equalShare = categoryRows.length ? 1 / categoryRows.length : 0;
  return categoryRows.map((item) => {
    const share = total ? item.value / total : equalShare;
    const budget = Math.max(1000, Math.round(totalBudget * (share * 0.72 + equalShare * 0.28)));
    return { ...item, budget, budgetText: `實際 NT$ ${money.format(Math.round(item.value))} / 推估 NT$ ${money.format(budget)}` };
  });
}

function getBurnupRows() {
  const daily = getExpenseTrendRows();
  if (!daily.length) return [];
  const total = daily.reduce((sum, item) => sum + item.value, 0);
  const totalBudget = total * 1.12;
  let running = 0;
  return daily.map((item, index) => {
    running += item.value;
    const budget = (totalBudget * (index + 1)) / daily.length;
    return { label: item.label, actual: running, budget };
  });
}

function getMemberNetTrendData() {
  const names = members.map(item => item.name).filter(Boolean);
  const entries = getSortedExpenseEntries();
  if (!names.length || !entries.length) return { dates: [], series: [] };

  const balances = names.reduce((map, name) => ({ ...map, [name]: 0 }), {});
  const byDate = new Map();
  entries.forEach((entry) => {
    if (!byDate.has(entry.dateLabel)) byDate.set(entry.dateLabel, []);
    byDate.get(entry.dateLabel).push(entry);
  });

  const dates = Array.from(byDate.keys());
  const series = names.map((name, index) => ({ label: name, color: chartColors[index % chartColors.length], points: [] }));

  dates.forEach((date) => {
    const dayExpenses = byDate.get(date) || [];
    dayExpenses.forEach((expense) => {
      const payer = expense.payer;
      const amount = expense.amountTwd;
      if (balances[payer] === undefined) balances[payer] = 0;
      balances[payer] += amount;
      const share = amount / Math.max(names.length, 1);
      names.forEach((name) => {
        balances[name] = (balances[name] || 0) - share;
      });
    });

    series.forEach((line) => {
      line.points.push({ label: date, value: balances[line.label] || 0 });
    });
  });

  return { dates, series };
}

function getCategoryMemberMatrixData() {
  const categoryLabels = groupExpensesByCategory().slice(0, 5).map(item => item.label);
  const memberLabels = members.map(item => item.name).filter(Boolean);
  const valueMap = new Map();
  expenses.forEach((expense) => {
    const category = String(expense.category || '').trim() || '未分類';
    const payer = String(expense.payer || '').trim() || '未指定';
    if (!categoryLabels.includes(category) || !memberLabels.includes(payer)) return;
    const key = `${category}__${payer}`;
    valueMap.set(key, (valueMap.get(key) || 0) + Number(expense.twd || 0));
  });

  const cells = [];
  categoryLabels.forEach((category) => {
    memberLabels.forEach((member) => {
      cells.push({ category, member, value: Number(valueMap.get(`${category}__${member}`) || 0) });
    });
  });

  return { categories: categoryLabels, members: memberLabels, cells };
}

function getWeekdayDistributionRows() {
  const labels = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const map = labels.map(label => ({ label, value: 0, count: 0, avg: 0 }));
  getSortedExpenseEntries().forEach((item) => {
    const time = Date.parse(item.dateLabel);
    const day = Number.isFinite(time) ? new Date(time).getDay() : 0;
    map[day].value += item.amountTwd;
    map[day].count += 1;
  });
  return map.map((item) => ({ ...item, avg: item.count ? item.value / item.count : 0 }));
}

function drawBudgetCompareChart(context, rows, width, height) {
  const scale = getChartUiScale(context);
  const padding = { top: 20 * scale, right: 18 * scale, bottom: 20 * scale, left: 18 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const labelReserve = Math.max(54, Math.min(78, width * 0.16));
  const valueReserve = Math.max(86, Math.min(120, width * 0.25));
  const barsStartX = padding.left + labelReserve;
  const barsMaxWidth = Math.max(40, chartWidth - labelReserve - valueReserve);
  const rowGap = 12 * scale;
  const rowHeight = Math.max(18 * scale, Math.min(isZoomChart(context) ? 150 : 30, (chartHeight - rowGap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1)));
  const rowsHeight = rows.length * rowHeight + Math.max(rows.length - 1, 0) * rowGap;
  const startY = padding.top + Math.max(0, (chartHeight - rowsHeight) / 2);
  const maxValue = Math.max(...rows.flatMap(item => [item.value, item.budget]), 1);

  rows.forEach((item, index) => {
    const y = startY + index * (rowHeight + rowGap);
    const actualWidth = (item.value / maxValue) * barsMaxWidth;
    const budgetWidth = (item.budget / maxValue) * barsMaxWidth;

    context.fillStyle = '#eadfce';
    context.fillRect(barsStartX, y, budgetWidth, rowHeight);
    context.fillStyle = chartColors[index % chartColors.length];
    context.fillRect(barsStartX, y + 3, actualWidth, rowHeight - 6);

    context.fillStyle = '#251b12';
    context.font = `900 ${11 * scale}px sans-serif`;
    context.textAlign = 'right';
    context.fillText(item.label.slice(0, 8), barsStartX - 8 * scale, y + rowHeight * 0.7);

    context.textAlign = 'left';
    context.fillStyle = '#6b5742';
    context.font = `800 ${10 * scale}px sans-serif`;
    context.fillText(`實 ${formatCompactMoney(item.value)} / 預 ${formatCompactMoney(item.budget)}`, barsStartX + Math.max(actualWidth, budgetWidth) + 8 * scale, y + rowHeight * 0.68);

    budgetChartHitRegions.push({ type: 'budget_actual', label: item.label, value: item.value, budget: item.budget, x: barsStartX, y, width: Math.max(actualWidth, budgetWidth, 8), height: rowHeight });
  });
}

function drawBurnupChart(context, rows, width, height) {
  const scale = getChartUiScale(context);
  const padding = { top: 26 * scale, right: 28 * scale, bottom: 40 * scale, left: 28 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.flatMap(item => [item.actual, item.budget]), 1);

  const drawLine = (seriesKey, color, type) => {
    const points = rows.map((item, index) => ({
      label: item.label,
      value: item[seriesKey],
      x: padding.left + (rows.length === 1 ? chartWidth / 2 : (chartWidth * index) / (rows.length - 1)),
      y: padding.top + chartHeight - (item[seriesKey] / maxValue) * chartHeight
    }));

    context.strokeStyle = color;
    context.lineWidth = 2.4 * scale;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();

    points.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 3.5 * scale, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      budgetChartHitRegions.push({ type, series: seriesKey === 'actual' ? '累積實際' : '累積推估預算', label: point.label, value: point.value, x: point.x, y: point.y, radius: 12 * scale });
    });
  };

  drawLine('budget', '#9f8d74', 'burnup_budget');
  drawLine('actual', '#386fa4', 'burnup_actual');

  const last = rows[rows.length - 1];
  if (last) {
    context.fillStyle = '#251b12';
    context.font = `900 ${11 * scale}px sans-serif`;
    context.textAlign = 'right';
    context.fillText(`實際 NT$ ${formatCompactMoney(last.actual)}`, width - 12 * scale, 20 * scale);
    context.fillText(`預算 NT$ ${formatCompactMoney(last.budget)}`, width - 12 * scale, 36 * scale);
  }
}

function drawMemberNetTrendChart(context, data, width, height) {
  const { dates = [], series = [] } = data;
  const scale = getChartUiScale(context);
  const padding = { top: 26 * scale, right: 28 * scale, bottom: 40 * scale, left: 28 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxAbs = Math.max(...series.flatMap(item => item.points.map(point => Math.abs(point.value))), 1);

  context.strokeStyle = '#e7d8c2';
  context.beginPath();
  context.moveTo(padding.left, padding.top + chartHeight / 2);
  context.lineTo(width - padding.right, padding.top + chartHeight / 2);
  context.stroke();

  series.forEach((line) => {
    context.strokeStyle = line.color;
    context.lineWidth = 2.2 * scale;

    const plottedPoints = line.points.map((point, index) => {
      const x = padding.left + (dates.length === 1 ? chartWidth / 2 : (chartWidth * index) / (dates.length - 1));
      const y = padding.top + chartHeight / 2 - (point.value / maxAbs) * (chartHeight / 2 - 6 * scale);
      return { ...point, x, y };
    });

    context.beginPath();
    plottedPoints.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();

    plottedPoints.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 3 * scale, 0, Math.PI * 2);
      context.fillStyle = line.color;
      context.fill();
      budgetChartHitRegions.push({ type: 'member_net', member: line.label, label: point.label, value: point.value, x: point.x, y: point.y, radius: 10 * scale });
    });
  });
}

function drawCategoryMemberMatrixChart(context, data, width, height) {
  const { categories = [], members = [], cells = [] } = data;
  const scale = getChartUiScale(context);
  const padding = { top: 18 * scale, right: 18 * scale, bottom: 18 * scale, left: 18 * scale };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const columns = Math.max(members.length, 1);
  const rowCount = Math.max(categories.length, 1);
  const maxCellSize = isZoomChart(context) ? 999 : 72;
  const cellSize = Math.max(22 * scale, Math.min(maxCellSize, Math.min(chartWidth / columns, chartHeight / rowCount)));
  const totalWidth = cellSize * columns;
  const totalHeight = cellSize * rowCount;
  const startX = padding.left + Math.max(0, (chartWidth - totalWidth) / 2);
  const startY = padding.top + Math.max(0, (chartHeight - totalHeight) / 2);
  const maxValue = Math.max(...cells.map(item => item.value), 1);

  cells.forEach((cell) => {
    const col = members.indexOf(cell.member);
    const row = categories.indexOf(cell.category);
    const x = startX + col * cellSize;
    const y = startY + row * cellSize;
    const intensity = Math.min(1, cell.value / maxValue);
    const lightness = 95 - intensity * 48;
    context.fillStyle = `hsl(14 52% ${lightness}%)`;
    context.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

    context.fillStyle = intensity > 0.52 ? '#fffaf2' : '#5f4a37';
    context.font = `800 ${10 * scale}px sans-serif`;
    context.textAlign = 'center';
    context.fillText(formatCompactMoney(cell.value), x + cellSize / 2, y + cellSize * 0.62);

    budgetChartHitRegions.push({ type: 'matrix_cell', category: cell.category, member: cell.member, value: cell.value, x, y, width: cellSize, height: cellSize });
  });
}

function drawWeekdayDistributionChart(context, rows, width, height) {
  const padding = { top: 24, right: 28, bottom: 42, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...rows.map(item => item.value), 1);
  const slotWidth = chartWidth / Math.max(rows.length, 1);
  const barWidth = Math.max(14, slotWidth * 0.52);

  rows.forEach((item, index) => {
    const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
    const barHeight = (item.value / maxValue) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    context.fillStyle = chartColors[index % chartColors.length];
    context.fillRect(x, y, barWidth, Math.max(3, barHeight));

    context.fillStyle = '#251b12';
    context.font = '800 10px sans-serif';
    context.textAlign = 'center';
    context.fillText(formatCompactMoney(item.value), x + barWidth / 2, Math.max(14, y - 6));

    context.fillStyle = '#7a6a5b';
    context.font = '800 11px sans-serif';
    context.fillText(item.label, x + barWidth / 2, height - 16);
    budgetChartHitRegions.push({ type: 'weekday', label: item.label, value: item.value, avg: item.avg, count: item.count, x, y, width: barWidth, height: Math.max(3, barHeight) });
  });
}

function bindCanvasHover(canvasSelector, tooltipSelector, regionGetter) {
  const canvas = $(canvasSelector);
  if (!canvas) return;
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const region = getChartRegionAt(event.clientX - rect.left, event.clientY - rect.top, regionGetter());
    canvas.classList.toggle('is-interactive', Boolean(region));
    if (region) moveChartTooltip(region, event.clientX, event.clientY, { canvasSelector, tooltipSelector });
    else hideChartTooltip({ canvasSelector, tooltipSelector });
  });
  canvas.addEventListener('mouseleave', () => hideChartTooltip({ canvasSelector, tooltipSelector }));
}

function bindChartInteractions() {
  if (chartInteractionsBound) return;
  bindCanvasHover('#expense-chart', '#chart-tooltip', () => chartHitRegions);
  bindCanvasHover('#budget-chart', '#budget-chart-tooltip', () => budgetChartHitRegions);
  bindCanvasHover('#chart-zoom-canvas', '#chart-zoom-tooltip', () => zoomChartHitRegions);
  chartInteractionsBound = true;
}

function renderExpenseChart() {
  const canvas = $('#expense-chart');
  const wrap = canvas?.closest('.chart-wrap');
  if (!canvas || !wrap) return;

  chartHitRegions = [];
  hideChartTooltip({ canvasSelector: '#expense-chart', tooltipSelector: '#chart-tooltip' });
  const chartType = getSelectedChartType();
  const trendData = chartType === 'category_trend' ? getCategoryCumulativeTrendData() : null;
  const rows = chartType === 'line'
    ? getExpenseTrendRows()
    : chartType === 'payer'
      ? groupExpensesByPayer()
      : chartType === 'balance'
        ? getBalanceChartRows()
        : chartType === 'currency'
          ? getCurrencyRows()
          : chartType === 'heatmap'
            ? getDailyHeatmapRows()
            : groupExpensesByCategory();
  const { context, width, height } = setupChartCanvas(canvas);
  const hasData = chartType === 'category_trend' ? Boolean(trendData?.series?.length) : rows.length > 0 && rows.some(item => item.value > 0);
  wrap.classList.toggle('is-empty', !hasData);

  if (!hasData) {
    renderChartLegend([], { legendSelector: '#chart-legend' });
    return;
  }

  if (chartType === 'bar') {
    drawBarChart(context, rows.slice(0, 8), width, height);
    renderChartLegend(rows.slice(0, 8), { legendSelector: '#chart-legend' });
    return;
  }
  if (chartType === 'line') {
    drawLineChart(context, rows, width, height);
    renderChartLegend(rows.slice(-6), { legendSelector: '#chart-legend' });
    return;
  }
  if (chartType === 'category_trend') {
    drawCategoryCumulativeLineChart(context, trendData, width, height);
    const legendRows = trendData.series.map(item => ({ label: item.label, value: item.value }));
    const colorByLabel = trendData.series.reduce((map, item) => ({ ...map, [item.label]: item.color }), {});
    renderChartLegend(legendRows, { legendSelector: '#chart-legend', colorByLabel });
    return;
  }
  if (chartType === 'currency') {
    drawPieChart(context, rows.slice(0, 8), width, height);
    const pieRows = rows.slice(0, 8);
    const total = pieRows.reduce((sum, item) => sum + item.value, 0);
    chartHitRegions = chartHitRegions.map((region, index) => {
      if (region.type !== 'pie') return region;
      const row = pieRows[index];
      return { ...region, type: 'currency', label: row.label, value: row.value, total, originalTotal: row.originalTotal, count: row.count, x: region.centerX, y: region.centerY, radius: region.radius };
    });
    renderChartLegend(pieRows, { legendSelector: '#chart-legend', currencyMode: true });
    return;
  }
  if (chartType === 'heatmap') {
    drawHeatmapChart(context, rows, width, height);
    renderChartLegend(rows.slice(-6), { legendSelector: '#chart-legend' });
    return;
  }

  if (chartType === 'payer') drawHorizontalBarChart(context, rows.slice(0, 8), width, height);
  else if (chartType === 'balance') drawHorizontalBarChart(context, rows.slice(0, 8), width, height, { balanceMode: true });
  else drawPieChart(context, rows.slice(0, 8), width, height);
  renderChartLegend(rows.slice(0, 8), { legendSelector: '#chart-legend' });
}

function renderBudgetChart() {
  const canvas = $('#budget-chart');
  const wrap = canvas?.closest('.chart-wrap');
  if (!canvas || !wrap) return;

  budgetChartHitRegions = [];
  hideChartTooltip({ canvasSelector: '#budget-chart', tooltipSelector: '#budget-chart-tooltip' });
  const chartType = getSelectedBudgetChartType();
  const { context, width, height } = setupChartCanvas(canvas);

  const budgetRows = getBudgetVsActualRows();
  const burnupRows = getBurnupRows();
  const memberTrend = getMemberNetTrendData();
  const matrixData = getCategoryMemberMatrixData();
  const weekdayRows = getWeekdayDistributionRows();

  const hasData = chartType === 'budget_actual'
    ? budgetRows.length > 0
    : chartType === 'burnup'
      ? burnupRows.length > 0
      : chartType === 'member_net_trend'
        ? memberTrend.series.length > 0
        : chartType === 'category_member_matrix'
          ? matrixData.cells.some(item => item.value > 0)
          : weekdayRows.some(item => item.value > 0);

  wrap.classList.toggle('is-empty', !hasData);
  if (!hasData) {
    renderChartLegend([], { legendSelector: '#budget-chart-legend' });
    return;
  }

  if (chartType === 'budget_actual') {
    drawBudgetCompareChart(context, budgetRows, width, height);
    renderChartLegend(budgetRows, { legendSelector: '#budget-chart-legend', budgetMode: true });
    return;
  }
  if (chartType === 'burnup') {
    drawBurnupChart(context, burnupRows, width, height);
    renderChartLegend([
      { label: '累積實際', value: burnupRows[burnupRows.length - 1]?.actual || 0 },
      { label: '累積推估預算', value: burnupRows[burnupRows.length - 1]?.budget || 0 }
    ], { legendSelector: '#budget-chart-legend', colorByLabel: { '累積實際': '#386fa4', '累積推估預算': '#9f8d74' } });
    return;
  }
  if (chartType === 'member_net_trend') {
    drawMemberNetTrendChart(context, memberTrend, width, height);
    const legendRows = memberTrend.series.map(item => ({ label: item.label, value: item.points[item.points.length - 1]?.value || 0 }));
    const colorByLabel = memberTrend.series.reduce((map, item) => ({ ...map, [item.label]: item.color }), {});
    renderChartLegend(legendRows, { legendSelector: '#budget-chart-legend', colorByLabel });
    return;
  }
  if (chartType === 'category_member_matrix') {
    drawCategoryMemberMatrixChart(context, matrixData, width, height);
    renderChartLegend(matrixData.categories.map((label, index) => ({ label, value: index + 1 })), { legendSelector: '#budget-chart-legend' });
    return;
  }

  drawWeekdayDistributionChart(context, weekdayRows, width, height);
  renderChartLegend(weekdayRows.filter(item => item.value > 0), { legendSelector: '#budget-chart-legend' });
}

function renderZoomChart() {
  const canvas = $('#chart-zoom-canvas');
  const wrap = canvas?.closest('.chart-wrap');
  if (!canvas || !wrap || !chartZoomMode) return;

  zoomChartHitRegions = [];
  hideChartTooltip({ canvasSelector: '#chart-zoom-canvas', tooltipSelector: '#chart-zoom-tooltip' });
  const { context, width, height } = setupChartCanvas(canvas);

  if (chartZoomMode === 'expense') {
    const chartType = getSelectedChartType();
    const trendData = chartType === 'category_trend' ? getCategoryCumulativeTrendData() : null;
    const rows = chartType === 'line'
      ? getExpenseTrendRows()
      : chartType === 'payer'
        ? groupExpensesByPayer()
        : chartType === 'balance'
          ? getBalanceChartRows()
          : chartType === 'currency'
            ? getCurrencyRows()
            : chartType === 'heatmap'
              ? getDailyHeatmapRows()
              : groupExpensesByCategory();

    const hasData = chartType === 'category_trend' ? Boolean(trendData?.series?.length) : rows.length > 0 && rows.some(item => item.value > 0);
    wrap.classList.toggle('is-empty', !hasData);
    if (!hasData) {
      renderChartLegend([], { legendSelector: '#chart-zoom-legend' });
      return;
    }

    if (chartType === 'bar') {
      drawBarChart(context, rows.slice(0, 8), width, height);
      renderChartLegend(rows.slice(0, 8), { legendSelector: '#chart-zoom-legend' });
      zoomChartHitRegions = [...chartHitRegions];
      return;
    }
    if (chartType === 'line') {
      drawLineChart(context, rows, width, height);
      renderChartLegend(rows.slice(-6), { legendSelector: '#chart-zoom-legend' });
      zoomChartHitRegions = [...chartHitRegions];
      return;
    }
    if (chartType === 'category_trend') {
      drawCategoryCumulativeLineChart(context, trendData, width, height);
      const legendRows = trendData.series.map(item => ({ label: item.label, value: item.value }));
      const colorByLabel = trendData.series.reduce((map, item) => ({ ...map, [item.label]: item.color }), {});
      renderChartLegend(legendRows, { legendSelector: '#chart-zoom-legend', colorByLabel });
      zoomChartHitRegions = [...chartHitRegions];
      return;
    }
    if (chartType === 'currency') {
      drawPieChart(context, rows.slice(0, 8), width, height);
      const pieRows = rows.slice(0, 8);
      const total = pieRows.reduce((sum, item) => sum + item.value, 0);
      chartHitRegions = chartHitRegions.map((region, index) => {
        if (region.type !== 'pie') return region;
        const row = pieRows[index];
        return { ...region, type: 'currency', label: row.label, value: row.value, total, originalTotal: row.originalTotal, count: row.count, x: region.centerX, y: region.centerY, radius: region.radius };
      });
      renderChartLegend(pieRows, { legendSelector: '#chart-zoom-legend', currencyMode: true });
      zoomChartHitRegions = [...chartHitRegions];
      return;
    }
    if (chartType === 'heatmap') {
      drawHeatmapChart(context, rows, width, height);
      renderChartLegend(rows.slice(-6), { legendSelector: '#chart-zoom-legend' });
      zoomChartHitRegions = [...chartHitRegions];
      return;
    }

    if (chartType === 'payer') drawHorizontalBarChart(context, rows.slice(0, 8), width, height);
    else if (chartType === 'balance') drawHorizontalBarChart(context, rows.slice(0, 8), width, height, { balanceMode: true });
    else drawPieChart(context, rows.slice(0, 8), width, height);
    renderChartLegend(rows.slice(0, 8), { legendSelector: '#chart-zoom-legend' });
    zoomChartHitRegions = [...chartHitRegions];
    return;
  }

  const chartType = getSelectedBudgetChartType();
  const budgetRows = getBudgetVsActualRows();
  const burnupRows = getBurnupRows();
  const memberTrend = getMemberNetTrendData();
  const matrixData = getCategoryMemberMatrixData();
  const weekdayRows = getWeekdayDistributionRows();

  const hasData = chartType === 'budget_actual'
    ? budgetRows.length > 0
    : chartType === 'burnup'
      ? burnupRows.length > 0
      : chartType === 'member_net_trend'
        ? memberTrend.series.length > 0
        : chartType === 'category_member_matrix'
          ? matrixData.cells.some(item => item.value > 0)
          : weekdayRows.some(item => item.value > 0);

  wrap.classList.toggle('is-empty', !hasData);
  if (!hasData) {
    renderChartLegend([], { legendSelector: '#chart-zoom-legend' });
    return;
  }

  if (chartType === 'budget_actual') {
    drawBudgetCompareChart(context, budgetRows, width, height);
    renderChartLegend(budgetRows, { legendSelector: '#chart-zoom-legend', budgetMode: true });
    zoomChartHitRegions = [...budgetChartHitRegions];
    return;
  }
  if (chartType === 'burnup') {
    drawBurnupChart(context, burnupRows, width, height);
    renderChartLegend([
      { label: '累積實際', value: burnupRows[burnupRows.length - 1]?.actual || 0 },
      { label: '累積推估預算', value: burnupRows[burnupRows.length - 1]?.budget || 0 }
    ], { legendSelector: '#chart-zoom-legend', colorByLabel: { '累積實際': '#386fa4', '累積推估預算': '#9f8d74' } });
    zoomChartHitRegions = [...budgetChartHitRegions];
    return;
  }
  if (chartType === 'member_net_trend') {
    drawMemberNetTrendChart(context, memberTrend, width, height);
    const legendRows = memberTrend.series.map(item => ({ label: item.label, value: item.points[item.points.length - 1]?.value || 0 }));
    const colorByLabel = memberTrend.series.reduce((map, item) => ({ ...map, [item.label]: item.color }), {});
    renderChartLegend(legendRows, { legendSelector: '#chart-zoom-legend', colorByLabel });
    zoomChartHitRegions = [...budgetChartHitRegions];
    return;
  }
  if (chartType === 'category_member_matrix') {
    drawCategoryMemberMatrixChart(context, matrixData, width, height);
    renderChartLegend(matrixData.categories.map((label, index) => ({ label, value: index + 1 })), { legendSelector: '#chart-zoom-legend' });
    zoomChartHitRegions = [...budgetChartHitRegions];
    return;
  }

  drawWeekdayDistributionChart(context, weekdayRows, width, height);
  renderChartLegend(weekdayRows.filter(item => item.value > 0), { legendSelector: '#chart-zoom-legend' });
  zoomChartHitRegions = [...budgetChartHitRegions];
}

function openChartZoomModal(mode) {
  const modal = $('#chart-zoom-modal');
  if (!modal) return;
  chartZoomMode = mode === 'budget' ? 'budget' : 'expense';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderZoomChart();
}

function closeChartZoomModal() {
  const modal = $('#chart-zoom-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  chartZoomMode = null;
  zoomChartHitRegions = [];
  hideChartTooltip({ canvasSelector: '#chart-zoom-canvas', tooltipSelector: '#chart-zoom-tooltip' });
  if (!$('#receipt-modal')?.classList.contains('show')) document.body.style.overflow = '';
}
