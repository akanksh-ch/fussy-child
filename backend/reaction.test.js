import test from 'node:test';
import assert from 'node:assert/strict';
import { reactToChoice, validateChoice, providerDiagnostic } from './reaction.js';

test('provider diagnostics retain the reason without keys, URLs, or control characters', () => {
    const error = Object.assign(new Error(JSON.stringify({ error: {
        message: 'Invalid key private-key at https://example.com?key=secret\nCheck quota.',
    } })), { status: 400 });
    const diagnostic = providerDiagnostic(error, ['private-key']);
    assert.equal(diagnostic.status, 400);
    assert.match(diagnostic.message, /Invalid key/);
    assert.match(diagnostic.message, /Check quota/);
    assert.doesNotMatch(diagnostic.message, /private-key|https:|secret|\n/);
    assert.equal(providerDiagnostic(new Error('fetch failed')).message, 'fetch failed');
    assert.equal(providerDiagnostic(null).status, null);
});

test('validates choices, guards hints and wins, and preserves dialogue when speech fails', async () => {
    for (const body of [null, {}, { target: '__proto__', offered_item: 'apple' },
        { target: 'orange', offered_item: 'apple', history: ['unknown'] },
        { target: 'orange', offered_item: 'apple', history: Array(51).fill('apple') }]) {
        assert.throws(() => validateChoice(body), { status: 400 });
    }
    let output = { dialogue: 'Not that one, Mum!', emotion: 'hopeful', success: false, clue_type: 'shape' };
    let spoken;
    let failSpeech = false;
    const providers = {
        model: 'test', voiceId: 'test', speechModel: 'eleven_v3',
        ai: { models: { generateContent: async request => {
            assert.deepEqual(Object.keys(JSON.parse(request.contents)), ['success']);
            return { text: JSON.stringify(output) };
        } } },
        elevenlabs: { textToSpeech: { convert: async (_voice, request, options) => {
            assert.ok(options.abortSignal instanceof AbortSignal);
            assert.equal(request.voiceSettings?.stability, providers.speechModel === 'eleven_v3' ? 0 : undefined);
            spoken = request.text;
            if (failSpeech) throw new Error('Speech offline');
            return (async function* () { yield Buffer.from('mock mp3'); })();
        } } },
    };
    const choice = { target: 'orange', offered_item: 'apple', history: [] };
    let result = await reactToChoice(choice, providers);
    assert.equal(result.dialogue, `${output.dialogue} ${result.clue}`);
    assert.equal(spoken, `[whining] [curious] ${result.dialogue}`);
    assert.doesNotMatch(result.dialogue, /\[/);
    assert.equal(Buffer.from(result.audio.base64, 'base64').toString(), 'mock mp3');
    assert.equal(result.success, false);
    const validOutput = { ...output };
    for (const invalid of [null, {}, { ...validOutput, dialogue: ' ' },
        { ...validOutput, emotion: 'unknown' }, { ...validOutput, dialogue: 'word '.repeat(15) }]) {
        output = invalid;
        result = await reactToChoice(choice, providers);
        assert.ok(result.dialogue.trim());
        assert.ok(result.dialogue.split(/\s+/).length < 15);
        assert.equal(result.success, false);
        assert.doesNotMatch(result.dialogue, /orange/i);
        assert.equal(result.clue_level, 1);
    }
    output = validOutput;
    output.dialogue = 'I want an orange!';
    result = await reactToChoice(choice, providers);
    assert.doesNotMatch(result.dialogue, /orange/i);
        assert.equal(result.clue_level, 1);
    output.success = true;
    result = await reactToChoice(choice, providers);
    assert.equal(result.success, false);
    failSpeech = true;
    result = await reactToChoice({ ...choice, offered_item: 'orange' }, providers);
    assert.equal(result.success, true);
    assert.equal(result.emotion, 'excited');
    assert.equal(result.audio, null);
    assert.ok(result.audio_error);
    assert.equal(spoken, `[excited] [laughs] ${result.dialogue}`);
    providers.speechModel = 'eleven_flash_v2_5';
    result = await reactToChoice(choice, providers);
    assert.equal(spoken, result.dialogue);
    providers.ai.models.generateContent = async () => { throw new Error('Gemini offline'); };
    await assert.rejects(reactToChoice(choice, providers), /Gemini offline/);
});
