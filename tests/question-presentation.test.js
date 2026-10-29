'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../public/question-presentation');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog');
const decode=s=>s.replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
test('presentation preserves every reviewed question verbatim for grading and summary lookup',()=>{
 for(const q of loadReviewedCatalog().questions)assert.equal(decode(ui.markup(q)),q.q,q.id);
});
test('reading layout never interprets source text as markup or splits comparative questions',()=>{
 const q='【閱讀材料】「木直中繩，輮以為輪。」\n\n問題：「之」指甚麼？';
 assert.equal(ui.parts(q).reading,'【閱讀材料】「木直中繩，輮以為輪。」');
 assert.match(ui.markup(q),/question-target/);
 assert.equal(ui.parts('「且舉世譽之而不加勸」與「何陋之有」的「之」用法相同嗎？').reading,'');
 const malicious='【閱讀材料】<img src=x onerror=alert(1)>\n\n問題：「<b>」';
 assert.doesNotMatch(ui.markup(malicious),/<img|<b>/);
 assert.equal(decode(ui.markup(malicious)),malicious);
});
