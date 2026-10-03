import test from 'node:test';
import assert from 'node:assert/strict';
import { reactToChoice } from './reaction.js';

const providers = {
    ai: { models: { generateContent: async request => {
        assert.deepEqual(JSON.parse(request.contents), { success: false });
        return { text: JSON.stringify({ dialogue: 'Not that one, Mum!', emotion: 'annoyed' }) };
    } } },
    elevenlabs: { textToSpeech: { convert: async () => { throw Error('offline'); } } },
};
test('clues advance every two distinct wrong offers, never from repeated guesses', async () => {
    const guesses = ['bread', 'baguette', 'croissant', 'pretzel', 'chocolate', 'strawberry_cake', 'red_velvet'];
    const history = [];
    for (const [index, offered_item] of guesses.entries()) {
        const result = await reactToChoice({ target: 'orange', offered_item, history }, providers);
        assert.equal(result.clue_level, Math.min(4, Math.floor(index / 2) + 1));
        assert.ok(result.dialogue.endsWith(result.clue));
        history.push(offered_item);
    }
    const repeated = await reactToChoice({ target: 'orange', offered_item: 'apple', history: ['apple', 'apple'] }, providers);
    assert.equal(repeated.clue_level, 1);
});

 test('reaction polarity cannot contradict the offer result', async () => {
    for (const success of [false, true]) {
        const result = await reactToChoice({ target: 'orange', offered_item: success ? 'orange' : 'apple' }, {
            ...providers,
            ai: { models: { generateContent: async () => ({ text: JSON.stringify({
                dialogue: success ? 'Not that one, Mum!' : 'Yay! Thanks, Mum!', emotion: 'excited',
            }) }) } },
        });
        assert.equal(result.success, success);
        assert.ok(result.dialogue.startsWith(success ? 'Yay!' : 'Not that one'));
        assert.equal(result.clue_level, success ? 0 : 1);
    }
});

test('an offer matching the previous clue gets acknowledgment and a stronger clue', async () => {
    const first = await reactToChoice({ target: 'orange', offered_item: 'bread' }, providers);
    const next = await reactToChoice({ target: 'orange', offered_item: 'strawberry_cake', history: ['bread'] }, providers);
    assert.equal(first.clue_level, 1);
    assert.equal(next.clue_level, 2);
    assert.notEqual(first.clue, next.clue);
    assert.match(next.dialogue, /That fits/);
    assert.equal(next.emotion, 'hopeful');
    const repeated = await reactToChoice({ target: 'orange', offered_item: 'strawberry_cake', history: ['bread', 'strawberry_cake'] }, providers);
    assert.equal(repeated.clue_level, 2);
    const later = await reactToChoice({ target: 'orange', offered_item: 'apple', history: ['bread', 'strawberry_cake'] }, providers);
    assert.equal(later.clue_level, 3);
});
