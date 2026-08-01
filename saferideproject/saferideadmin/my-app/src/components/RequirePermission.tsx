import type { ReactNode } from 'react';
import { usePermissions, type Action } from '../context/PermissionsContext';
import NotFound from '../pages/NotFound';

/**
 * Gates a route by a module's permission (defaults to "view").
 * While permissions load it renders nothing; if the user lacks access it
 * renders the 403/404 page instead of the protected content.
 */
export default function RequirePermission({
  module, action = 'view', children,
}: { module: string; action?: Action; children: ReactNode }) {
  const { loading, can } = usePermissions();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (!can(module, action)) return <NotFound reason="forbidden" />;

  return <>{children}</>;
}
