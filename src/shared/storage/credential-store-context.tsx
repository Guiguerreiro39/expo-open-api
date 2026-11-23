import { createContext, useContext } from "react";
import {
  type CredentialStorePort,
  createInMemoryCredentialStore,
} from "@/shared/storage/credential-store";

const fallbackStore = createInMemoryCredentialStore();

export const CredentialStoreContext = createContext<CredentialStorePort | null>(null);

export function useCredentialStore(): CredentialStorePort {
  const store = useContext(CredentialStoreContext);
  return store ?? fallbackStore;
}
