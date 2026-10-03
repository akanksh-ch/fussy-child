import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import { items, Item } from '../data/items';
import { requestReaction } from '../api';

const ink = 0x383d32;
const cream = 0xfff9e9;

export class Game extends Scene {
    private target: Item;
    private attempts = 0;
    private clues: string[] = [];
    private clueList: GameObjects.Text;
    private selected = 0;
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
        this.clues = [];
        this.selected = 0;
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
        this.panel(330, 195, 455, 126, cream);
        this.add.triangle(785, 280, 0, 0, 24, 15, 0, 30, ink).setOrigin(0);
        this.add.triangle(782, 285, 0, 0, 20, 10, 0, 20, cream).setOrigin(0);
        this.dialogue = this.label(352, 217, "I want something! But you have to guess…", 21)
            .setWordWrapWidth(408);

        this.clueList = this.label(345, 345, '', 13)
            .setWordWrapWidth(420);
        this.replay = this.label(780, 450, 'REPLAY VOICE [R]', 12).setOrigin(1, 0)
            .setInteractive({ useHandCursor: true }).setVisible(false);
        this.replay.on('pointerdown', () => this.playVoice());
        this.label(560, 545, 'WHAT SHOULD MUM GIVE TIMMY?', 23).setOrigin(0.5);
        items.forEach((item, index) => this.makeCard(item, index));
        this.counter = this.label(48, 756, 'ATTEMPTS: 0', 15);
        this.status = this.label(560, 756, 'Arrow keys + Enter · or click a food', 15, '#73765f').setOrigin(0.5, 0);
        this.label(1072, 756, 'FOOD ART: ALEX · CC BY', 10, '#73765f').setOrigin(1, 0);
        this.refreshCards();
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.repeat) return;
            if (event.key.toLowerCase() === 'n') this.scene.restart();
            if (event.key.toLowerCase() === 'r') this.playVoice();
            const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 };
            if (event.key in moves) {
                event.preventDefault();
                this.selected = (this.selected + moves[event.key] + items.length) % items.length;
                this.refreshCards();
            }
            if (event.key === 'Enter') { event.preventDefault(); this.offer(items[this.selected], this.selected); }

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
        this.add.rectangle(560, 330, 1030, 360, 0xe7e8d2).setStrokeStyle(3, ink);
        this.add.rectangle(560, 473, 1026, 70, 0xd5cfad);
        for (let x = 48; x < 1080; x += 48) {
            this.add.rectangle(x, 473, 2, 70, 0xc6c19e);
        }
        this.add.rectangle(560, 438, 1026, 5, 0xa5ac89);
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
        const x = 48 + (index % 6) * 174;
        const y = 578 + Math.floor(index / 6) * 84;
        const card = this.add.container(x, y);
        const frame = this.add.rectangle(0, 0, 154, 76, cream).setOrigin(0).setStrokeStyle(3, ink);
        const image = this.add.image(28, 35, item.id).setDisplaySize(40, 40);
        const name = this.label(56, 15, item.name, 13);
        const category = this.label(56, 40, item.category, 11, '#73765f');
        const rejected = this.label(144, 4, '×', 18, '#923e2c').setOrigin(1, 0).setVisible(false);
        card.add([frame, image, name, category, rejected]);
        frame.setInteractive({ useHandCursor: true });
        frame.on('pointerover', () => { this.selected = index; this.refreshCards(); });
        frame.on('pointerdown', () => this.offer(item, index));
        this.cards.push(card);
    }

    private refreshCards() {
        this.cards.forEach((card, index) => {
            const rejected = this.history.includes(items[index].id) && items[index].id !== this.target.id;
            card.setAlpha(rejected ? 0.4 : this.busy ? 0.65 : 1);
            (card.list[0] as GameObjects.Rectangle).setStrokeStyle(index === this.selected ? 4 : 2,
                index === this.selected ? 0xae583d : ink);
            (card.list[4] as GameObjects.Text).setVisible(rejected);
        });
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
        if (this.busy || this.won || this.history.includes(item.id)) return;
        this.busy = true;
        this.stopVoice();
        this.replay.setVisible(false);
        const request = new AbortController();
        this.request = request;
        this.status.setText(`Mum offers ${item.name.toLowerCase()}…`);
        this.selected = index;
        this.refreshCards();
        this.cards[index].setAlpha(1);
        const offered = this.add.image(this.cards[index].x + 28, this.cards[index].y + 35, item.id).setDisplaySize(56, 56).setDepth(10);
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
            if (result.clue && !this.clues.includes(result.clue)) this.clues.push(result.clue);
            this.clueList.setText(this.clues.map((clue, index) => `${index + 1}. ${clue}`).join('\n'));
            this.refreshCards();
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
                this.refreshCards();
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
