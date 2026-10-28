'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { extractPage, toSourcePaper, decodeText, sectionRanges, answerIndex, durationSeconds } = require('../lib/oliveboard-extract');

test('explicit decoder preserves long plain and ordinary base64 content', () => {
  const text = 'This is a long ordinary base64 question with enough characters to exceed sixty four encoded bytes.';
  const encoded = Buffer.from(text).toString('base64');
  assert.equal(decodeText(text), text);
  assert.equal(decodeText(encoded), encoded);
  assert.equal(decodeText(encoded, 'base64'), text);
  assert.equal(decodeText(encoded, 'oliveboard-salted'), null);
});

test('salted HTML and unicode use declared n.js encoding only', () => {
  const html = '<p>प्रश्न & answer</p>';
  const raw = 'x'.repeat(32) + Buffer.from(escape(html)).toString('base64') + 'y'.repeat(32);
  assert.equal(decodeText(raw, 'oliveboard-salted'), html);
  assert.equal(decodeText('invalid!!', 'base64'), null);
});

test('per-section counts are converted to ranges without merging 75 questions into the last section', () => {
  const ranges = sectionRanges(['English', 'Reasoning', 'Quantitative', 'Professional'], [25,25,25,25], 100);
  assert.deepEqual(ranges.map(s => [s.start,s.end]), [[0,25],[25,50],[50,75],[75,100]]);
  assert.deepEqual(sectionRanges(['A','B'],[25,25],100), []);
  assert.deepEqual(sectionRanges(['A','B'],[0,25,50],50,'boundaries').map(s => s.expectedQuestions), [25,25]);
});

test('unknown answers and numeric bases remain unknown', () => {
  assert.equal(answerIndex(undefined,5), null);
  assert.equal(answerIndex('2',5), null);
  assert.equal(answerIndex('0',5,0), 0);
  assert.equal(answerIndex('2',5,1), 1);
  assert.equal(answerIndex('E',4), null);
  assert.equal(durationSeconds('20 Minutes'),1200);
  assert.equal(durationSeconds('1200'),null);
});

const valid = () => ({ url:'https://u1.oliveboard.in/tests/part.php?c=sample&testid=1', evidenceId:'actual-tool-id', metadata:{courseId:'sample',testId:'1',title:'Source exam 1',examId:'source-exam',examName:'Source exam',type:'mains',expectedQuestions:1,hasSectionalTiming:true,sections:[{id:'knowledge',title:'Knowledge',durationSeconds:1800,marksForCorrect:2,negativeMarks:0.5,expectedQuestions:1}]}, questions:[{qid:'source-987',questionNumber:1,sectionId:'knowledge',section:'Knowledge',questionHTML:'<p>Question?</p>',options:[{letter:'A',html:'One'},{letter:'B',html:'Two'}],correctIndex:1,correctAnswer:'B',explanationHTML:''}] });

test('complete captures retain source marks and stable identity', () => {
  const a = toSourcePaper(valid()); const changed = valid(); changed.url += '&from=solution';
  assert.equal(a.complete,true);
  assert.equal(a.paper.id,toSourcePaper(changed).paper.id);
  assert.equal(a.paper.sections[0].marksForCorrect,2);
  assert.equal(a.paper.sections[0].questions[0].qid,'source-987');
});

test('partial count, unknown metadata, duplicate question and stale index prevent publication', () => {
  for (const mutate of [c => c.metadata.expectedQuestions=2, c => delete c.metadata.examName, c => c.questions[0].correctIndex=null, c => c.questions[0].correctAnswer='A', c => {c.questions.push({...c.questions[0]});c.metadata.expectedQuestions=2;}]) {
    const c = valid();mutate(c);assert.equal(toSourcePaper(c).complete,false);assert.equal(toSourcePaper(c).paper,null);
  }
});

test('browser function is self-contained when serialized', () => {
  const helpers = vm.runInNewContext(`(${extractPage.toString()})({helpersOnly:true})`, {atob,TextDecoder,Uint8Array,unescape});
  assert.equal(helpers.answerIndex('A',2),0);
  assert.equal(helpers.decodeText('Already plain'),'Already plain');
});
