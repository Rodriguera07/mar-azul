import { Ionicons } from '@expo/vector-icons';
import { ImageSourcePropType } from 'react-native';
import { MenuCategory, MenuItem } from '../types';

// Catálogo padrão / semente: usado como cardápio inicial de qualquer
// organização (antes de o admin salvar sua própria edição no Firestore) e
// como fonte das imagens dos itens originais — itens criados pelo admin na
// tela de Cardápio não têm imagem (mostram o ícone da categoria).
// Versão da tabela do catálogo padrão, gravada junto com o cardápio salvo de
// cada organização (ver `upgradeSavedMenu`):
//   1 = tabela original
//   2 = tabela de novembro/2026 (cardápio impresso novo)
//   3 = dois cardápios (novo e antigo) e a Porção de Porquinho retirada
export const PRICE_TABLE_VERSION = 3;

// Dois cardápios padrão: o admin escolhe na tela de Cardápio com qual a casa
// vai trabalhar. A escolha é salva junto com o cardápio da organização.
export type MenuCatalog = 'novo' | 'antigo';
export const DEFAULT_MENU_CATALOG: MenuCatalog = 'novo';
export const MENU_CATALOG_LABELS: Record<MenuCatalog, string> = {
  novo: 'Cardápio novo',
  antigo: 'Cardápio antigo',
};

export function asMenuCatalog(value: unknown): MenuCatalog {
  return value === 'antigo' ? 'antigo' : 'novo';
}

// Itens que saíram do cardápio da casa (em qualquer um dos dois). São
// retirados também dos cardápios já salvos pelas organizações.
//   por-3 / por-4 = Porção de Porquinho (G/M)
export const REMOVED_DEFAULT_IDS = new Set(['por-3', 'por-4']);

// Cardápio novo (impresso em novembro/2026).
const RAW_MENU_ITEMS: MenuItem[] = [
  // Bebidas
  { id: 'beb-1', category: 'bebidas', name: 'Refrigerante Lata', price: 9, image: require('../../assets/menu/beb-refrigerante.jpg') },
  { id: 'beb-2', category: 'bebidas', name: 'Suco Natural com Água', price: 18, image: require('../../assets/menu/beb-suco-agua.jpg') },
  { id: 'beb-3', category: 'bebidas', name: 'Suco Natural com Leite', price: 22, image: require('../../assets/menu/beb-suco-leite.jpg') },
  { id: 'beb-4', category: 'bebidas', name: 'Água Mineral Sem Gás', price: 5, image: require('../../assets/menu/beb-agua.jpg') },
  { id: 'beb-5', category: 'bebidas', name: 'Água Mineral Com Gás', price: 7, image: require('../../assets/menu/beb-agua-gas.jpg') },
  { id: 'beb-6', category: 'bebidas', name: 'Cerveja Pilsen (350ml)', price: 8, image: require('../../assets/menu/beb-pilsen.jpg') },
  { id: 'beb-7', category: 'bebidas', name: 'Cerveja Puro Malte (350ml)', price: 11, image: require('../../assets/menu/beb-puro-malte.jpg') },
  { id: 'beb-8', category: 'bebidas', name: 'Cerveja Heineken (350ml)', price: 10, image: require('../../assets/menu/beb-heineken.jpg') },
  { id: 'beb-9', category: 'bebidas', name: 'Cerveja Brahma Sem Álcool', price: 11, image: require('../../assets/menu/beb-brahma-zero.jpg') },
  { id: 'beb-10', category: 'bebidas', name: 'Cerveja Heineken Sem Álcool', price: 11, image: require('../../assets/menu/beb-heineken-zero.jpg') },
  { id: 'beb-11', category: 'bebidas', name: 'Suco Natural com Água (2 Frutas)', price: 23, image: require('../../assets/menu/beb-suco-2frutas-agua.jpg') },
  { id: 'beb-12', category: 'bebidas', name: 'Suco Natural com Leite (2 Frutas)', price: 28, image: require('../../assets/menu/beb-suco-2frutas-leite.jpg') },
  { id: 'beb-13', category: 'bebidas', name: 'Cerveja Amstel (350ml)', price: 8, image: require('../../assets/menu/beb-amstel.jpg') },
  { id: 'beb-14', category: 'bebidas', name: 'Gelo de Coco', price: 10, image: require('../../assets/menu/gelo-de-coco.webp') },

  // Drinks
  { id: 'dri-1', category: 'drinks', name: 'Caipirinha (1 Fruta) - Pinga', price: 28, image: require('../../assets/menu/dri-caip-pinga-1.jpg') },
  { id: 'dri-2', category: 'drinks', name: 'Caipirinha (1 Fruta) - Vodka', price: 33, image: require('../../assets/menu/dri-caip-vodka-1.jpg') },
  { id: 'dri-3', category: 'drinks', name: 'Caipirinha (1 Fruta) - Saquê', price: 33, image: require('../../assets/menu/dri-caip-saque-1.jpg') },
  { id: 'dri-4', category: 'drinks', name: 'Caipirinha (2 Frutas) - Pinga', price: 33, image: require('../../assets/menu/dri-caip-pinga-2.jpg') },
  { id: 'dri-5', category: 'drinks', name: 'Caipirinha (2 Frutas) - Vodka', price: 35, image: require('../../assets/menu/dri-caip-vodka-2.jpg') },
  { id: 'dri-6', category: 'drinks', name: 'Caipirinha (2 Frutas) - Saquê', price: 35, image: require('../../assets/menu/dri-caip-saque-2.jpg') },
  { id: 'dri-7', category: 'drinks', name: 'Batida', price: 35, image: require('../../assets/menu/dri-batida.jpg') },
  { id: 'dri-8', category: 'drinks', name: 'Espanhola', price: 35, image: require('../../assets/menu/dri-espanhola.jpg') },
  { id: 'dri-9', category: 'drinks', name: 'Batida (2 Frutas)', price: 35, image: require('../../assets/menu/dri-batida-2.jpg') },

  // Doses e Energéticos
  { id: 'dos-1', category: 'doses', name: 'Dose - Cachaça 51', price: 7, image: require('../../assets/menu/dos-cachaca51.jpg') },
  { id: 'dos-2', category: 'doses', name: 'Dose - Velho Barreiro', price: 7, image: require('../../assets/menu/dos-velho-barreiro.jpg') },
  { id: 'dos-3', category: 'doses', name: 'Dose - Ypióca', price: 10, image: require('../../assets/menu/dos-ypioca.jpg') },
  { id: 'dos-4', category: 'doses', name: 'Dose - Dreher', price: 10, image: require('../../assets/menu/dos-dreher.jpg') },
  { id: 'dos-5', category: 'doses', name: 'Dose - Contini', price: 10, image: require('../../assets/menu/dos-contini.jpg') },
  { id: 'dos-6', category: 'doses', name: 'Dose - Campari', price: 15, image: require('../../assets/menu/dos-campari.jpg') },
  { id: 'dos-10', category: 'doses', name: 'Dose - Maria Mole', price: 15, image: require('../../assets/menu/dos-maria-mole.jpg') },
  { id: 'dos-7', category: 'doses', name: 'Dose - Whisky', price: 30, image: require('../../assets/menu/dos-whisky.jpg') },
  { id: 'dos-8', category: 'doses', name: 'Dose - Whisky 12 Anos', price: 50, image: require('../../assets/menu/dos-whisky-12.jpg') },
  { id: 'dos-9', category: 'doses', name: 'Energético Red Bull', price: 20, image: require('../../assets/menu/dos-energetico.jpg') },

  // Porções
  { id: 'por-1', category: 'porcoes', name: 'Porção de Camarão (G)', price: 130, image: require('../../assets/menu/camarao.jpg') },
  { id: 'por-2', category: 'porcoes', name: 'Porção de Camarão (M)', price: 110, image: require('../../assets/menu/camarao.jpg') },
  { id: 'por-5', category: 'porcoes', name: 'Porção de Filé de Pescada (Isca) (G)', price: 130, image: require('../../assets/menu/porcao-iscas.jpg') },
  { id: 'por-6', category: 'porcoes', name: 'Porção de Filé de Pescada (Isca) (M)', price: 110, image: require('../../assets/menu/porcao-iscas.jpg') },
  { id: 'por-7', category: 'porcoes', name: 'Porção de Cação (G)', price: 130, image: require('../../assets/menu/porcao-cacao.jpg') },
  { id: 'por-8', category: 'porcoes', name: 'Porção de Cação (M)', price: 110, image: require('../../assets/menu/porcao-cacao.jpg') },
  { id: 'por-9', category: 'porcoes', name: 'Porção de Lula à Dorê (G)', price: 160, image: require('../../assets/menu/porcao-lula.jpg') },
  { id: 'por-10', category: 'porcoes', name: 'Porção Mista', description: 'Até 3 ingredientes, menos Lula', price: 220, image: require('../../assets/menu/porcao-mista.jpg') },
  { id: 'por-11', category: 'porcoes', name: 'Porção de Cebola', price: 40, image: require('../../assets/menu/porcao-cebola.jpg') },
  { id: 'por-12', category: 'porcoes', name: 'Porção de Calabresa', price: 60, image: require('../../assets/menu/porcao-calabresa.jpg') },
  { id: 'por-13', category: 'porcoes', name: 'Porção de Frango a Passarinho', price: 70, image: require('../../assets/menu/por-frango.jpg') },
  { id: 'por-14', category: 'porcoes', name: 'Porção de Batata Frita Tradicional', price: 60, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-15', category: 'porcoes', name: 'Porção de Batata Frita com Cheddar/Catupiry', price: 70, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-16', category: 'porcoes', name: 'Porção de Mandioca Frita', price: 60, image: require('../../assets/menu/porcao-mandioca.jpg') },
  { id: 'por-17', category: 'porcoes', name: 'Porção de Polenta Frita', price: 60, image: require('../../assets/menu/por-polenta.jpg') },
  { id: 'por-18', category: 'porcoes', name: 'Porção de Batata Frita (M)', price: 35, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-19', category: 'porcoes', name: 'Porção de Batata Frita com Cheddar/Catupiry (M)', price: 45, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-20', category: 'porcoes', name: 'Porção de Calabresa (M)', price: 35, image: require('../../assets/menu/porcao-calabresa.jpg') },
  { id: 'por-21', category: 'porcoes', name: 'Porção de Polenta (M)', price: 35, image: require('../../assets/menu/por-polenta.jpg') },
  { id: 'por-22', category: 'porcoes', name: 'Porção de Mandioca (M)', price: 35, image: require('../../assets/menu/porcao-mandioca.jpg') },

  // Pastéis
  { id: 'pas-1', category: 'pasteis', name: 'Porção de Mini Pastel (12 unidades)', description: 'Sabores: carne, queijo, calabresa', price: 70, image: require('../../assets/menu/pastel.jpg') },
  {
    id: 'pas-2',
    category: 'pasteis',
    name: 'Pastel Individual (1 recheio)',
    description: 'Sabores: calabresa, queijo, carne, pizza',
    price: 25,
    image: require('../../assets/menu/pastel.jpg'),
  },
  {
    id: 'pas-3',
    category: 'pasteis',
    name: 'Pastel Individual (2 recheios)',
    description: 'Calabresa c/ queijo, carne c/ queijo, calabresa c/ catupiry',
    price: 30,
    image: require('../../assets/menu/pastel.jpg'),
  },
  { id: 'pas-4', category: 'pasteis', name: 'Pastel de Camarão', price: 25, image: require('../../assets/menu/pastel.jpg') },
];

// Cardápio antigo (impresso anterior). Os itens que também existem no
// cardápio novo usam o MESMO id — assim a foto é a mesma e os relatórios
// ("mais vendidos", histórico) somam o produto dos dois cardápios juntos.
// No cardápio antigo as porções eram "Inteira" e "Meia".
const RAW_OLD_MENU_ITEMS: MenuItem[] = [
  // Bebidas
  { id: 'beb-1', category: 'bebidas', name: 'Refrigerante Lata / Tônica', price: 8, image: require('../../assets/menu/beb-refrigerante.jpg') },
  { id: 'beb-2', category: 'bebidas', name: 'Suco Natural com Água', description: 'Consulte o sabor', price: 15, image: require('../../assets/menu/beb-suco-agua.jpg') },
  { id: 'beb-3', category: 'bebidas', name: 'Suco Natural com Leite', description: 'Consulte o sabor', price: 18, image: require('../../assets/menu/beb-suco-leite.jpg') },
  { id: 'beb-4', category: 'bebidas', name: 'Água Mineral Sem Gás', price: 4, image: require('../../assets/menu/beb-agua.jpg') },
  { id: 'beb-5', category: 'bebidas', name: 'Água Mineral Com Gás', price: 5, image: require('../../assets/menu/beb-agua-gas.jpg') },
  { id: 'beb-6', category: 'bebidas', name: 'Cerveja Pilsen (350ml)', price: 7, image: require('../../assets/menu/beb-pilsen.jpg') },
  { id: 'beb-7', category: 'bebidas', name: 'Cerveja Puro Malte (350ml)', price: 8, image: require('../../assets/menu/beb-puro-malte.jpg') },
  { id: 'beb-8', category: 'bebidas', name: 'Cerveja Heineken (350ml)', price: 10, image: require('../../assets/menu/beb-heineken.jpg') },
  { id: 'beb-9', category: 'bebidas', name: 'Cerveja Brahma Sem Álcool', price: 8, image: require('../../assets/menu/beb-brahma-zero.jpg') },
  { id: 'beb-10', category: 'bebidas', name: 'Cerveja Heineken Sem Álcool', price: 11, image: require('../../assets/menu/beb-heineken-zero.jpg') },

  // Drinks
  { id: 'dri-1', category: 'drinks', name: 'Caipirinha (1 Fruta) - Pinga', price: 23, image: require('../../assets/menu/dri-caip-pinga-1.jpg') },
  { id: 'dri-2', category: 'drinks', name: 'Caipirinha (1 Fruta) - Vodka', price: 28, image: require('../../assets/menu/dri-caip-vodka-1.jpg') },
  { id: 'dri-3', category: 'drinks', name: 'Caipirinha (1 Fruta) - Saquê', price: 28, image: require('../../assets/menu/dri-caip-saque-1.jpg') },
  { id: 'dri-4', category: 'drinks', name: 'Caipirinha (2 Frutas) - Pinga', price: 28, image: require('../../assets/menu/dri-caip-pinga-2.jpg') },
  { id: 'dri-5', category: 'drinks', name: 'Caipirinha (2 Frutas) - Vodka', price: 33, image: require('../../assets/menu/dri-caip-vodka-2.jpg') },
  { id: 'dri-6', category: 'drinks', name: 'Caipirinha (2 Frutas) - Saquê', price: 33, image: require('../../assets/menu/dri-caip-saque-2.jpg') },
  { id: 'dri-7', category: 'drinks', name: 'Batida', price: 30, image: require('../../assets/menu/dri-batida.jpg') },
  { id: 'dri-8', category: 'drinks', name: 'Espanhola', price: 30, image: require('../../assets/menu/dri-espanhola.jpg') },

  // Doses e Energéticos
  { id: 'dos-1', category: 'doses', name: 'Dose - Cachaça 51', price: 5, image: require('../../assets/menu/dos-cachaca51.jpg') },
  { id: 'dos-2', category: 'doses', name: 'Dose - Velho Barreiro', price: 5, image: require('../../assets/menu/dos-velho-barreiro.jpg') },
  { id: 'dos-3', category: 'doses', name: 'Dose - Ypióca', price: 10, image: require('../../assets/menu/dos-ypioca.jpg') },
  { id: 'dos-4', category: 'doses', name: 'Dose - Dreher', price: 10, image: require('../../assets/menu/dos-dreher.jpg') },
  { id: 'dos-5', category: 'doses', name: 'Dose - Contini', price: 10, image: require('../../assets/menu/dos-contini.jpg') },
  { id: 'dos-6', category: 'doses', name: 'Dose - Campari', price: 15, image: require('../../assets/menu/dos-campari.jpg') },
  { id: 'dos-7', category: 'doses', name: 'Dose - Whisky 8 Anos', price: 40, image: require('../../assets/menu/dos-whisky.jpg') },
  { id: 'dos-8', category: 'doses', name: 'Dose - Whisky 12 Anos', price: 50, image: require('../../assets/menu/dos-whisky-12.jpg') },
  { id: 'dos-9', category: 'doses', name: 'Energético Red Bull', price: 20, image: require('../../assets/menu/dos-energetico.jpg') },

  // Porções
  { id: 'por-1', category: 'porcoes', name: 'Porção de Camarão (Inteira)', price: 100, image: require('../../assets/menu/camarao.jpg') },
  { id: 'por-2', category: 'porcoes', name: 'Porção de Camarão (Meia)', price: 80, image: require('../../assets/menu/camarao.jpg') },
  { id: 'por-5', category: 'porcoes', name: 'Porção de Filé de Pescada (Isca) (Inteira)', price: 100, image: require('../../assets/menu/porcao-iscas.jpg') },
  { id: 'por-6', category: 'porcoes', name: 'Porção de Filé de Pescada (Isca) (Meia)', price: 80, image: require('../../assets/menu/porcao-iscas.jpg') },
  { id: 'por-7', category: 'porcoes', name: 'Porção de Cação (Inteira)', price: 100, image: require('../../assets/menu/porcao-cacao.jpg') },
  { id: 'por-8', category: 'porcoes', name: 'Porção de Cação (Meia)', price: 80, image: require('../../assets/menu/porcao-cacao.jpg') },
  { id: 'por-9', category: 'porcoes', name: 'Porção de Lula à Dorê Nacional', price: 150, image: require('../../assets/menu/porcao-lula.jpg') },
  { id: 'por-10', category: 'porcoes', name: 'Porção Mista', price: 190, image: require('../../assets/menu/porcao-mista.jpg') },
  { id: 'por-11', category: 'porcoes', name: 'Porção de Cebola', price: 30, image: require('../../assets/menu/porcao-cebola.jpg') },
  { id: 'por-12', category: 'porcoes', name: 'Porção de Calabresa', price: 55, image: require('../../assets/menu/porcao-calabresa.jpg') },
  { id: 'por-13', category: 'porcoes', name: 'Porção de Frango à Passarinho', price: 60, image: require('../../assets/menu/por-frango.jpg') },
  { id: 'por-14', category: 'porcoes', name: 'Porção de Batata Frita', price: 55, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-15', category: 'porcoes', name: 'Porção de Batata Frita com Cheddar/Catupiry', price: 65, image: require('../../assets/menu/batata.jpg') },
  { id: 'por-16', category: 'porcoes', name: 'Porção de Mandioca Frita', price: 55, image: require('../../assets/menu/porcao-mandioca.jpg') },
  { id: 'por-17', category: 'porcoes', name: 'Porção de Polenta Frita', price: 60, image: require('../../assets/menu/por-polenta.jpg') },

  // Pastéis
  { id: 'pas-1', category: 'pasteis', name: 'Porção de Mini Pastel (12 unidades)', description: 'Sabores: queijo, carne, frango', price: 60, image: require('../../assets/menu/pastel.jpg') },
  {
    id: 'pas-2',
    category: 'pasteis',
    name: 'Pastel Individual (1 recheio)',
    description: 'Sabores: carne, queijo, frango, calabresa, bauru',
    price: 20,
    image: require('../../assets/menu/pastel.jpg'),
  },
  {
    id: 'pas-3',
    category: 'pasteis',
    name: 'Pastel Individual (2 recheios)',
    description: 'Carne c/ queijo, calabresa c/ queijo',
    price: 25,
    image: require('../../assets/menu/pastel.jpg'),
  },
  { id: 'pas-4', category: 'pasteis', name: 'Pastel de Camarão', price: 25, image: require('../../assets/menu/pastel.jpg') },
];

export const CATEGORY_LABELS: Record<string, string> = {
  bebidas: 'Bebidas',
  drinks: 'Drinks',
  doses: 'Doses & Energéticos',
  porcoes: 'Porções',
  pasteis: 'Pastéis',
};

export const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bebidas: 'beer-outline',
  drinks: 'wine-outline',
  doses: 'flask-outline',
  porcoes: 'restaurant-outline',
  pasteis: 'fast-food-outline',
};

// "Porção" já é o título da seção — repeti-lo em cada nome ("Porção de
// Camarão") é redundante, então tiramos o prefixo e mostramos só "Camarão".
// Um nome que era só "Porção" (sem dizer de quê) vira string vazia e é
// descartado: era digitação incompleta, nunca um prato de verdade.
function stripPortionPrefix(name: string): string {
  return name.replace(/^por[cç][aã]o(\s+de)?\s*/i, '').trim();
}

export function normalizePortionItems<T extends { category: MenuCategory; name: string }>(
  items: T[]
): T[] {
  return items
    .map((item) => (item.category === 'porcoes' ? { ...item, name: stripPortionPrefix(item.name) } : item))
    .filter((item) => !(item.category === 'porcoes' && item.name === ''));
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as MenuCategory[];

// Agrupado por seção (na mesma ordem das abas/categorias) e, dentro de cada
// seção, em ordem alfabética — usado sempre que o cardápio é lido (padrão ou
// salvo pela organização), pra não depender da ordem em que os itens foram
// cadastrados/editados.
export function sortMenuItems<T extends { category: MenuCategory; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff !== 0) return categoryDiff;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });
}

export const DEFAULT_MENU_ITEMS: MenuItem[] = sortMenuItems(normalizePortionItems(RAW_MENU_ITEMS));
export const OLD_MENU_ITEMS: MenuItem[] = sortMenuItems(normalizePortionItems(RAW_OLD_MENU_ITEMS));

export function catalogItems(catalog: MenuCatalog): MenuItem[] {
  return catalog === 'antigo' ? OLD_MENU_ITEMS : DEFAULT_MENU_ITEMS;
}

// ids de TODOS os itens padrão (dos dois cardápios, inclusive os retirados):
// o que não estiver aqui foi criado pelo admin na tela de Cardápio.
const ALL_DEFAULT_IDS = new Set([
  ...DEFAULT_MENU_ITEMS.map((i) => i.id),
  ...OLD_MENU_ITEMS.map((i) => i.id),
  ...REMOVED_DEFAULT_IDS,
]);

export function isCustomMenuItem(id: string): boolean {
  return !ALL_DEFAULT_IDS.has(id);
}

// Fotos por id, dos dois cardápios (os itens comuns têm a mesma foto).
export const DEFAULT_IMAGE_BY_ID: Record<string, ImageSourcePropType> = Object.fromEntries(
  [...OLD_MENU_ITEMS, ...DEFAULT_MENU_ITEMS]
    .filter((item) => item.image)
    .map((item) => [item.id, item.image as ImageSourcePropType])
);

export function withoutRemovedItems<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => !REMOVED_DEFAULT_IDS.has(item.id));
}

// Troca de cardápio: os itens padrão passam a ser exatamente os do cardápio
// escolhido (nomes, descrições e preços dele) e os itens que o admin criou por
// conta própria continuam como estão.
export function buildCatalogMenu(current: MenuItem[], catalog: MenuCatalog): MenuItem[] {
  const custom = current.filter((item) => isCustomMenuItem(item.id));
  return sortMenuItems([...catalogItems(catalog), ...custom]);
}

// Aplica a tabela do cardápio escolhido sobre o cardápio já salvo: itens
// padrão existentes recebem o nome, a categoria, a descrição e o preço da
// tabela (a imagem continua a do catálogo), itens padrão que faltam são
// adicionados, itens retirados da casa saem, e itens que o admin criou por
// conta própria não são tocados. Usado pelo botão "Restaurar preços" na tela
// de Cardápio — o resultado só vale depois de "Salvar".
export function applyDefaultPrices(
  current: MenuItem[],
  catalog: MenuCatalog = DEFAULT_MENU_CATALOG
): { items: MenuItem[]; changed: number; added: number; removed: number } {
  const kept = withoutRemovedItems(current);
  const removed = current.length - kept.length;
  const byId = new Map(kept.map((item) => [item.id, item]));
  let changed = 0;
  let added = 0;
  const merged = [...kept];

  for (const base of catalogItems(catalog)) {
    const existing = byId.get(base.id);
    if (!existing) {
      merged.push(base);
      added += 1;
      continue;
    }
    const next: MenuItem = {
      ...existing,
      name: base.name,
      category: base.category,
      price: base.price,
      description: base.description,
      image: base.image ?? existing.image,
    };
    if (
      existing.name !== next.name ||
      existing.category !== next.category ||
      existing.price !== next.price ||
      existing.description !== next.description
    ) {
      changed += 1;
      merged[merged.indexOf(existing)] = next;
    }
  }

  return { items: sortMenuItems(merged), changed, added, removed };
}

// Atualiza um cardápio salvo numa versão antiga da tabela. Só quem ainda
// estava na tabela original (versão < 2) recebe a tabela inteira de novo; para
// os demais, apenas os itens retirados da casa (Porquinho) saem — sem desfazer
// preços que o admin já ajustou.
export function upgradeSavedMenu(items: MenuItem[], version: number, catalog: MenuCatalog): MenuItem[] {
  if (version < 2) return applyDefaultPrices(items, catalog).items;
  return sortMenuItems(withoutRemovedItems(items));
}
