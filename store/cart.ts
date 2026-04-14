"use client";

import { create } from "zustand";

export type LocalizedString = { fr: string; ar: string; en: string };

export type CartOptionChoice = {
  optionId: number;
  optionName: LocalizedString;
  extraPrice: number;
};

export type CartEntry = {
  cartId: string;
  itemId: number;
  itemName: LocalizedString;
  itemImage: string;
  basePrice: number;
  quantity: number;
  chosenOptions: CartOptionChoice[];
};

function makeCartId(itemId: number, optionIds: number[]): string {
  return `${itemId}-${[...optionIds].sort((a, b) => a - b).join("_")}`;
}

function entryTotal(entry: CartEntry): number {
  const optionsTotal = entry.chosenOptions.reduce(
    (sum, o) => sum + o.extraPrice,
    0,
  );
  return (entry.basePrice + optionsTotal) * entry.quantity;
}

type CartStore = {
  entries: CartEntry[];
  addEntry: (
    entry: Omit<CartEntry, "cartId"> & { optionIds: number[] },
  ) => void;
  removeEntry: (cartId: string) => void;
  setQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  entries: [],

  addEntry: ({ optionIds, ...rest }) => {
    const cartId = makeCartId(rest.itemId, optionIds);
    set((state) => {
      const existing = state.entries.find((e) => e.cartId === cartId);
      if (existing) {
        return {
          entries: state.entries.map((e) =>
            e.cartId === cartId
              ? { ...e, quantity: e.quantity + rest.quantity }
              : e,
          ),
        };
      }
      return { entries: [...state.entries, { ...rest, cartId }] };
    });
  },

  removeEntry: (cartId) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.cartId !== cartId),
    })),

  setQuantity: (cartId, quantity) => {
    if (quantity < 1) return;
    set((state) => ({
      entries: state.entries.map((e) =>
        e.cartId === cartId ? { ...e, quantity } : e,
      ),
    }));
  },

  clearCart: () => set({ entries: [] }),

  totalCount: () => get().entries.reduce((sum, e) => sum + e.quantity, 0),

  totalPrice: () => get().entries.reduce((sum, e) => sum + entryTotal(e), 0),
}));

export { entryTotal };
