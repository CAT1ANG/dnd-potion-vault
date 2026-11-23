import PrototypeApp from './PrototypeApp';
import {publicPotion, types} from '../lib/potions';

export default function Home() {
  return <PrototypeApp catalog={types.map(publicPotion)} />;
}
