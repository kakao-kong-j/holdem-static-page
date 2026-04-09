import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/gto-preflop-charts-all.json');
const raw = readFileSync(filePath, 'utf8');
const lines = raw.split('\n');

interface HandEntry {
  action: string;
  line: number;
}

const handMap = new Map<string, HandEntry[]>();

let currentStack = '';
let currentChart = '';
let currentAction = '';
let inArray = false;

for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trimStart();
  const indent = lines[i].length - trimmed.length;

  // 스택 (indent 4)
  const stackMatch = indent === 4 && trimmed.match(/^"(15BB|25BB|40BB|100BB)"\s*:/);
  if (stackMatch) {
    currentStack = stackMatch[1];
    currentChart = '';
    currentAction = '';
    inArray = false;
    continue;
  }

  // 차트 (indent 6)
  if (indent === 6 && trimmed.match(/^"[^"]+"\s*:\s*\{/)) {
    currentChart = trimmed.match(/^"([^"]+)"/)![1];
    currentAction = '';
    inArray = false;
    continue;
  }

  // 액션 배열 시작 (indent 8)
  if (indent === 8 && trimmed.match(/^"[^"]+"\s*:\s*\[/)) {
    currentAction = trimmed.match(/^"([^"]+)"/)![1];
    inArray = true;
    continue;
  }

  // 배열 닫기 (indent 8)
  if (indent === 8 && trimmed.match(/^\][,]?$/)) {
    inArray = false;
    continue;
  }

  // 핸드 (배열 안)
  if (inArray && currentStack && currentChart && currentAction) {
    const handMatch = trimmed.match(/^"([2-9TJQKA]{2}[so]?)"[,]?$/);
    if (handMatch) {
      const hand = handMatch[1];
      const key = `${currentStack}|${currentChart}|${hand}`;
      if (!handMap.has(key)) handMap.set(key, []);
      handMap.get(key)!.push({ action: currentAction, line: i + 1 });
    }
  }
}

let found = 0;

for (const [key, entries] of handMap) {
  if (entries.length > 1) {
    const [stack, chart, hand] = key.split('|');
    const detail = entries.map(e => `${e.action}(L${e.line})`).join(', ');
    console.log(`[${stack}] ${chart}: ${hand} → ${detail}`);
    found++;
  }
}

if (found === 0) {
  console.log('중복 없음');
} else {
  console.log(`\n총 ${found}건의 중복 발견`);
}
