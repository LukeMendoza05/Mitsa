import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getProduct, listCategories } from "@/lib/inventory/service";
import { ProductForm } from "@/components/inventory/ProductForm";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Edit Product — Mitsa" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; productId: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const { workspaceSlug, productId } = await params;

  let product;
  try {
    product = await getProduct(workspaceSlug, productId);
  } catch {
    notFound();
  }

  const categories = await listCategories(workspaceSlug);

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Edit {product.name}</h2>
        <p>Update pricing, unit of measure, minimum stock alerts, and safety classification.</p>
      </div>

      <ProductForm
        workspaceSlug={workspace.slug}
        categories={categories}
        product={product}
      />
    </WorkspaceShell>
  );
}
