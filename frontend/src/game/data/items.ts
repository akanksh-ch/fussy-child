import apple from '../../../../assets/Icons/fruit_apple.png';
import banana from '../../../../assets/Icons/fruit_banana.png';
import strawberry from '../../../../assets/Icons/fruit_strawberry.png';
import carrot from '../../../../assets/Icons/vegetable_carrot.png';
import chocolate from '../../../../assets/Icons/cake_chocolate.png';
import orange from '../../../../assets/Icons/fruit_orange.png';

export const items = [
    { id: 'apple', name: 'Apple', image: apple, category: 'fruit', colour: 'red', shape: 'round' },
    { id: 'banana', name: 'Banana', image: banana, category: 'fruit', colour: 'yellow', shape: 'long' },
    { id: 'strawberry', name: 'Strawberry', image: strawberry, category: 'fruit', colour: 'red', shape: 'small' },
    { id: 'carrot', name: 'Carrot', image: carrot, category: 'vegetable', colour: 'orange', shape: 'long' },
    { id: 'chocolate', name: 'Choc cake', image: chocolate, category: 'cake', colour: 'brown', shape: 'square' },
    { id: 'orange', name: 'Orange', image: orange, category: 'fruit', colour: 'orange', shape: 'round' },
] as const;

export type Item = typeof items[number];
