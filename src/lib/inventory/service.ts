import "server-only";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspaces";
import {
  categorySchema,
  productListItemSchema,
  productDetailSchema,
  dashboardSummarySchema,
  stockMovementSchema,
  birInventoryItemSchema,
  type Category,
  type ProductListItem,
  type ProductDetail,
  type DashboardSummary,
  type StockMovement,
  type BirInventoryItem,
  type PaymentMethod,
  type ProductUnit,
} from "./types";

export async function listCategories(workspaceSlug: string): Promise<Category[]> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_list_categories", {
    p_business: context.workspace.id,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load categories.");
  return z.array(categorySchema).parse(result.data);
}

export async function manageCategory(
  workspaceSlug: string,
  name: string,
  action: "create" | "update" | "toggle-active",
  categoryId?: string,
  sortOrder?: number
): Promise<{ id: string; name?: string }> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_manage_category", {
    p_business: context.workspace.id,
    p_name: name,
    p_action: action,
    p_category_id: categoryId ?? null,
    p_sort_order: sortOrder ?? 0,
  });
  if (result.error) throw new Error(result.error.message || "Failed to manage category.");
  return z.object({ id: z.string(), name: z.string().optional() }).parse(result.data);
}

export async function listProducts(
  workspaceSlug: string,
  options?: {
    shopId?: string;
    categoryId?: string;
    search?: string;
    activeOnly?: boolean;
  }
): Promise<ProductListItem[]> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_list_products", {
    p_business: context.workspace.id,
    p_shop: options?.shopId ?? null,
    p_category_id: options?.categoryId ?? null,
    p_search: options?.search ?? null,
    p_active_only: options?.activeOnly ?? true,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load products.");
  return z.array(productListItemSchema).parse(result.data);
}

export async function getProduct(
  workspaceSlug: string,
  productId: string
): Promise<ProductDetail> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_get_product", {
    p_business: context.workspace.id,
    p_product_id: productId,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load product.");
  return productDetailSchema.parse(result.data);
}

export async function createProduct(
  workspaceSlug: string,
  payload: {
    name: string;
    unit: ProductUnit;
    sellingPrice: number;
    costPrice?: number;
    categoryId?: string | null;
    sku?: string | null;
    barcode?: string | null;
    minStock?: number;
    trackBatches?: boolean;
    hazardClass?: string | null;
    unNumber?: string | null;
    description?: string | null;
  }
): Promise<{ id: string; displayCode: string; name: string }> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_create_product", {
    p_business: context.workspace.id,
    p_name: payload.name,
    p_unit: payload.unit,
    p_selling_price: payload.sellingPrice,
    p_cost_price: payload.costPrice ?? 0,
    p_category_id: payload.categoryId ?? null,
    p_sku: payload.sku ?? null,
    p_barcode: payload.barcode ?? null,
    p_min_stock: payload.minStock ?? 0,
    p_track_batches: payload.trackBatches ?? false,
    p_hazard_class: payload.hazardClass ?? null,
    p_un_number: payload.unNumber ?? null,
    p_description: payload.description ?? null,
  });
  if (result.error) throw new Error(result.error.message || "Failed to create product.");
  return z.object({ id: z.string(), displayCode: z.string(), name: z.string() }).parse(result.data);
}

export async function updateProduct(
  workspaceSlug: string,
  productId: string,
  payload: {
    name: string;
    unit: ProductUnit;
    sellingPrice: number;
    costPrice?: number;
    categoryId?: string | null;
    sku?: string | null;
    barcode?: string | null;
    minStock?: number;
    active?: boolean;
    hazardClass?: string | null;
    unNumber?: string | null;
    description?: string | null;
  }
): Promise<{ id: string; name: string }> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_update_product", {
    p_business: context.workspace.id,
    p_product_id: productId,
    p_name: payload.name,
    p_unit: payload.unit,
    p_selling_price: payload.sellingPrice,
    p_cost_price: payload.costPrice ?? 0,
    p_category_id: payload.categoryId ?? null,
    p_sku: payload.sku ?? null,
    p_barcode: payload.barcode ?? null,
    p_min_stock: payload.minStock ?? 0,
    p_active: payload.active ?? true,
    p_hazard_class: payload.hazardClass ?? null,
    p_un_number: payload.unNumber ?? null,
    p_description: payload.description ?? null,
  });
  if (result.error) throw new Error(result.error.message || "Failed to update product.");
  return z.object({ id: z.string(), name: z.string() }).parse(result.data);
}

export async function recordStockIn(
  workspaceSlug: string,
  shopId: string,
  items: Array<{
    productId: string;
    batchNumber?: string;
    expiryDate?: string;
    quantity: number;
    unitCost?: number;
  }>,
  reference?: string
): Promise<{ success: boolean; totalQuantity: number }> {
  const context = await workspaceContext(workspaceSlug);
  const commandKey = crypto.randomUUID();
  const result = await context.client.schema("api").rpc("mitsa_record_stock_in", {
    p_business: context.workspace.id,
    p_shop: shopId,
    p_items: items,
    p_reference: reference ?? null,
    p_key: commandKey,
  });
  if (result.error) throw new Error(result.error.message || "Failed to record stock in.");
  return z.object({ success: z.boolean(), totalQuantity: z.number() }).parse(result.data);
}

export async function recordSale(
  workspaceSlug: string,
  shopId: string,
  items: Array<{
    productId: string;
    batchId?: string;
    quantity: number;
    unitPrice: number;
  }>,
  payment: PaymentMethod,
  reference?: string
): Promise<{ total: number; totalQuantity: number; payment: string }> {
  const context = await workspaceContext(workspaceSlug);
  const commandKey = crypto.randomUUID();
  const result = await context.client.schema("api").rpc("mitsa_record_sale", {
    p_business: context.workspace.id,
    p_shop: shopId,
    p_items: items,
    p_payment: payment,
    p_reference: reference ?? null,
    p_key: commandKey,
  });
  if (result.error) throw new Error(result.error.message || "Failed to record sale.");
  return z
    .object({
      total: z.coerce.number(),
      totalQuantity: z.coerce.number(),
      payment: z.string(),
    })
    .parse(result.data);
}

export async function transferStock(
  workspaceSlug: string,
  fromShopId: string,
  toShopId: string,
  items: Array<{
    productId: string;
    batchId?: string;
    quantity: number;
  }>,
  reference?: string
): Promise<{ success: boolean; totalQuantity: number }> {
  const context = await workspaceContext(workspaceSlug);
  const commandKey = crypto.randomUUID();
  const result = await context.client.schema("api").rpc("mitsa_transfer_stock", {
    p_business: context.workspace.id,
    p_from_shop: fromShopId,
    p_to_shop: toShopId,
    p_items: items,
    p_reference: reference ?? null,
    p_key: commandKey,
  });
  if (result.error) throw new Error(result.error.message || "Failed to transfer stock.");
  return z.object({ success: z.boolean(), totalQuantity: z.number() }).parse(result.data);
}

export async function adjustStock(
  workspaceSlug: string,
  shopId: string,
  productId: string,
  newQuantity: number,
  reason: string,
  batchId?: string
): Promise<{ success: boolean; delta: number; newQuantity: number }> {
  const context = await workspaceContext(workspaceSlug);
  const commandKey = crypto.randomUUID();
  const result = await context.client.schema("api").rpc("mitsa_adjust_stock", {
    p_business: context.workspace.id,
    p_shop: shopId,
    p_product_id: productId,
    p_batch_id: batchId ?? null,
    p_new_quantity: newQuantity,
    p_reason: reason,
    p_key: commandKey,
  });
  if (result.error) throw new Error(result.error.message || "Failed to adjust stock.");
  return z
    .object({
      success: z.boolean(),
      delta: z.number(),
      newQuantity: z.number(),
    })
    .parse(result.data);
}

export async function getDashboardSummary(
  workspaceSlug: string,
  shopId?: string
): Promise<DashboardSummary> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_dashboard_summary", {
    p_business: context.workspace.id,
    p_shop: shopId ?? null,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load dashboard.");
  return dashboardSummarySchema.parse(result.data);
}

export async function getMovementHistory(
  workspaceSlug: string,
  options?: {
    shopId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<StockMovement[]> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_movement_history", {
    p_business: context.workspace.id,
    p_shop: options?.shopId ?? null,
    p_product_id: options?.productId ?? null,
    p_limit: options?.limit ?? 50,
    p_offset: options?.offset ?? 0,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load movement history.");
  return z.array(stockMovementSchema).parse(result.data);
}

export async function getBirInventoryReport(
  workspaceSlug: string,
  shopId?: string
): Promise<BirInventoryItem[]> {
  const context = await workspaceContext(workspaceSlug);
  const result = await context.client.schema("api").rpc("mitsa_inventory_report", {
    p_business: context.workspace.id,
    p_shop: shopId ?? null,
  });
  if (result.error) throw new Error(result.error.message || "Failed to load inventory report.");
  return z.array(birInventoryItemSchema).parse(result.data);
}
