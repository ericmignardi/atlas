import { useParams } from "react-router";

import { Placeholder } from "@/pages/Placeholder";

const ProjectDetailPage = () => {
  /** FR-2.10: the route keys on the slug, not the id — a shareable, readable URL. */
  const { slug } = useParams<{ slug: string }>();

  return (
    <Placeholder
      eyebrow="Project"
      title={slug ?? "Project"}
      description="Overview, environments, and tasks for this project arrive on Days 7 and 8."
    />
  );
};

export default ProjectDetailPage;
