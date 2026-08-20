import { createContext, useContext, useState } from 'react';

const ConfirmModalContext = createContext(null);

export function useConfirmModal() {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) {
    throw new Error('useConfirmModal must be used within <ConfirmModalProvider>');
  }
  return ctx;
}

export function ConfirmModalProvider({ children }) {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Підтвердити',
    cancelLabel: 'Скасувати',
    isDanger: false,
    onConfirm: null,
    onCancel: null,
  });

  const confirm = (options) => {
    return new Promise((resolve) => {
      setState((prev) => ({
        ...prev,
        isOpen: true,
        title: options.title || '',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Підтвердити',
        cancelLabel: options.cancelLabel || 'Скасувати',
        isDanger: options.isDanger || false,
        onConfirm: () => {
          resolve(true);
          setState((prev) => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setState((prev) => ({ ...prev, isOpen: false }));
        },
      }));
    });
  };

  const value = { state, confirm };

  return (
    <ConfirmModalContext.Provider value={value}>{children}</ConfirmModalContext.Provider>
  );
}
