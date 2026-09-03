import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { listProjects } from "@/lib/projectsApi";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/states";
import { EnvironmentMap } from "@/components/environments/EnvironmentMap";

/**
 * §8.1. The standalone environment map.
 *
 * An environment cannot exist without a project (FR-3.1) and there is no
 * "all my environments" endpoint, so this page has to pick one before it can
 * ask for anything. The choice lives in `?project=<slug>` rather than in state:
 * a slug is readable, the URL is worth sending to someone, and a reload lands
 * back on the project you were looking at. An unrecognised or absent slug falls
 * back to the first project rather than rendering nothing.
 */

const EnvironmentsPage = () => {
  const projects = useApi(listProjects, []);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const all = useMemo(() => projects.data ?? [], [projects.data]);
  const requested = searchParams.get("project");
  const selected = all.find((project) => project.slug === requested) ?? all[0];

  const options = all.map((project) => ({ value: project.slug, label: project.name }));

  const select = (slug: string) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("project", slug);
        return params;
      },
      // Replace: flipping through six projects should not put six entries in
      // history and make Back feel stuck.
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Infrastructure"
        title="Environments"
        description="Where each project actually runs, and which database each deployment talks to."
        actions={
          selected && (
            <Select
              options={options}
              value={selected.slug}
              aria-label="Project"
              onChange={(event) => select(event.target.value)}
              className="w-[220px]"
            />
          )
        }
      />

      {projects.isLoading ? (
        <Skeleton className="h-[196px]" />
      ) : projects.error ? (
        <ErrorState message={projects.error.message} onRetry={() => void projects.refetch()} />
      ) : !selected ? (
        <EmptyState
          icon="projects"
          title="No projects to map yet"
          description="Environments hang off a project — there is nowhere to put one until a project exists. Create the first one and this page has something to show."
          action={
            /* A button, not a link inside one: a <Link> nested in a <button> is
               invalid HTML and behaves differently in every browser. */
            <Button variant="primary" icon="projects" onClick={() => navigate("/projects")}>
              Go to projects
            </Button>
          }
        />
      ) : (
        /* Keyed on the project, so switching remounts rather than reusing a map
           whose modals are open over the previous project's data. */
        <EnvironmentMap key={selected.id} projectId={selected.id} projectName={selected.name} />
      )}
    </div>
  );
};

export default EnvironmentsPage;
