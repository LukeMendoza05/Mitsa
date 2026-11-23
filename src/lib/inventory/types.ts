import { z } from "zod";

export const productUnitSchema = z.enum([
  "pc",
  "box",
  "pack",
  "case",
  "kg",
  "g",
  "roll",
  "set",
  "bundle",
  "tube",
  "shot",
]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

export const productUnitLabels: Record<ProductUnit, string> = {
  pc: "Piece (pc)",
  box: "Box",
  pack: "Pack",
  case: "Case",
  bundle: "Bundle",
  roll: "Roll",
  set: "Set",
  tube: "Mortar Tube",
  shot: "Shot (Cake)",
  kg: "Kilogram (kg)",
  g: "Gram (g)",
};

export const hazardClassSchema = z
  .enum(["1.1G", "1.2G", "1.3G", "1.4G", "1.4S"])
  .nullable();
export type HazardClass = z.infer<typeof hazardClassSchema>;

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
  active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  displayCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  unit: productUnitSchema,
  sellingPrice: z.coerce.number(),
  costPrice: z.coerce.number(),
  minStock: z.coerce.number(),
  trackBatches: z.boolean(),
  hazardClass: hazardClassSchema,
  unNumber: z.string().nullable(),
  isProhibited: z.boolean(),
  active: z.boolean(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  stockQuantity: z.coerce.number(),
});
export type ProductListItem = z.infer<typeof productListItemSchema>;

export const productLocationStockSchema = z.object({
  shopId: z.string().uuid(),
  shopName: z.string(),
  shopKind: z.enum(["shop", "warehouse"]),
  quantity: z.coerce.number(),
});
export type ProductLocationStock = z.infer<typeof productLocationStockSchema>;

export const batchItemSchema = z.object({
  id: z.string().uuid(),
  batchNumber: z.string(),
  manufactureDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  status: z.enum(["active", "expired", "recalled", "disposed"]),
  quantity: z.coerce.number(),
});
export type BatchItem = z.infer<typeof batchItemSchema>;

export const productDetailSchema = productListItemSchema.extend({
  totalQuantity: z.coerce.number(),
  locations: z.array(productLocationStockSchema),
  batches: z.array(batchItemSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const dashboardSummarySchema = z.object({
  todaySales: z.coerce.number(),
  todayTransactions: z.coerce.number(),
  todayItemsSold: z.coerce.number(),
  activeAlerts: z.coerce.number(),
  totalProducts: z.coerce.number(),
  totalStockValue: z.coerce.number(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const movementTypeSchema = z.enum([
  "stock_in",
  "sale",
  "transfer_out",
  "transfer_in",
  "adjustment",
  "return",
  "disposal",
]);
export type MovementType = z.infer<typeof movementTypeSchema>;

export const movementTypeLabels: Record<MovementType, { label: string; sign: "+" | "-" | "±" }> = {
  stock_in: { label: "Stock In", sign: "+" },
  sale: { label: "Sale", sign: "-" },
  transfer_out: { label: "Transfer Out", sign: "-" },
  transfer_in: { label: "Transfer In", sign: "+" },
  adjustment: { label: "Adjustment", sign: "±" },
  return: { label: "Customer Return", sign: "+" },
  disposal: { label: "Disposal / Scrap", sign: "-" },
};

export const paymentMethodSchema = z.enum(["cash", "gcash", "maya", "bank", "credit"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank Transfer",
  credit: "Store Credit / Utang",
};

export const stockMovementSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  movementType: movementTypeSchema,
  quantity: z.number(),
  productName: z.string(),
  productCode: z.string(),
  unit: z.string(),
  shopId: z.string().uuid(),
  shopName: z.string(),
  unitPrice: z.coerce.number().nullable(),
  totalAmount: z.coerce.number().nullable(),
  paymentMethod: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  batchNumber: z.string().nullable(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const birInventoryItemSchema = z.object({
  displayCode: z.string(),
  productName: z.string(),
  category: z.string(),
  unit: z.string(),
  quantityOnHand: z.coerce.number(),
  unitCost: z.coerce.number(),
  totalCost: z.coerce.number(),
  unitPrice: z.coerce.number(),
  totalRetailValue: z.coerce.number(),
});
export type BirInventoryItem = z.infer<typeof birInventoryItemSchema>;
