#!/usr/bin/env node
/**
 * 성경 통독표 생성기
 *
 * 설계 원칙
 *  1. 하루 분량은 "장 수"가 아니라 "절 수"를 기준으로 균등하게 맞춘다.
 *     (창세기 한 장과 시편 한 장의 분량이 3배 넘게 차이나기 때문)
 *  2. 하루 분량은 절대 두 권에 걸치지 않는다. 한 권을 끝내고 다음 권으로 넘어간다.
 *  3. 하루 최대 장 수에 상한을 둔다. 숫자만 보고 지레 포기하지 않도록.
 *  4. 날짜는 여기서 박지 않는다. 순번(1일차, 2일차...)만 만들고
 *     실제 달력 매핑은 src/schedule.js 가 런타임에 계산한다.
 *
 * 사용법: npm run plan
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, TOTAL_CHAPTERS, TOTAL_VERSES } from '../src/bible.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 하루에 읽을 목표 절 수. 낮출수록 분량이 줄고 통독 기간이 길어진다. */
const TARGET_VERSES_PER_DAY = 150;
/** 하루 최대 장 수 상한. 숫자가 커 보이면 지레 포기하게 된다. */
const MAX_CHAPTERS_PER_DAY = 7;
/** 하루 최대 절 수 상한. 장 수가 적어도 분량이 튀는 날을 막는다. */
const MAX_VERSES_PER_DAY = 175;

/** 장 1..total 을 d 개의 연속 구간으로 최대한 고르게 자른다. */
function splitChapters(total, d) {
  const base = Math.floor(total / d);
  const remainder = total % d;
  const ranges = [];
  let cursor = 1;
  for (let i = 0; i < d; i++) {
    const size = base + (i < remainder ? 1 : 0);
    ranges.push([cursor, cursor + size - 1]);
    cursor += size;
  }
  return ranges;
}

/**
 * 한 권을 며칠에 나눠 읽을지 결정한다.
 * 목표 절 수로 출발한 뒤, 가장 긴 하루가 상한을 넘지 않을 때까지 날을 늘린다.
 * 상한은 평균이 아니라 "제일 긴 날"에 걸어야 의미가 있다 — 장을 고르게 잘라도
 * 나머지 때문에 한두 날은 한 장씩 더 가져가기 때문이다.
 */
function daysForBook(book) {
  const versesPerChapter = book.verses / book.chapters;
  let days = Math.max(1, Math.round(book.verses / TARGET_VERSES_PER_DAY));
  while (days < book.chapters) {
    const longest = Math.ceil(book.chapters / days);
    if (longest <= MAX_CHAPTERS_PER_DAY && longest * versesPerChapter <= MAX_VERSES_PER_DAY) break;
    days++;
  }
  return Math.min(days, book.chapters);
}

const days = [];
for (const book of BOOKS) {
  const d = daysForBook(book);
  const versesPerChapter = book.verses / book.chapters;
  for (const [start, end] of splitChapters(book.chapters, d)) {
    const chapterCount = end - start + 1;
    days.push({
      n: days.length + 1,
      book: book.name,
      testament: book.testament,
      start,
      end,
      chapterCount,
      label: start === end ? `${book.name} ${start}장` : `${book.name} ${start}-${end}장`,
      // 표시용 추정 절 수 (책 평균 × 장 수)
      verses: Math.round(versesPerChapter * chapterCount),
    });
  }
}

const plan = {
  generatedAt: new Date().toISOString().slice(0, 10),
  targetVersesPerDay: TARGET_VERSES_PER_DAY,
  maxChaptersPerDay: MAX_CHAPTERS_PER_DAY,
  maxVersesPerDay: MAX_VERSES_PER_DAY,
  totalDays: days.length,
  totalChapters: TOTAL_CHAPTERS,
  totalVerses: TOTAL_VERSES,
  days,
};

const outPath = resolve(__dirname, '../public/reading_plan.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(plan, null, 2) + '\n');

// ── 요약 출력 ────────────────────────────────────────────
const chapterCounts = days.map((d) => d.chapterCount);
const verseCounts = days.map((d) => d.verses);
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`생성 완료 → ${outPath}`);
console.log(`  총 ${plan.totalDays}일 / ${TOTAL_CHAPTERS}장 / ${TOTAL_VERSES}절`);
console.log(`  하루 장 수  : ${Math.min(...chapterCounts)}~${Math.max(...chapterCounts)}장 (평균 ${avg(chapterCounts).toFixed(1)}장)`);
console.log(`  하루 절 수  : ${Math.min(...verseCounts)}~${Math.max(...verseCounts)}절 (평균 ${avg(verseCounts).toFixed(0)}절)`);
