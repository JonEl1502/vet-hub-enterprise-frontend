import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  clientPortalAPI,
  toast,
  PortalPet,
  PortalAppointment,
  PortalMessage,
  PortalInvoice,
  PortalMyClinic,
} from '../services';

// Client-side data layer for the pet-owner portal. Deliberately separate from
// the staff DataContext (which is clinic-scoped) — every read here is already
// ownership-scoped server-side by client.userId, so there are no clinic headers
// and no clinic selection to manage.

interface ClientPortalContextType {
  clinics: PortalMyClinic[];
  pets: PortalPet[];
  appointments: PortalAppointment[];
  messages: PortalMessage[];
  invoices: PortalInvoice[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  refreshClinics: () => Promise<void>;
  refreshPets: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshInvoices: () => Promise<void>;
  joinClinic: (clinicId: string) => Promise<boolean>;
  book: (data: { petId: string; scheduledAt: string; reason?: string; isHouseCall?: boolean }) => Promise<boolean>;
  sendMessage: (data: { clinicId: string; petId?: string; subject?: string; body: string }) => Promise<boolean>;
}

const ClientPortalContext = createContext<ClientPortalContextType | undefined>(undefined);

export const useClientPortal = () => {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error('useClientPortal must be used within a ClientPortalProvider');
  return ctx;
};

export const ClientPortalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [clinics, setClinics] = useState<PortalMyClinic[]>([]);
  const [pets, setPets] = useState<PortalPet[]>([]);
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshClinics = useCallback(async () => {
    try {
      const res = await clientPortalAPI.myClinics();
      setClinics(res.data?.clinics ?? []);
    } catch { /* toast handled by interceptor */ }
  }, []);

  const refreshPets = useCallback(async () => {
    try {
      const res = await clientPortalAPI.pets();
      setPets(res.data?.pets ?? []);
    } catch { /* */ }
  }, []);

  const refreshAppointments = useCallback(async () => {
    try {
      const res = await clientPortalAPI.appointments();
      setAppointments(res.data?.appointments ?? []);
    } catch { /* */ }
  }, []);

  const refreshMessages = useCallback(async () => {
    try {
      const res = await clientPortalAPI.messages();
      setMessages(res.data?.messages ?? []);
    } catch { /* */ }
  }, []);

  const refreshInvoices = useCallback(async () => {
    try {
      const res = await clientPortalAPI.invoices();
      setInvoices(res.data?.invoices ?? []);
    } catch { /* */ }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      refreshClinics(),
      refreshPets(),
      refreshAppointments(),
      refreshMessages(),
      refreshInvoices(),
    ]);
    setLoading(false);
  }, [refreshClinics, refreshPets, refreshAppointments, refreshMessages, refreshInvoices]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const joinClinic = useCallback(async (clinicId: string) => {
    try {
      await clientPortalAPI.joinClinic(clinicId);
      await Promise.all([refreshClinics(), refreshPets()]);
      toast.success('Clinic added to your account');
      return true;
    } catch { return false; }
  }, [refreshClinics, refreshPets]);

  const book = useCallback(async (data: { petId: string; scheduledAt: string; reason?: string; isHouseCall?: boolean }) => {
    try {
      await clientPortalAPI.bookAppointment(data);
      await refreshAppointments();
      toast.success('Appointment requested — the clinic will confirm shortly');
      return true;
    } catch { return false; }
  }, [refreshAppointments]);

  const sendMessage = useCallback(async (data: { clinicId: string; petId?: string; subject?: string; body: string }) => {
    try {
      await clientPortalAPI.sendMessage(data);
      await refreshMessages();
      return true;
    } catch { return false; }
  }, [refreshMessages]);

  const value: ClientPortalContextType = {
    clinics, pets, appointments, messages, invoices, loading,
    refreshAll, refreshClinics, refreshPets, refreshAppointments, refreshMessages, refreshInvoices,
    joinClinic, book, sendMessage,
  };

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
};
