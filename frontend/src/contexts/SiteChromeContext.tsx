/**
 * Global UI chrome: exposes `openContactModal` so header/footer can open the contact
 * dialog without prop drilling. Renders `ContactModal` when open.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ContactModal from "../components/site/modals/ContactModal";

/** API exposed to descendants for opening global chrome (contact overlay). */
type SiteChromeValue = {
  openContactModal: () => void;
};

const SiteChromeContext = createContext<SiteChromeValue | null>(null);

/** Wraps the main site layout; children are page routes, modal overlays the tree when open. */
export function SiteChromeProvider({ children }: { children: ReactNode }) {
  const [contactOpen, setContactOpen] = useState(false);
  const openContactModal = useCallback(() => setContactOpen(true), []);

  const value = useMemo(
    () => ({
      openContactModal,
    }),
    [openContactModal]
  );

  return (
    <SiteChromeContext.Provider value={value}>
      {children}
      {contactOpen ? (
        <ContactModal onClose={() => setContactOpen(false)} />
      ) : null}
    </SiteChromeContext.Provider>
  );
}

/** Must be used under `SiteChromeProvider`; returns `openContactModal` for buttons/links. */
export function useSiteChrome(): SiteChromeValue {
  const ctx = useContext(SiteChromeContext);
  if (!ctx) {
    throw new Error("useSiteChrome must be used within SiteChromeProvider");
  }
  return ctx;
}
