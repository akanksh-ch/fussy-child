import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { reactToChoice, RequestError, providerDiagnostic } from './reaction.js';

const envPath = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
for (const key of ['GEMINI_API_KEY', 'ELEVENLABS_API_KEY']) {
    if (!process.env[key]) throw new Error(`Missing ${key}; configure backend/.env.`);
}
const providers = {
    ai: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
    elevenlabs: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY }),
    model: process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it',
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    speechModel: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
};
const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const app = express();
app.disable('x-powered-by');
app.use((request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    if (request.headers.origin && request.headers.origin !== origin) {
        return response.status(403).json({ error: 'Origin not allowed.' });
    }
    if (request.headers.origin) response.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
        response.set({ 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
        return response.sendStatus(204);
    }
    next();
});
app.use(express.json({ limit: '8kb' }));
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
let activeRequests = 0;
app.post('/api/react', async (request, response) => {
    if (!request.is('application/json')) return response.status(415).json({ error: 'Use application/json.' });
    if (activeRequests >= 4) return response.status(429).json({ error: 'Busy. Try again shortly.' });
    activeRequests++;
    try {
        response.json(await reactToChoice(request.body, providers));
    } catch (error) {
        const status = error instanceof RequestError ? error.status : 502;
        if (status === 502) console.error('Gemini request failed:', JSON.stringify(providerDiagnostic(error,
            [process.env.GEMINI_API_KEY, process.env.ELEVENLABS_API_KEY])));
        response.status(status).json({ error: status === 502 ? 'Timmy could not respond. Please try again.' : error.message });
    } finally { activeRequests--; }
});
app.all('/api/react', (_request, response) => response.set('Allow', 'POST').status(405).json({ error: 'Use POST.' }));
app.use((_request, response) => response.status(404).json({ error: 'Not found.' }));
app.use((error, _request, response, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.status === 400 ? 400 : 500;
    response.status(status).json({ error: status === 413 ? 'Request exceeds 8 KB.' : status === 400 ? 'Invalid JSON.' : 'Server error.' });
});
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Fussy Child API listening on port ${port}`));
server.requestTimeout = 15000;
server.headersTimeout = 10000;
