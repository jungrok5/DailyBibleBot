#!/usr/bin/env node
/**
 * 성경 통독표 생성기
 *
 * 설계 원칙
 *  1. 하루 3장. 분량을 낮게 고정해서 매일 부담 없이 읽는 것이 목적이다.
 *     1년을 넘기더라도 꾸준히 읽히는 쪽을 택했다.
 *  2. 하루 분량은 절대 두 권에 걸치지 않는다. 한 권을 끝내고 다음 권으로 넘어간다.
 *     그래서 책마다 마지막 날은 1~2장이 될 수 있다.
 *  3. 한 권 안에서는 장을 고르게 나눈다. 4장짜리 룻기는 (3,1)이 아니라 (2,2)로 읽는다.
 *  4. 날짜를 쓰지 않는다. 순번(1일차, 2일차...)만 만든다.
 *     날짜를 박아두면 하루 못 보낸 날부터 전부 어긋나 버린다.
 *     진도는 공유 버튼을 눌렀는지로만 나간다.
 *
 * 사용법: npm run plan
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, TOTAL_CHAPTERS, TOTAL_VERSES } from '../src/bible.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 하루에 읽을 장 수. 이 값만 바꾸면 통독표 전체가 다시 짜인다. */
const CHAPTERS_PER_DAY = 3;

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

const days = [];
for (const book of BOOKS) {
  const bookDays = Math.ceil(book.chapters / CHAPTERS_PER_DAY);
  const versesPerChapter = book.verses / book.chapters;
  for (const [start, end] of splitChapters(book.chapters, bookDays)) {
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
  chaptersPerDay: CHAPTERS_PER_DAY,
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
const histogram = {};
for (const c of chapterCounts) histogram[c] = (histogram[c] ?? 0) + 1;

console.log(`생성 완료 → ${outPath}`);
console.log(`  총 ${plan.totalDays}일 / ${TOTAL_CHAPTERS}장 / ${TOTAL_VERSES}절`);
console.log(`  하루 장 수  : ${Math.min(...chapterCounts)}~${Math.max(...chapterCounts)}장 (평균 ${avg(chapterCounts).toFixed(1)}장)`);
console.log(`  하루 절 수  : ${Math.min(...verseCounts)}~${Math.max(...verseCounts)}절 (평균 ${avg(verseCounts).toFixed(0)}절)`);
console.log(`  장 수 분포  : ${Object.entries(histogram).map(([k, v]) => `${k}장 ${v}일`).join(' / ')}`);
