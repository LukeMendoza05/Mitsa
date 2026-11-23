import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listCategories } from "@/lib/inventory/service";
import { CategoryManager } from "@/components/inventory/CategoryManager";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Product Categories — Mitsa" };

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const categories = await listCategories(workspace.slug);

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Product Categories</h2>
        <p>Organize pyrotechnics, fountains, aerial cakes, and sparklers into logical product groupings.</p>
      </div>

      <CategoryManager workspaceSlug={workspace.slug} categories={categories} />
    </WorkspaceShell>
  );
}
