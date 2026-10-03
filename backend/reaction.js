import catalogue from '../shared/items.json' with { type: 'json' };
const items = Object.fromEntries(catalogue.map(item => [item.id, item]));
const emotions = ['annoyed', 'hopeful', 'sad', 'excited'];

export class RequestError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

// Log only the useful message, never an SDK request object or its headers.
export function providerDiagnostic(error, secrets = []) {
    let message = typeof error?.message === 'string' ? error.message : 'Unknown provider error';
    try {
        const parsed = JSON.parse(message);
        if (typeof parsed.error?.message === 'string') message = parsed.error.message;
    } catch { /* Connection errors are plain text. */ }
    for (const secret of secrets.filter(Boolean)) message = message.replaceAll(secret, '[REDACTED]');
    message = message.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')
        .replace(/AIza[\w-]+/g, '[REDACTED]')
        .replace(/((?:api[_-]?key|authorization|token)\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
        .replace(/[\r\n\x00-\x1f\x7f]/g, ' ');
    return { status: Number(error?.status) || null, message: message.slice(0, 1200) };
}

export function validateChoice(body) {
    const known = id => typeof id === 'string' && Object.hasOwn(items, id);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !known(body.target) || !known(body.offered_item) ||
        (body.history !== undefined && (!Array.isArray(body.history) || body.history.length > 50 || !body.history.every(known)))) {
        throw new RequestError(400, 'Send valid target and offered_item IDs, plus an optional history of up to 50 item IDs.');
    }
    return { target: body.target, offered_item: body.offered_item, history: body.history ?? [] };
}

export async function reactToChoice(body, { ai, elevenlabs, model, voiceId, speechModel }) {
    const choice = validateChoice(body);
    const success = choice.target === choice.offered_item;
    const response = await ai.models.generateContent({
        model,
        contents: JSON.stringify({ success }),
        config: {
            httpOptions: { timeout: 20000 },
            systemInstruction: `You are Timmy, a playful, impatient cartoon child shopping with Mum.
Return only a generic spoken reaction, at most five words. Never describe food, objects, colours, shapes, tastes, or preferences.
If success is false, pout kindly about the wrong guess. If true, celebrate with emotion excited.
No hints, explanations, stage directions, or audio tags. Return JSON.`,
            responseMimeType: 'application/json',
            responseJsonSchema: {
                type: 'object',
                properties: {
                    dialogue: { type: 'string' },
                    emotion: { type: 'string', enum: emotions },
                },
                required: ['dialogue', 'emotion'],
                additionalProperties: false,
            },
        },
    });

    let reaction;
    try { reaction = JSON.parse(response.text); } catch { /* Use a safe clue below. */ }
    // Keep generated personality inside a harmless vocabulary; clue facts are authored.
    const dialogue = reaction?.dialogue;
    const safeWords = new Set("no noo nooo nope not that this one mum mommy mummy please oh ugh again try guess guessing wrong silly aww aw come on hmm yes yay hooray finally thanks thank you exactly it wanted i that's".split(' '));
    const words = typeof dialogue === 'string' ? dialogue.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:'[a-z]+)?/g) : null;
    const wrongPolarity = success
        ? !/\b(yes|yay|hooray|thanks|thank|finally|exactly)\b/i.test(dialogue ?? '') || /\b(no|noo|nooo|nope|not|wrong|ugh)\b/i.test(dialogue ?? '')
        : /\b(yes|yay|hooray|thanks|thank|finally|exactly|wanted)\b/i.test(dialogue ?? '') || reaction?.emotion === 'excited';
    if (wrongPolarity || !words?.length || words.length > 5 || dialogue.length > 80 ||
        /[^a-zA-Z\s'’!?.…,-]/.test(dialogue) || words.some(word => !safeWords.has(word)) ||
        !emotions.includes(reaction?.emotion)) {
        reaction = { dialogue: success ? 'Yay! Thanks, Mum!' : 'Not that one, Mum!', emotion: success ? 'excited' : 'annoyed' };
    }
    const target = items[choice.target];
    const wrongOffers = new Set();
    let clue_level = 0;
    let matchedClue = false;
    // Replay distinct offers so adaptive progress survives stateless API requests.
    for (const id of [...choice.history, choice.offered_item]) {
        if (id === choice.target || wrongOffers.has(id)) continue;
        const offered = items[id];
        matchedClue = clue_level > 0 && target.clues.slice(0, clue_level).every((clue, index) =>
            index === 0 && target.category === 'Bakery'
                ? offered.category !== 'Fruit' // Cakes also come from an oven.
                : offered.clues[index] === clue);
        wrongOffers.add(id);
        clue_level = Math.min(4, Math.max(Math.ceil(wrongOffers.size / 2), clue_level + Number(matchedClue)));
    }
    if (success) clue_level = 0;
    if (!success && matchedClue) reaction = { dialogue: 'That fits! But...', emotion: 'hopeful' };
    const clue = success ? null : items[choice.target].clues[clue_level - 1];
    const result = { dialogue: clue ? `${reaction.dialogue} ${clue}` : reaction.dialogue,
        emotion: success ? 'excited' : reaction.emotion, success, clue, clue_level,
        audio: null, audio_error: null };
    try {
        const expressive = speechModel === 'eleven_v3';
        const delivery = { annoyed: '[whining] [frustrated]', hopeful: '[whining] [curious]',
            sad: '[whining] [sad]', excited: '[excited] [laughs]' }[result.emotion];
        const stream = await elevenlabs.textToSpeech.convert(voiceId, {
            text: expressive ? `${delivery} ${result.dialogue}` : result.dialogue,
            ...(expressive ? { voiceSettings: { stability: 0, similarityBoost: 0.75 } } : {}),
            modelId: speechModel, outputFormat: 'mp3_44100_128',
        }, { timeoutInSeconds: 20, maxRetries: 0, abortSignal: AbortSignal.timeout(20000) });
        const chunks = [];
        let bytes = 0;
        for await (const chunk of stream) {
            bytes += chunk.length;
            if (bytes > 2 * 1024 * 1024) throw new Error('Audio too large');
            chunks.push(Buffer.from(chunk));
        }
        if (!bytes) throw new Error('Empty audio');
        // ponytail: inline audio is sufficient for short lines; stream audio if dialogue grows.
        result.audio = { mime_type: 'audio/mpeg', base64: Buffer.concat(chunks).toString('base64') };
    } catch {
        result.audio_error = 'Speech unavailable. Display the dialogue and allow the next choice.';
    }
    return result;
}
