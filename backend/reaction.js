// Keep IDs aligned with the frontend inventory. Only server-owned descriptions reach the prompt.
const items = {
    apple: { name: 'apple', category: 'fruit', colour: 'red', shape: 'round' },
    banana: { name: 'banana', category: 'fruit', colour: 'yellow', shape: 'long' },
    strawberry: { name: 'strawberry', category: 'fruit', colour: 'red', shape: 'small' },
    carrot: { name: 'carrot', category: 'vegetable', colour: 'orange', shape: 'long' },
    chocolate: { name: 'chocolate cake', category: 'cake', colour: 'brown', shape: 'square' },
    orange: { name: 'orange', category: 'fruit', colour: 'orange', shape: 'round' },
};
const emotions = ['annoyed', 'hopeful', 'sad', 'excited'];
const clueTypes = ['category', 'colour', 'shape', 'none'];

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
    const target = items[choice.target];
    const success = choice.target === choice.offered_item;
    const response = await ai.models.generateContent({
        model,
        contents: JSON.stringify({ target, offered_item: items[choice.offered_item], history: choice.history, success }),
        config: {
            httpOptions: { timeout: 20000 },
            systemInstruction: `You are Timmy, a whiny, impatient little cartoon child shopping with Mum. Return a short spoken reaction with an indirect hint.
Sound adorably bratty: simple childish words, pouty protests, and an excited squeal when Mum guesses right.
Write only spoken words in dialogue, without stage directions or bracketed audio tags.
Use fewer than 15 words total. Keep it kind, playful, and suitable for children.
The supplied success value is authoritative. If true, celebrate and use emotion excited and clue_type none.
If false, never say the target name or its item ID, even as a colour. Hint at category, colour, or shape instead.
Use the previous choices to avoid repetitive hints. Dialogue contains both the reaction and hint; do not add a separate explanation.`,
            responseMimeType: 'application/json',
            responseJsonSchema: {
                type: 'object',
                properties: {
                    dialogue: { type: 'string' },
                    emotion: { type: 'string', enum: emotions },
                    success: { type: 'boolean' },
                    clue_type: { type: 'string', enum: clueTypes },
                },
                required: ['dialogue', 'emotion', 'success', 'clue_type'],
                additionalProperties: false,
            },
        },
    });

    let reaction;
    try { reaction = JSON.parse(response.text); } catch { /* Use a safe clue below. */ }
    const dialogue = reaction?.dialogue;
    const revealsTarget = typeof dialogue === 'string' &&
        new RegExp(`\\b(${choice.target}|${target.name})s?\\b`, 'i').test(dialogue);
    if (typeof dialogue !== 'string' || !dialogue.trim() || dialogue.length > 200 ||
        dialogue.trim().split(/\s+/).length >= 15 || !emotions.includes(reaction?.emotion) ||
        !clueTypes.includes(reaction?.clue_type) || reaction?.success !== success || (!success && revealsTarget)) {
        reaction = success
            ? { dialogue: "YES! That's exactly what I wanted! Thanks, Mum!", emotion: 'excited', clue_type: 'none' }
            : { dialogue: `Not that one, Mum! I want something ${target.shape}.`, emotion: 'hopeful', clue_type: 'shape' };
    }
    const result = { dialogue: reaction.dialogue, emotion: success ? 'excited' : reaction.emotion,
        success, clue_type: success ? 'none' : reaction.clue_type, audio: null, audio_error: null };
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
