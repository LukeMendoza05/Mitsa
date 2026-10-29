import type { ReactNode } from "react";
import s from "./preview.module.css";

export function PreviewDisclosure({ children = "Fictional figures, showing the workspace we’re building." }: { children?: ReactNode }) {
  return <p className={s.disclosure} data-preview-disclosure><span>Illustrative preview</span>{children}</p>;
}
