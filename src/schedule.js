/**
 * 순번(1일차, 2일차...)을 실제 달력 날짜로 매핑한다.
 *
 * 통독표 자체에는 날짜가 박혀 있지 않다. 진도는 "공유 버튼을 눌렀는지"로 나가고,
 * 날짜는 어디까지 왔는지 가늠하기 위한 안내용이다. 그래서 아래 휴일 표가
 * 조금 틀려도 통독표가 깨지지 않는다 — 예상 날짜만 며칠 밀릴 뿐이다.
 */

/** 통독 시작일 (YYYY-MM-DD). 이 날짜가 1일차가 된다. */
export const START_DATE = '2026-10-05';

/**
 * 설날·추석 당일 (음력이라 매년 달라 직접 넣어야 한다).
 * 연휴는 당일 기준 앞뒤 1일씩 총 3일을 쉬는 것으로 계산한다.
 * ⚠️ 해가 바뀌면 실제 공휴일 공고를 확인하고 수정할 것.
 */
export const SEOLLAL = {
  2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13',
  2030: '2030-02-03', 2031: '2031-01-23', 2032: '2032-02-11',
};
export const CHUSEOK = {
  2026: '2026-09-25', 2027: '2027-09-15', 2028: '2028-10-03', 2029: '2029-09-22',
  2030: '2030-09-12', 2031: '2031-10-01', 2032: '2032-09-19',
};

const DAY_MS = 86400000;

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (d, n) => new Date(d.getTime() + n * DAY_MS);

/** 서방 교회 부활절 (Anonymous Gregorian algorithm). */
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** 해당 연도의 쉬는 날(주말 제외)을 Set<YYYY-MM-DD> 으로 만든다. */
function restDaysOf(year) {
  const rest = new Set();
  // 고난주간: 부활절 직전 월요일 ~ 토요일
  const easter = easterSunday(year);
  for (let i = 1; i <= 6; i++) rest.add(toKey(shift(easter, -i)));
  // 설·추석 연휴 3일
  for (const table of [SEOLLAL, CHUSEOK]) {
    const key = table[year];
    if (!key) continue;
    const base = fromKey(key);
    for (let i = -1; i <= 1; i++) rest.add(toKey(shift(base, i)));
  }
  return rest;
}

const restCache = new Map();
function isRestDay(date) {
  if (date.getDay() === 0 || date.getDay() === 6) return true; // 주말
  const year = date.getFullYear();
  if (!restCache.has(year)) restCache.set(year, restDaysOf(year));
  return restCache.get(year).has(toKey(date));
}

/**
 * 시작일부터 읽는 날만 세어 count 개의 날짜를 돌려준다.
 * 시작일이 쉬는 날이면 그 다음 읽는 날부터 시작한다.
 */
export function readingDates(count, startDate = START_DATE) {
  const dates = [];
  let cursor = fromKey(startDate);
  let guard = 0;
  while (dates.length < count && guard++ < count * 4 + 400) {
    if (!isRestDay(cursor)) dates.push(toKey(cursor));
    cursor = shift(cursor, 1);
  }
  return dates;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-10-05' → '10월 5일 (월)' */
export function formatDate(key) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

/** 오늘 날짜 키 */
export const todayKey = () => toKey(new Date());
