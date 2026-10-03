import test from 'node:test';
import assert from 'node:assert/strict';
import { reactToChoice, validateChoice } from './reaction.js';

const history = [{ offered_item: 'banana', dialogue: 'Peeling is right! But I want something juicier.' }];
test('model compares foods using facts and remembers actual replies', async () => {
    const providers = {
        ai: { models: { generateContent: async request => {
            const input = JSON.parse(request.contents);
            assert.equal(input.target.id, 'orange');
            assert.equal(input.offered_item.id, 'strawberry_cake');
            assert.deepEqual(input.history, history);
            assert.ok(input.target.facts.length);
            assert.equal(input.inventory.length, 12);
            assert.ok(input.allowed_differences.includes('thick peel removed before eating'));
            return { text: JSON.stringify({ fact: 'thick peel removed before eating', dialogue: "Mum! You can't peel cake!", emotion: 'annoyed', clue: null }) };
        } } },
        elevenlabs: { textToSpeech: { convert: async () => { throw Error('offline'); } } },
    };
    const result = await reactToChoice({ target: 'orange', offered_item: 'strawberry_cake', history }, providers);
    assert.equal(result.dialogue, "Mum! You can't peel cake!");
    assert.equal(result.clue, null);
    assert.equal(result.success, false);
    assert.ok(!('clue_level' in result));
});

test('history validates item IDs and bounds dialogue instead of accepting arbitrary objects', () => {
    for (const entry of ['banana', {}, { offered_item: 'unknown', dialogue: 'Hi' },
        { offered_item: 'banana', dialogue: 'x'.repeat(161) }]) {
        assert.throws(() => validateChoice({ target: 'orange', offered_item: 'apple', history: [entry] }), { status: 400 });
    }
    assert.deepEqual(validateChoice({ target: 'orange', offered_item: 'apple', history }).history, history);
});

test('shared properties cannot be selected as a difference', async () => {
    const result = await reactToChoice({ target: 'orange', offered_item: 'apple' }, {
        ai: { models: { generateContent: async request => {
            const input = JSON.parse(request.contents);
            assert.ok(input.shared_facts.includes('round'));
            assert.ok(!input.allowed_differences.includes('round'));
            return { text: JSON.stringify({ fact: 'round', dialogue: 'I want something round!', emotion: 'hopeful', clue: 'Round' }) };
        } } },
        elevenlabs: { textToSpeech: { convert: async () => { throw Error('offline'); } } },
    });
    assert.doesNotMatch(result.dialogue, /round/);
    assert.equal(result.clue, null);
});
