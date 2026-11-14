export type PotionDefinition = {
  id: string;
  category: string;
  name: string;
  fullName: string;
  rarity: string;
  color: string;
  shape: "vial" | "flask" | "jar" | "pentagon";
  interaction: "drink";
  count: number;
  dice: number;
  sides: number;
  bonus: number;
  range: string;
  formula: string;
};

export const types: PotionDefinition[] = [
  {id:'healing-common',category:'healing',name:'Обычное',fullName:'Обычное зелье лечения',rarity:'Обычное',color:'#ff6161',shape:'vial',interaction:'drink',count:100,dice:2,sides:4,bonus:2,range:'4–10',formula:'2к4 + 2'},
  {id:'healing-greater',category:'healing',name:'Большое',fullName:'Большое зелье лечения',rarity:'Необычное',color:'#d93f3f',shape:'flask',interaction:'drink',count:50,dice:4,sides:4,bonus:4,range:'8–20',formula:'4к4 + 4'},
  {id:'healing-superior',category:'healing',name:'Отличное',fullName:'Отличное зелье лечения',rarity:'Редкое',color:'#b52121',shape:'jar',interaction:'drink',count:25,dice:8,sides:4,bonus:8,range:'16–40',formula:'8к4 + 8'},
  {id:'healing-supreme',category:'healing',name:'Превосходное',fullName:'Превосходное зелье лечения',rarity:'Очень редкое',color:'#8c0000',shape:'pentagon',interaction:'drink',count:10,dice:10,sides:4,bonus:20,range:'30–60',formula:'10к4 + 20'}
];

export function publicPotion(potion: PotionDefinition) {
  return {
    id: potion.id,
    category: potion.category,
    name: potion.name,
    fullName: potion.fullName,
    rarity: potion.rarity,
    color: potion.color,
    shape: potion.shape,
    interaction: potion.interaction,
    range: potion.range,
    formula: potion.formula,
  };
}

export function rollPotion(potion: PotionDefinition) {
  const bytes = crypto.getRandomValues(new Uint8Array(potion.dice));
  const dice = Array.from(bytes, value => value % potion.sides + 1);
  const amount = dice.reduce((total, value) => total + value, potion.bonus);
  return {kind:'healing',amount,dice,bonus:potion.bonus,formula:potion.formula};
}
