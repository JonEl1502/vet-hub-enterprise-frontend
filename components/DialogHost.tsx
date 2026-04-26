import React, { useEffect, useState } from 'react';
import { dialog, DialogRequest } from '../services/utils/dialog';
import ConfirmDialog from './ConfirmDialog';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

/**
 * Mounted once at the top of App.tsx. Subscribes to the global dialog
 * singleton and renders the right component for each request.
 */
const DialogHost: React.FC = () => {
  const [active, setActive] = useState<DialogRequest | null>(null);

  useEffect(() => dialog.subscribe(setActive), []);

  if (!active) return null;

  if (active.kind === 'delete') {
    return (
      <DeleteConfirmationDialog
        isOpen={true}
        onClose={() => dialog.finish(active.id, false)}
        onConfirm={() => dialog.finish(active.id, true)}
        title={active.opts.title || 'Confirm Delete'}
        message={active.opts.message || 'Are you sure you want to delete this item?'}
        entityName={active.opts.entityName}
      />
    );
  }

  if (active.kind === 'alert') {
    return (
      <ConfirmDialog
        open={true}
        title={active.opts.title || 'Notice'}
        message={active.opts.message}
        confirmLabel={active.opts.confirmLabel || 'OK'}
        variant={active.opts.variant || 'info'}
        alertOnly
        onConfirm={() => dialog.finish(active.id, true)}
        onCancel={() => dialog.finish(active.id, true)}
      />
    );
  }

  // confirm
  return (
    <ConfirmDialog
      open={true}
      title={active.opts.title || 'Are you sure?'}
      message={active.opts.message}
      confirmLabel={active.opts.confirmLabel || 'Confirm'}
      cancelLabel={active.opts.cancelLabel || 'Cancel'}
      variant={active.opts.variant || 'warning'}
      onConfirm={() => dialog.finish(active.id, true)}
      onCancel={() => dialog.finish(active.id, false)}
    />
  );
};

export default DialogHost;
