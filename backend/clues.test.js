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
    const guesses = ['apple', 'banana', 'strawberry', 'bread', 'baguette', 'croissant', 'pretzel'];
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
