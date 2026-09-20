import './style.css';

const KAKAO_JS_KEY = '95037b4ee26afd14af6732f642c0c9d0';
const STORAGE_KEY = 'biblebot.shared.v1';
const SITE_URL = window.location.origin;

const el = (id) => document.getElementById(id);
const grid = el('day-grid');
const modal = el('detail-modal');
const toastEl = el('toast');

let plan = null;      // reading_plan.json
let shared = new Set();
let openDay = null;   // 모달에 띄운 일차

/* ── 공유 기록 (localStorage) ─────────────────────────
   통독표에는 날짜가 없다. 진도는 오직 "공유 버튼을 눌렀는지"로만 나간다.
   그래서 며칠을 건너뛰든 일정이 밀리는 개념 자체가 없다.

   시크릿 모드나 저장소 차단 환경에서는 읽기/쓰기가 던질 수 있다.
   그래도 통독표 자체는 보여야 하므로 전부 감싼다. */
function loadShared() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveShared() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...shared].sort((a, b) => a - b)));
  } catch {
    toast('이 브라우저에서는 공유 기록이 저장되지 않아요');
  }
}

/* ── 유틸 ─────────────────────────────────────────── */
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/** 아직 공유하지 않은 첫 번째 일차. 전부 마쳤으면 null. */
function nextUnshared() {
  return plan.days.find((d) => !shared.has(d.n)) ?? null;
}

function shareText(day) {
  return `📖 성경통독 ${day.n}일차\n${day.label}\n\n오늘도 함께 읽어요 🙏`;
}

/* ── 렌더링 ───────────────────────────────────────── */
function renderProgress() {
  const done = shared.size;
  const total = plan.totalDays;
  el('progress-count').textContent = `${done} / ${total}`;
  el('progress-fill').style.width = `${(done / total) * 100}%`;

  let detail;
  if (done === 0) detail = '아직 시작 전이에요';
  else if (done >= total) detail = '통독 완주! 🎉';
  else detail = `${((done / total) * 100).toFixed(1)}% · ${total - done}일 남음`;
  el('progress-detail').textContent = detail;
}

function renderNextPanel() {
  const panel = el('next-panel');
  const day = nextUnshared();

  if (!day) {
    panel.innerHTML = `
      <div class="next-card all-done">
        <div>
          <h2>🎉 통독을 모두 공유했어요</h2>
          <p class="sub">${plan.totalDays}일 / ${plan.totalChapters}장 완주</p>
        </div>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="next-card">
      <div>
        <span class="eyebrow">다음 공유할 분량</span>
        <h2>${day.label}</h2>
        <p class="sub">${day.n}일차 · ${day.chapterCount}장 · 약 ${day.verses}절</p>
      </div>
      <button class="primary-btn kakao-btn" data-share="${day.n}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C6.477 3 2 6.582 2 11c0 2.872 1.83 5.394 4.61 6.837-.215.798-1.07 3.518-1.096 3.633-.035.156.126.168.204.114.103-.07 3.328-2.296 4.708-3.262.51.074 1.036.113 1.574.113 5.523 0 10-3.582 10-8s-4.477-8-10-8z" fill="#000000"/>
        </svg>
        카카오톡으로 공유하기
      </button>
    </div>`;
}

function renderGrid() {
  const hideShared = el('hide-shared').checked;
  const next = nextUnshared();
  const parts = [];
  let lastBook = null;

  for (const day of plan.days) {
    const isShared = shared.has(day.n);
    if (hideShared && isShared) continue;

    if (day.book !== lastBook) {
      parts.push(`<div class="new-book-divider">${day.book}</div>`);
      lastBook = day.book;
    }

    const isNext = next !== null && day.n === next.n;
    const classes = ['day-card'];
    if (isShared) classes.push('shared');
    if (isNext) classes.push('next');

    parts.push(`
      <button class="${classes.join(' ')}" data-day="${day.n}" ${isNext ? 'id="next-card-anchor"' : ''}>
        ${isShared ? '<span class="shared-badge">공유함</span>' : ''}
        <span class="day-no">${day.n}일차</span>
        <h3>${day.label}</h3>
        <span class="meta">약 ${day.verses}절</span>
      </button>`);
  }

  grid.innerHTML = parts.join('');
}

function render() {
  renderProgress();
  renderNextPanel();
  renderGrid();
}

/* ── 공유 ─────────────────────────────────────────── */
function markShared(n, value = true) {
  if (value) shared.add(n);
  else shared.delete(n);
  saveShared();
  render();
  if (openDay === n) updateModal(n);
}

function share(n) {
  const day = plan.days.find((d) => d.n === n);
  if (!day) return;
  const text = shareText(day);

  // 카카오 SDK 가 차단됐거나 못 불러온 경우에도 공유 자체는 되도록 클립보드로 넘긴다.
  if (!window.Kakao?.isInitialized?.()) {
    navigator.clipboard?.writeText(`${text}\n${SITE_URL}`)
      .then(() => toast('카카오톡을 못 불러와 내용을 복사했어요'))
      .catch(() => toast('카카오톡을 불러오지 못했어요'));
    markShared(n);
    return;
  }

  try {
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text,
      link: { mobileWebUrl: SITE_URL, webUrl: SITE_URL },
      buttonTitle: '통독표 보기',
    });
    // 카카오는 공유 완료 여부를 돌려주지 않는다. 버튼을 누른 것을 공유로 본다.
    markShared(n);
    toast(`${day.n}일차 공유 완료로 표시했어요`);
  } catch (err) {
    console.error(err);
    toast('공유에 실패했어요');
  }
}

/* ── 모달 ─────────────────────────────────────────── */
function updateModal(n) {
  const day = plan.days.find((d) => d.n === n);
  if (!day) return;
  const isShared = shared.has(n);
  el('detail-day').textContent = `${day.n}일차`;
  el('detail-title').textContent = day.label;
  el('detail-amount').textContent = `${day.chapterCount}장 · 약 ${day.verses}절`;
  el('detail-status').textContent = isShared ? '✅ 공유함' : '아직 공유 전';
  el('toggle-share-btn').textContent = isShared ? '공유 안 함으로 되돌리기' : '공유 완료로 표시';
}

function openModal(n) {
  openDay = n;
  updateModal(n);
  modal.classList.remove('hidden');
}

function closeModal() {
  openDay = null;
  modal.classList.add('hidden');
}

/* ── 이벤트 ───────────────────────────────────────── */
function bindEvents() {
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-day]');
    if (card) openModal(Number(card.dataset.day));
  });

  el('next-panel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-share]');
    if (btn) share(Number(btn.dataset.share));
  });

  el('kakao-share-btn').addEventListener('click', () => {
    if (openDay !== null) share(openDay);
  });

  el('toggle-share-btn').addEventListener('click', () => {
    if (openDay !== null) markShared(openDay, !shared.has(openDay));
  });

  el('close-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  el('hide-shared').addEventListener('change', renderGrid);

  el('reset-shared').addEventListener('click', () => {
    if (!shared.size) return toast('아직 공유한 기록이 없어요');
    if (!confirm(`공유 기록 ${shared.size}건을 모두 지울까요?`)) return;
    shared = new Set();
    saveShared();
    render();
    toast('공유 기록을 초기화했어요');
  });
}

/* ── 시작 ─────────────────────────────────────────── */
async function init() {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    try { window.Kakao.init(KAKAO_JS_KEY); } catch (err) { console.error(err); }
  }

  try {
    const res = await fetch('/reading_plan.json');
    if (!res.ok) throw new Error(`통독표를 불러오지 못했습니다 (${res.status})`);
    plan = await res.json();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="new-book-divider">통독표를 불러오지 못했어요. 새로고침해 주세요.</p>';
    return;
  }

  shared = loadShared();
  bindEvents();
  render();

  // 며칠 쉬었다 들어와도 이어서 볼 수 있도록 다음 분량으로 스크롤한다.
  // 아직 아무것도 공유하지 않았으면 맨 위가 곧 다음 분량이라 그대로 둔다.
  if (shared.size > 0) el('next-card-anchor')?.scrollIntoView({ block: 'center' });
}

init();
