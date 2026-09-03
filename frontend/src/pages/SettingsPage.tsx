import { useState } from "react";
import { useNavigate } from "react-router";

import { logout } from "@/lib/authApi";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/states";

const SettingsPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const sidebarCollapsed = usePrefsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = usePrefsStore((state) => state.setSidebarCollapsed);

  const [confirming, setConfirming] = useState(false);

  const signOut = async () => {
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      // FR-1.6's revocation is best-effort from the client's side: the local
      // session is gone either way, and telling the user "sign-out failed"
      // while they are looking at a login form would be a lie.
      toast.info(
        "Signed out on this device",
        "The server could not be reached to revoke the session.",
      );
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Account" title="Settings" />

      <Panel title="Account">
        <dl className="flex flex-col gap-3">
          <Row label="Email" value={user?.email ?? "—"} mono />
          <Row label="Display name" value={user?.displayName ?? "Not set"} />
          <Row label="Roles" value={user?.roles.join(", ") ?? "—"} />
        </dl>
      </Panel>

      <Panel title="Interface">
        <Checkbox
          id="sidebar-collapsed"
          label="Keep the sidebar collapsed"
          hint="Also toggled with ⌘\ from anywhere. Below 1024 px it collapses regardless."
          checked={sidebarCollapsed}
          onChange={(event) => setSidebarCollapsed(event.target.checked)}
        />
      </Panel>

      <Panel title="Session">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            Signing out revokes this device&rsquo;s refresh token on the server.
          </p>
          <Button icon="signOut" onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={signOut}
        title={`Sign out of ${user?.email ?? "Atlas"}?`}
        consequence="This device's refresh token is revoked, and you will need your password to sign back in. Nothing you have saved is affected."
        confirmLabel="Sign out"
        tone="primary"
      />
    </div>
  );
};

const Row = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-sm text-ink-muted">{label}</dt>
    <dd className={mono ? "font-mono text-mono-base text-ink" : "text-sm text-ink"}>{value}</dd>
  </div>
);

export default SettingsPage;
