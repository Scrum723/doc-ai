/** Glanceable Echo Show card payload returned with every tool. */
export type GlanceCard = {
  headline: string;
  supporting: string;
  chip?: string;
  decision?: "yes" | "caution" | "no";
  action?: string;
  needsConfirm?: boolean;
};
