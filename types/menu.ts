export type LocalizedString = { fr: string; ar: string; en: string };

export type MenuOption = {
  id: number;
  groupId: number;
  name: LocalizedString;
  extraPrice: number;
};

export type MenuOptionGroup = {
  id: number;
  itemId: number;
  name: LocalizedString;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  freeSelections: number;
  options: MenuOption[];
  visibilityCondition: { groupFr: string; optionFr: string } | null;
};

export type MenuItem = {
  id: number;
  categoryId: number;
  name: LocalizedString;
  description: LocalizedString;
  price: number;
  imageUrl: string;
  available: boolean;
  sortOrder: number;
  optionGroups: MenuOptionGroup[];
};

export type MenuCategory = {
  id: number;
  name: LocalizedString;
  /** Background image for category navigation cards. */
  imageUrl: string;
  sortOrder: number;
  items: MenuItem[];
};
