import { useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useConfirmModal } from '../../../context/ConfirmModalContext';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal() {
  const { state } = useConfirmModal();

  // Close on Escape key
  useEffect(() => {
    if (!state.isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        state.onCancel?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [state.isOpen, state.onCancel]);

  if (!state.isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={state.onCancel} />
      <div className={styles.container}>
        <div className={`${styles.modal} ${state.isDanger ? styles.danger : ''}`}>
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              {state.isDanger ? (
                <AlertCircle size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
            </div>
            {state.title && <h2 className={styles.title}>{state.title}</h2>}
          </div>

          {state.message && (
            <div className={styles.message}>{state.message}</div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.btnCancel}
              onClick={state.onCancel}
            >
              {state.cancelLabel}
            </button>
            <button
              className={`${styles.btnConfirm} ${state.isDanger ? styles.danger : ''}`}
              onClick={state.onConfirm}
            >
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
