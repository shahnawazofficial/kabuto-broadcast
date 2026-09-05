'use client'

import Modal from './Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  isPending?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Delete',
  isPending = false,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn btn--ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          onClick={onConfirm}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
