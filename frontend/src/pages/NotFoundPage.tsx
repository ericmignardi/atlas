import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";

/**
 * Inside the shell rather than on a bare page: a wrong URL usually means a stale
 * link, and leaving the sidebar in place means the way out is one click away
 * instead of a browser Back button.
 */
const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon="warning"
      title="That page does not exist"
      description="The link may be out of date, or the record it pointed at may have been deleted."
      action={
        <Button icon="back" onClick={() => navigate("/")}>
          Back to the dashboard
        </Button>
      }
    />
  );
};

export default NotFoundPage;
