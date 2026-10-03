export interface Reaction {
    dialogue: string;
    emotion: 'annoyed' | 'hopeful' | 'sad' | 'excited';
    success: boolean;
    clue: string | null;
    clue_level: number;
    audio: { mime_type: 'audio/mpeg'; base64: string } | null;
    audio_error: string | null;
}

export async function requestReaction(target: string, offered: string, history: string[], signal: AbortSignal): Promise<Reaction> {
    const base = (import.meta.env?.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
    const response = await fetch(`${base}/api/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, offered_item: offered, history: history.slice(-50) }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok) throw new Error(`Timmy could not respond (HTTP ${response.status}). Try again.`);
    const result = await response.json();
    if (!result || typeof result.dialogue !== 'string' || !result.dialogue.trim() ||
        typeof result.success !== 'boolean' ||
        !['annoyed', 'hopeful', 'sad', 'excited'].includes(result.emotion) ||
        !Number.isInteger(result.clue_level) ||
        (result.success ? result.clue !== null || result.clue_level !== 0
            : typeof result.clue !== 'string' || !result.clue.trim() || result.clue_level < 1 || result.clue_level > 4) ||
        (result.audio !== null && (!result.audio || result.audio.mime_type !== 'audio/mpeg' ||
            typeof result.audio.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.audio.base64))) ||
        (result.audio_error !== null && typeof result.audio_error !== 'string')) {
        throw new Error('Timmy sent an invalid response. Try again.');
    }
    return result;
}
