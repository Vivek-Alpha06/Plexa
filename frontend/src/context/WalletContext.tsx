import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  connect as walletConnect,
  connectDemoAs,
  disconnect as walletDisconnect,
  getConnectedAddress,
  getActiveProvider,
  type Provider,
} from "../lib/wallet";
import { usdcBalance } from "../lib/contracts";
import { DEMO } from "../lib/config";
import { onDemoBalanceChange } from "../lib/demoWallet";

interface WalletCtx {
  address: string | null;
  provider: Provider | null;
  balance: bigint;
  connecting: boolean;
  error: string | null;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  connect: (provider: Provider) => Promise<boolean>;
  connectDemo: (address: string) => boolean;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const Ctx = createContext<WalletCtx | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setBalance(await usdcBalance(address));
  }, [address]);

  const connect = useCallback(async (p: Provider): Promise<boolean> => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await walletConnect(p);
      setAddress(addr);
      setProvider(p);
      setPickerOpen(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectDemo = useCallback((addr: string): boolean => {
    try {
      connectDemoAs(addr);
      setAddress(addr);
      setProvider("freighter");
      setPickerOpen(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    walletDisconnect();
    setAddress(null);
    setProvider(null);
    setBalance(0n);
  }, []);

  useEffect(() => {
    getConnectedAddress().then((a) => {
      if (a) {
        setAddress(a);
        setProvider(getActiveProvider());
      }
    });
  }, []);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  // In demo mode, keep the header balance in sync as funds move.
  useEffect(() => {
    if (!DEMO) return;
    return onDemoBalanceChange(() => void refreshBalance());
  }, [refreshBalance]);

  return (
    <Ctx.Provider
      value={{
        address,
        provider,
        balance,
        connecting,
        error,
        pickerOpen,
        openPicker: () => setPickerOpen(true),
        closePicker: () => setPickerOpen(false),
        connect,
        connectDemo,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
