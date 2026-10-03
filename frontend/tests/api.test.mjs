import test from 'node:test';
import assert from 'node:assert/strict';
import { requestReaction } from '../src/game/api.ts';

test('offers use the API contract; failures and cancellation reject', async t => {
    const reaction = { dialogue: 'Something round!', emotion: 'hopeful', success: false,
        clue_type: 'shape', audio: null, audio_error: 'Speech unavailable' };
    let response = new Response(JSON.stringify(reaction));
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'http://localhost:3001/api/react');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(options.body), {
            target: 'orange', offered_item: 'apple', history: Array(50).fill('banana'),
        });
        options.signal.throwIfAborted();
        return response;
    });
    const controller = new AbortController();
    const offer = () => requestReaction('orange', 'apple', Array(51).fill('banana'), controller.signal);
    assert.deepEqual(await offer(), reaction);
    response = new Response('{}', { status: 502 });
    await assert.rejects(offer(), /HTTP 502/);
    response = new Response('{"success":"false"}');
    await assert.rejects(offer(), /invalid response/);
    controller.abort();
    await assert.rejects(offer(), { name: 'AbortError' });
});
