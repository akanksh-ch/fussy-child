import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1120,
    height: 800,
    parent: 'game-container',
    backgroundColor: '#f4eddc',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    scene: [MainGame],
};

export default function StartGame(parent: string) {
    return new Game({ ...config, parent });
}
