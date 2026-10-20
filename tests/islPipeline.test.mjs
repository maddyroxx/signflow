import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPPORTED_TOKENS,
  SUPPORTED_TOKEN_SET,
  isFingerspellToken,
  isPlayableToken,
  sanitizeTokens,
  looksPreTranslated,
} from '../lib/islVocabulary.ts'
import { textToGloss, lemmatizeWord } from '../components/avatar/textToGloss.js'
import * as wordAnimations from '../components/avatar/animations/words.js'
import * as alphabetAnimations from '../components/avatar/animations/alphabets.js'

test('Vocabulary: SUPPORTED_TOKENS integrity and size', () => {
  assert.ok(SUPPORTED_TOKENS.length >= 100, `Expected at least 100 tokens, got ${SUPPORTED_TOKENS.length}`)
  assert.equal(SUPPORTED_TOKEN_SET.size, SUPPORTED_TOKENS.length, 'No duplicate tokens in SUPPORTED_TOKENS')
  assert.ok(SUPPORTED_TOKEN_SET.has('HELLO'))
  assert.ok(SUPPORTED_TOKEN_SET.has('THANK_YOU'))
  assert.ok(SUPPORTED_TOKEN_SET.has('WATER'))
  assert.ok(SUPPORTED_TOKEN_SET.has('HOSPITAL'))
})

test('Vocabulary: isFingerspellToken', () => {
  assert.equal(isFingerspellToken('A'), true)
  assert.equal(isFingerspellToken('Z'), true)
  assert.equal(isFingerspellToken('M'), true)
  assert.equal(isFingerspellToken('HELLO'), false)
  assert.equal(isFingerspellToken('a'), false)
  assert.equal(isFingerspellToken('1'), false)
  assert.equal(isFingerspellToken(''), false)
})

test('Vocabulary: isPlayableToken', () => {
  assert.equal(isPlayableToken('HELLO'), true)
  assert.equal(isPlayableToken('A'), true)
  assert.equal(isPlayableToken('THANK_YOU'), true)
  assert.equal(isPlayableToken('RANDOMUNKNOWNWORD'), false)
})

test('Vocabulary: sanitizeTokens expands unknown words into fingerspelling', () => {
  const result = sanitizeTokens(['HELLO', 'Amit', 'WATER'])
  assert.deepEqual(result, ['HELLO', 'A', 'M', 'I', 'T', 'WATER'])
})

test('Vocabulary: sanitizeTokens handles dirty input, punctuation, and nulls safely', () => {
  assert.deepEqual(sanitizeTokens(null), [])
  assert.deepEqual(sanitizeTokens(undefined), [])
  assert.deepEqual(sanitizeTokens(['']), [])
  assert.deepEqual(sanitizeTokens(['hello!']), ['HELLO'])
  assert.deepEqual(sanitizeTokens(['THANK-YOU']), ['THANK_YOU'])
})

test('Vocabulary: looksPreTranslated', () => {
  assert.equal(looksPreTranslated('HELLO YOU HOW'), true)
  assert.equal(looksPreTranslated('THANK_YOU A B C'), true)
  assert.equal(looksPreTranslated('How are you doing today?'), false)
})

test('NLP: lemmatizeWord handles plurals and verb inflections', () => {
  assert.equal(lemmatizeWord('books'), 'book')
  assert.equal(lemmatizeWord('children'), 'child')
  assert.equal(lemmatizeWord('eating'), 'eat')
  assert.equal(lemmatizeWord('went'), 'go')
  assert.equal(lemmatizeWord('saw'), 'see')
  assert.equal(lemmatizeWord('drank'), 'drink')
})

test('NLP: textToGloss maps common phrases and idioms to correct ISL gloss', () => {
  const res1 = textToGloss('How are you?')
  assert.ok(res1.tokens.includes('YOU'))
  assert.ok(res1.tokens.includes('HOW'))

  const res2 = textToGloss('Thank you very much')
  assert.ok(res2.tokens.includes('THANK_YOU'))

  const res3 = textToGloss('Where is the hospital?')
  assert.deepEqual(res3.tokens, ['HOSPITAL', 'WHERE'])

  const res4 = textToGloss('I do not know')
  assert.ok(res4.tokens.includes('I'))
  assert.ok(res4.tokens.includes('KNOW'))
  assert.ok(res4.tokens.includes('NOT') || res4.tokens.includes('NO'))
})

test('NLP: textToGloss SOV question ordering places WH words last', () => {
  const res = textToGloss('Where are you going?')
  assert.deepEqual(res.tokens[res.tokens.length - 1], 'WHERE')
})

test('Animation Mapping: All 26 letters (A-Z) have exported animation functions', () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  for (const letter of letters) {
    assert.equal(
      typeof alphabetAnimations[letter],
      'function',
      `Missing animation function for alphabet letter ${letter}`,
    )
  }
})

test('Animation Mapping: Supported tokens resolve to valid animations or fingerspelling', () => {
  let mappedWordCount = 0
  for (const token of SUPPORTED_TOKENS) {
    if (typeof wordAnimations[token] === 'function') {
      mappedWordCount++
    }
  }
  assert.ok(
    mappedWordCount >= 100,
    `Expected at least 100 tokens to have dedicated word animations, found ${mappedWordCount}`,
  )
})
