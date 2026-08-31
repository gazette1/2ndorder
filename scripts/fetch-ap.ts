import fs from 'node:fs';
import { fetchArticleText } from '../src/lib/article.js';
const a = await fetchArticleText('https://apnews.com/article/trump-tariffs-canada-us-trade-war-293908564c7a381ea58a61db6e9a8517');
console.log('TITLE:', a.title);
console.log('CHARS:', a.text.length);
fs.writeFileSync('/tmp/ap-article.txt', a.text);
