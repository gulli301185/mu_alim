import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ContactPanel } from '../components/ContactPanel';

type ContactPanelContextValue = {
  contactOpen: boolean;
  openContact: () => void;
  closeContact: () => void;
};

const ContactPanelContext = createContext<ContactPanelContextValue | null>(null);

export function ContactPanelProvider({ children }: { children: ReactNode }) {
  const [contactOpen, setContactOpen] = useState(false);

  const openContact = useCallback(() => setContactOpen(true), []);
  const closeContact = useCallback(() => setContactOpen(false), []);

  return (
    <ContactPanelContext.Provider value={{ contactOpen, openContact, closeContact }}>
      {children}
      <ContactPanel open={contactOpen} onClose={closeContact} />
    </ContactPanelContext.Provider>
  );
}

export function useContactPanel() {
  const ctx = useContext(ContactPanelContext);
  if (!ctx) {
    throw new Error('useContactPanel must be used within ContactPanelProvider');
  }
  return ctx;
}
