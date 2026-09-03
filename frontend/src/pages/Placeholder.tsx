import { EmptyState, PageHeader } from "@/components/ui/states";

/**
 * Days 7–9 replace these with the real pages. Until then a route has to render
 * *something*, and an honest "not built yet" is better than a blank div: it
 * proves the route, the guard, and the shell all work, and it does not look like
 * a page that failed to load.
 */
export const Placeholder = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col gap-6">
    <PageHeader eyebrow={eyebrow} title={title} />
    <EmptyState icon="empty" title="Not built yet" description={description} />
  </div>
);
