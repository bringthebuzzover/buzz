/**
 * Global UI chrome: exposes `openContactModal` and `openAuthModal` so header/footer/hero can
 * open global site dialogs without prop drilling. Renders modals when open.
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
import AuthChooserModal, {
  type AuthMode,
  type AccountType,
} from "../components/site/modals/AuthChooserModal";

/** API exposed to descendants for opening global chrome. */
type SiteChromeValue = {
  openContactModal: () => void;
  openAuthModal: (mode?: AuthMode, initialType?: AccountType) => void;
  closeAuthModal: () => void;
};

const SiteChromeContext = createContext<SiteChromeValue | null>(null);

/** Wraps the main site layout; children are page routes, modals overlay the tree when open. */
export function SiteChromeProvider({ children }: { children: ReactNode }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: AuthMode;
    initialType?: AccountType;
  }>({
    open: false,
    mode: "signup",
  });

  const openContactModal = useCallback(() => setContactOpen(true), []);

  const openAuthModal = useCallback(
    (mode: AuthMode = "signup", initialType?: AccountType) => {
      setAuthModal({
        open: true,
        mode,
        initialType,
      });
    },
    [],
  );

  const closeAuthModal = useCallback(() => {
    setAuthModal((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo(
    () => ({
      openContactModal,
      openAuthModal,
      closeAuthModal,
    }),
    [openContactModal, openAuthModal, closeAuthModal],
  );

  return (
    <SiteChromeContext.Provider value={value}>
      {children}
      {contactOpen ? (
        <ContactModal onClose={() => setContactOpen(false)} />
      ) : null}
      {authModal.open ? (
        <AuthChooserModal
          isOpen={authModal.open}
          initialMode={authModal.mode}
          initialType={authModal.initialType}
          onClose={closeAuthModal}
        />
      ) : null}
    </SiteChromeContext.Provider>
  );
}

const NOOP_CHROME: SiteChromeValue = {
  openContactModal: () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
};

/** Returns `openContactModal` and `openAuthModal` for buttons/links. Falls back to no-ops when outside provider. */
export function useSiteChrome(): SiteChromeValue {
  const ctx = useContext(SiteChromeContext);
  return ctx ?? NOOP_CHROME;
}
