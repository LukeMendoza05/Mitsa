"use server";

import { revalidatePath } from "next/cache";
import {
  createProduct,
  updateProduct,
  manageCategory,
  recordSale,
  recordStockIn,
  transferStock,
  adjustStock,
} from "@/lib/inventory/service";
import { productUnitSchema, paymentMethodSchema } from "@/lib/inventory/types";

export async function createProductAction(workspaceSlug: string, formData: FormData) {
  try {
    const name = String(formData.get("name") || "");
    const unit = productUnitSchema.parse(formData.get("unit"));
    const sellingPrice = Number(formData.get("sellingPrice") || 0);
    const costPrice = Number(formData.get("costPrice") || 0);
    const categoryId = String(formData.get("categoryId") || "") || null;
    const sku = String(formData.get("sku") || "") || null;
    const barcode = String(formData.get("barcode") || "") || null;
    const minStock = Number(formData.get("minStock") || 0);
    const trackBatches = formData.get("trackBatches") === "on";
    const hazardClass = String(formData.get("hazardClass") || "") || null;
    const unNumber = String(formData.get("unNumber") || "") || null;
    const description = String(formData.get("description") || "") || null;

    await createProduct(workspaceSlug, {
      name,
      unit,
      sellingPrice,
      costPrice,
      categoryId,
      sku,
      barcode,
      minStock,
      trackBatches,
      hazardClass,
      unNumber,
      description,
    });

    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create product" };
  }
}

export async function updateProductAction(
  workspaceSlug: string,
  productId: string,
  formData: FormData
) {
  try {
    const name = String(formData.get("name") || "");
    const unit = productUnitSchema.parse(formData.get("unit"));
    const sellingPrice = Number(formData.get("sellingPrice") || 0);
    const costPrice = Number(formData.get("costPrice") || 0);
    const categoryId = String(formData.get("categoryId") || "") || null;
    const sku = String(formData.get("sku") || "") || null;
    const barcode = String(formData.get("barcode") || "") || null;
    const minStock = Number(formData.get("minStock") || 0);
    const active = formData.get("active") === "on";
    const hazardClass = String(formData.get("hazardClass") || "") || null;
    const unNumber = String(formData.get("unNumber") || "") || null;
    const description = String(formData.get("description") || "") || null;

    await updateProduct(workspaceSlug, productId, {
      name,
      unit,
      sellingPrice,
      costPrice,
      categoryId,
      sku,
      barcode,
      minStock,
      active,
      hazardClass,
      unNumber,
      description,
    });

    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products/${productId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update product" };
  }
}

export async function createCategoryAction(workspaceSlug: string, formData: FormData) {
  try {
    const name = String(formData.get("name") || "");
    const sortOrder = Number(formData.get("sortOrder") || 0);
    await manageCategory(workspaceSlug, name, "create", undefined, sortOrder);

    revalidatePath(`/w/${workspaceSlug}/inventory/categories`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create category" };
  }
}

export async function recordSaleAction(
  workspaceSlug: string,
  shopId: string,
  items: Array<{ productId: string; batchId?: string; quantity: number; unitPrice: number }>,
  payment: string,
  reference?: string
) {
  try {
    const validPayment = paymentMethodSchema.parse(payment);
    const res = await recordSale(workspaceSlug, shopId, items, validPayment, reference);
    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    revalidatePath(`/w/${workspaceSlug}/inventory/movements`);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to record sale" };
  }
}

export async function recordStockInAction(
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
) {
  try {
    const res = await recordStockIn(workspaceSlug, shopId, items, reference);
    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    revalidatePath(`/w/${workspaceSlug}/inventory/movements`);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to record stock in" };
  }
}

export async function transferStockAction(
  workspaceSlug: string,
  fromShopId: string,
  toShopId: string,
  items: Array<{ productId: string; batchId?: string; quantity: number }>,
  reference?: string
) {
  try {
    const res = await transferStock(workspaceSlug, fromShopId, toShopId, items, reference);
    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    revalidatePath(`/w/${workspaceSlug}/inventory/movements`);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to transfer stock" };
  }
}

export async function adjustStockAction(
  workspaceSlug: string,
  shopId: string,
  productId: string,
  newQuantity: number,
  reason: string,
  batchId?: string
) {
  try {
    const res = await adjustStock(workspaceSlug, shopId, productId, newQuantity, reason, batchId);
    revalidatePath(`/w/${workspaceSlug}/inventory`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products`);
    revalidatePath(`/w/${workspaceSlug}/inventory/products/${productId}`);
    revalidatePath(`/w/${workspaceSlug}/inventory/movements`);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to adjust stock" };
  }
}
