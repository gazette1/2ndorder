import fs from 'node:fs';
import { detectGaps } from '../src/schema/v2.js';
const c = JSON.parse(fs.readFileSync('data/runs/day1-acceptance/trigger-contract.json', 'utf8'));
const art = fs.readFileSync('data/runs/day1-acceptance/article.txt', 'utf8');
const gaps = detectGaps(c, art);
fs.writeFileSync('data/runs/day1-acceptance/gaps.json', JSON.stringify(gaps, null, 2));
console.log('gaps saved:', gaps.length);
