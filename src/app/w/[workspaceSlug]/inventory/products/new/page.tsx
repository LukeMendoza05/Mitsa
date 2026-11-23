import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listCategories } from "@/lib/inventory/service";
import { ProductForm } from "@/components/inventory/ProductForm";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "New Fireworks Product — Mitsa" };

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const categories = await listCategories(workspace.slug);

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Add Fireworks Product</h2>
        <p>Register a new pyrotechnic item into your business catalog.</p>
      </div>

      <ProductForm workspaceSlug={workspace.slug} categories={categories} />
    </WorkspaceShell>
  );
}
