import catalogue from '../../../../shared/items.json';
const images = import.meta.glob('../../../../assets/Icons/*.png', { eager: true, query: '?url', import: 'default' });
export const items = catalogue.map(item => ({
    id: item.id, name: item.name, category: item.category,
    image: images[`../../../../assets/Icons/${item.sprite}`] as string,
}));
export type Item = typeof items[number];
