import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import { items, Item } from '../data/items';
import { requestReaction } from '../api';

const ink = 0x383d32;
const cream = 0xfff9e9;

export class Game extends Scene {
    private target: Item;
    private attempts = 0;
    private history: string[] = [];
    private request?: AbortController;
    private audio?: HTMLAudioElement;
    private replay: GameObjects.Text;
    private busy = false;
    private won = false;
    private dialogue: GameObjects.Text;
    private counter: GameObjects.Text;
    private status: GameObjects.Text;
    private face: GameObjects.Text;
    private timmy: GameObjects.Container;
    private cards: GameObjects.Container[] = [];

    constructor() { super('Game'); }

    preload() {
        items.forEach(item => this.load.image(item.id, item.image));
    }

    create() {
        this.attempts = 0;
        this.history = [];
        this.busy = false;
        this.won = false;
        this.cards = [];
        const previous = this.registry.get('lastTarget') as string | undefined;
        this.target = PhaserMath.RND.pick(items.filter(item => item.id !== previous));
        this.registry.set('lastTarget', this.target.id);
        this.drawShop();
        this.label(48, 30, 'FUSSY CHILD', 16, '#566347');
        this.label(560, 68, 'WHAT DOES TIMMY WANT?', 34).setOrigin(0.5);
        this.label(560, 108, 'A little shopping trip. A very big mystery.', 16, '#73765f').setOrigin(0.5);
        const reset = this.label(1068, 30, 'NEW GAME [N]', 14).setOrigin(1, 0)
            .setInteractive({ useHandCursor: true });
        reset.on('pointerover', () => reset.setColor('#ae583d'));
        reset.on('pointerout', () => reset.setColor('#383d32'));
        reset.on('pointerdown', () => this.scene.restart());

        this.character(224, 372, false);
        this.timmy = this.character(855, 361, true);
        this.label(224, 416, 'MUM', 20).setOrigin(0.5);
        this.label(224, 443, 'Patient. Mostly.', 13, '#73765f').setOrigin(0.5);
        this.label(855, 405, 'TIMMY', 20).setOrigin(0.5);
        this.panel(555, 434, 493, 96, cream);
        this.add.rectangle(858, 430, 20, 18, ink);
        this.add.rectangle(858, 436, 12, 20, cream);
        this.dialogue = this.label(580, 455, "I want something! But you have to guess…", 21)
            .setWordWrapWidth(440);

        this.replay = this.label(1068, 565, 'REPLAY VOICE [R]', 12).setOrigin(1, 0)
            .setInteractive({ useHandCursor: true }).setVisible(false);
        this.replay.on('pointerdown', () => this.playVoice());
        this.label(560, 580, 'WHAT SHOULD MUM GIVE TIMMY?', 23).setOrigin(0.5);
        items.forEach((item, index) => this.makeCard(item, index));
        this.counter = this.label(48, 756, 'ATTEMPTS: 0', 15);
        this.status = this.label(560, 756, 'Pick an item · or press 1–6', 15, '#73765f').setOrigin(0.5, 0);
        this.label(1072, 756, 'FOOD ART: ALEX · CC BY', 10, '#73765f').setOrigin(1, 0);
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.repeat) return;
            if (event.key.toLowerCase() === 'n') this.scene.restart();
            if (event.key.toLowerCase() === 'r') this.playVoice();
            const index = Number(event.key) - 1;
            if (items[index]) this.offer(items[index], index);
        });
        this.events.once('shutdown', () => {
            this.input.keyboard?.removeAllListeners();
            this.request?.abort();
            this.request = undefined;
            this.stopVoice();
        });
    }

    private label(x: number, y: number, text: string, size = 18, color = '#383d32') {
        return this.add.text(x, y, text, {
            fontFamily: 'monospace', fontSize: size, color, fontStyle: 'bold',
            lineSpacing: 6,
        });
    }

    private panel(x: number, y: number, width: number, height: number, colour: number) {
        this.add.rectangle(x + 5, y + 6, width, height, 0xb5b29a).setOrigin(0);
        this.add.rectangle(x, y, width, height, colour).setOrigin(0).setStrokeStyle(3, ink);
    }

    private drawShop() {
        this.add.rectangle(560, 347, 1030, 396, 0xe7e8d2).setStrokeStyle(3, ink);
        this.add.rectangle(560, 487, 1026, 110, 0xd5cfad);
        for (let x = 48; x < 1080; x += 48) {
            this.add.rectangle(x, 489, 2, 105, 0xc6c19e);
        }
        this.add.rectangle(560, 433, 1026, 5, 0xa5ac89);
        // A small shop backdrop keeps the characters and dialogue in the foreground.
        this.panel(392, 191, 316, 231, 0xf6eed8);
        this.add.rectangle(550, 203, 340, 36, 0x788763).setStrokeStyle(3, ink);
        this.label(550, 204, 'THE CORNER SHOP', 17, '#fff9e9').setOrigin(0.5);
        for (let row = 0; row < 2; row++) {
            items.forEach((item, index) => {
                this.add.image(423 + index * 51, 264 + row * 71, item.id).setDisplaySize(36, 36);
            });
            this.add.rectangle(550, 292 + row * 71, 310, 9, 0xb5936e);
        }
        this.add.rectangle(550, 399, 310, 38, 0xc59e73);
        this.label(550, 399, 'GOOD FOOD · BIG FEELINGS', 11).setOrigin(0.5);
        this.add.rectangle(560, 554, 1028, 3, ink);
    }

    private character(x: number, y: number, child: boolean) {
        const figure = this.add.container(x, y);
        const block = (px: number, py: number, w: number, h: number, colour: number) => {
            const part = this.add.rectangle(px, py, w, h, colour).setOrigin(0.5, 1);
            figure.add(part);
        };
        block(0, 12, 94, 12, 0xb6b596);
        const skin = 0xe7b183;
        const hair = child ? 0x68482f : 0x594232;
        const shirt = child ? 0xcf704b : 0x738668;
        const height = child ? 122 : 161;
        block(-18, 0, 25, 19, ink); block(18, 0, 25, 19, ink);
        block(-17, -17, 21, 32, 0x626d70); block(17, -17, 21, 32, 0x626d70);
        block(0, -43, 64, child ? 48 : 67, shirt);
        block(-39, -42, 14, 42, skin); block(39, -42, 14, 42, skin);
        if (!child) block(0, -39, 70, 14, shirt);
        block(0, -height + 39, 66, 62, hair);
        block(0, -height + 43, 54, 46, skin);
        block(0, -height + 1, 68, 18, hair);
        block(-26, -height + 20, 12, 30, hair);
        if (child) block(15, -height - 14, 22, 10, hair);
        else block(-32, -height + 57, 14, 60, hair);
        block(-12, -height + 20, 6, 7, ink); block(12, -height + 20, 6, 7, ink);
        const mouth = this.label(0, -height + 26, child ? '〜' : '⌣', 20).setOrigin(0.5);
        figure.add(mouth);
        if (child) this.face = mouth;
        return figure;
    }

    private makeCard(item: Item, index: number) {
        const x = 48 + index * 174;
        const card = this.add.container(x, 615);
        const shadow = this.add.rectangle(4, 5, 154, 112, 0xc9c2a6).setOrigin(0);
        const frame = this.add.rectangle(0, 0, 154, 112, cream).setOrigin(0).setStrokeStyle(3, ink);
        const number = this.label(10, 8, String(index + 1), 12, '#898a72');
        const image = this.add.image(77, 46, item.id).setDisplaySize(56, 56);
        const name = this.label(77, 91, item.name, 16).setOrigin(0.5);
        card.add([shadow, frame, number, image, name]);
        frame.setInteractive({ useHandCursor: true });
        frame.on('pointerover', () => {
            if (!this.busy && !this.won) { frame.setFillStyle(0xf4df9e); card.y = 609; }
        });
        frame.on('pointerout', () => { frame.setFillStyle(cream); card.y = 615; });
        frame.on('pointerdown', () => this.offer(item, index));
        this.cards.push(card);
    }

    private stopVoice() {
        this.audio?.pause();
        this.audio = undefined;
    }

    private async playVoice() {
        const audio = this.audio;
        if (!audio) return;
        audio.currentTime = 0;
        try {
            await audio.play();
            if (this.audio === audio) this.replay.setText('REPLAY VOICE [R]');
        } catch {
            if (this.audio === audio) this.replay.setText('PLAY VOICE [R]');
        }
    }

    private offer(item: Item, index: number) {
        if (this.busy || this.won) return;
        this.busy = true;
        this.stopVoice();
        this.replay.setVisible(false);
        const request = new AbortController();
        this.request = request;
        this.status.setText(`Mum offers ${item.name.toLowerCase()}…`);
        this.cards.forEach(card => card.setAlpha(0.6));
        this.cards[index].setAlpha(1);
        const offered = this.add.image(125 + index * 174, 661, item.id).setDisplaySize(56, 56).setDepth(10);
        this.tweens.add({
            targets: offered, x: 790, y: 306, duration: 450, ease: 'Back.easeOut',
            onComplete: () => {
                offered.destroy();
                void this.respond(item, request);
            },
        });
    }

    private async respond(item: Item, request: AbortController) {
        this.status.setText('Timmy is thinking…');
        try {
            const result = await requestReaction(this.target.id, item.id, this.history, request.signal);
            // A reset starts a new puzzle on this same Scene instance.
            if (this.request !== request) return;
            this.history.push(item.id);
            this.attempts++;
            this.counter.setText(`ATTEMPTS: ${this.attempts}`);
            this.won = result.success;
            this.dialogue.setText(result.dialogue);
            this.face.setText({ annoyed: '−', hopeful: '⌣', sad: '︵', excited: 'D' }[result.emotion]);
            this.status.setText(this.won ? 'Mystery solved! New game? [N]' : 'Not quite! Follow the clue and try again.');
            this.tweens.add({ targets: this.timmy, y: this.won ? 343 : 361, x: this.won ? 855 : 863,
                duration: 110, yoyo: true, repeat: this.won ? 3 : 2,
            });
            if (this.won) this.celebrate();
            if (result.audio) {
                this.audio = new Audio(`data:audio/mpeg;base64,${result.audio.base64}`);
                this.replay.setText('REPLAY VOICE [R]').setVisible(true);
                void this.playVoice();
            } else {
                this.replay.setText('VOICE UNAVAILABLE').setVisible(true);
            }
        } catch (error) {
            if (this.request !== request) return;
            this.status.setText(error instanceof Error && error.message.startsWith('Timmy')
                ? error.message : 'Could not reach Timmy. Pick an item to retry.');
        } finally {
            if (this.request === request) {
                this.request = undefined;
                this.busy = false;
                if (!this.won) this.cards.forEach(card => card.setAlpha(1));
            }
        }
    }

    private celebrate() {
        for (let i = 0; i < 32; i++) {
            const confetti = this.add.rectangle(855, 280, 8, 8,
                PhaserMath.RND.pick([0xcf704b, 0x788763, 0xe9b84c, 0xf8f4e6])).setDepth(20);
            this.tweens.add({ targets: confetti, x: PhaserMath.Between(570, 1050),
                y: PhaserMath.Between(360, 510), angle: PhaserMath.Between(-180, 180), alpha: 0,
                duration: PhaserMath.Between(700, 1400), ease: 'Cubic.easeOut',
                onComplete: () => confetti.destroy(),
            });
        }
    }
}
