"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Edit3,
  FileText,
  Fuel,
  Gauge,
  LayoutDashboard,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Save,
  ShieldCheck,
  Building2,
  Bell,
  SlidersHorizontal,
  Wrench,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
  Zap,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  UserCog,
  Mail,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

type Shift = "Morning" | "Evening" | "Night";
type VehicleStatus = "Running" | "Closed";
type MainPage = "dashboard" | "add" | "live" | "history" | "people" | "analytics" | "diesel" | "reports" | "alerts" | "settings";
type PeopleTab = "employees" | "buses";

type SettingsState = {
  depot_profile: { depot_name: string; division_name: string; depot_code: string; location: string; contact_number: string; email: string };
  operations: { default_shift: Shift; default_route: string; default_bus_type: string; auto_refresh_minutes: number };
  alerts: { low_kmpl_enabled: boolean; low_kmpl_threshold: number; high_diesel_enabled: boolean; high_diesel_per_100km: number; running_trip_enabled: boolean };
  reports: { organization_name: string; report_title: string; footer_text: string; default_period: string };
  system: { timezone: string; date_format: string; decimal_places: number };
};

const DEFAULT_SETTINGS: SettingsState = {
  depot_profile: { depot_name: "", division_name: "", depot_code: "", location: "", contact_number: "", email: "" },
  operations: { default_shift: "Morning", default_route: "", default_bus_type: "", auto_refresh_minutes: 5 },
  alerts: { low_kmpl_enabled: true, low_kmpl_threshold: 4, high_diesel_enabled: true, high_diesel_per_100km: 30, running_trip_enabled: true },
  reports: { organization_name: "Maharashtra State Road Transport Corporation", report_title: "Diesel Management Report", footer_text: "Generated from MSRTC Diesel Management System", default_period: "current_year" },
  system: { timezone: "Asia/Kolkata", date_format: "DD/MM/YYYY", decimal_places: 2 },
};

type VehicleEntry = {
  id: number;
  vehicle_no: string;
  driver_name: string;
  badge_no: string;
  conductor_name: string;
  conductor_badge_no: string;
  entry_date: string;
  entry_time: string;
  closing_date: string;
  closing_time: string;
  shift: Shift;
  opening_km: number;
  closing_km: number;
  total_km: number;
  diesel_litres: number;
  kmpl: number;
  route: string;
  status: VehicleStatus;
  vehicle_id?: number;
  driver_id?: number;
  conductor_id?: number;
  created_at?: string;
};

type FormState = {
  vehicle_no: string;
  driver_name: string;
  badge_no: string;
  conductor_name: string;
  conductor_badge_no: string;
  entry_date: string;
  entry_time: string;
  shift: Shift;
  opening_km: string;
  diesel_litres: string;
  route: string;
};

type CloseFormState = {
  closing_date: string;
  closing_time: string;
  closing_km: string;
};

type DashboardSummary = {
  total_trips: number;
  running_trips: number;
  closed_trips: number;
  total_employees: number;
  total_buses: number;
  today_entries: number;
  today_diesel: number;
  today_km: number;
};

type Employee = {
  id: number;
  name: string;
  badge_no: string | null;
  role: string;
  status: string;
  total_trips: number;
  total_km: number;
  total_diesel: number;
  buses_count: number;
};

type BusRecord = {
  id: number;
  vehicle_no: string;
  depot_name: string | null;
  bus_type: string | null;
  status: string;
  total_trips: number;
  total_km: number;
  total_diesel: number;
  drivers_count: number;
};

type HistoryRow = {
  id: number;
  vehicle_no: string;
  driver_name: string;
  driver_badge_no: string | null;
  conductor_name: string;
  conductor_badge_no: string | null;
  entry_date: string;
  entry_time: string;
  closing_date: string | null;
  closing_time: string | null;
  route: string;
  opening_km: number;
  closing_km: number | null;
  total_km: number | null;
  diesel_litres: number;
  kmpl: number | null;
  status: VehicleStatus;
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: "Admin" | "Officer" | "Clerk";
  depot_name: string;
  employee_code: string;
  badge_no: string | null;
  status: "Active" | "Inactive";
};

const PAGE_SIZE = 50;

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));
}

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown database error";
  }
}

function mapEntry(row: any): VehicleEntry {
  return {
    id: Number(row.id),
    vehicle_no: row.vehicle_no ?? "",
    driver_name: row.driver_name ?? "",
    badge_no: row.badge_no ?? "",
    conductor_name: row.conductor_name ?? "",
    conductor_badge_no: row.conductor_badge_no ?? "",
    entry_date: row.entry_date ?? "",
    entry_time: row.entry_time ?? "",
    closing_date: row.closing_date ?? "",
    closing_time: row.closing_time ?? "",
    shift: row.shift ?? "Morning",
    opening_km: Number(row.opening_km ?? 0),
    closing_km: row.closing_km == null ? 0 : Number(row.closing_km),
    total_km: row.total_km == null ? 0 : Number(row.total_km),
    diesel_litres: Number(row.diesel_litres ?? 0),
    kmpl: row.kmpl == null ? 0 : Number(row.kmpl),
    route: row.route ?? "",
    status: row.status === "Closed" ? "Closed" : "Running",
    vehicle_id: row.vehicle_id == null ? undefined : Number(row.vehicle_id),
    driver_id: row.driver_id == null ? undefined : Number(row.driver_id),
    conductor_id: row.conductor_id == null ? undefined : Number(row.conductor_id),
    created_at: row.created_at,
  };
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [activePage, setActivePage] = useState<MainPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<DashboardSummary>({
    total_trips: 0,
    running_trips: 0,
    closed_trips: 0,
    total_employees: 0,
    total_buses: 0,
    today_entries: 0,
    today_diesel: 0,
    today_km: 0,
  });

  const [runningEntries, setRunningEntries] = useState<VehicleEntry[]>([]);
  const [historyEntries, setHistoryEntries] = useState<VehicleEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [liveSearch, setLiveSearch] = useState("");

  const [peopleTab, setPeopleTab] = useState<PeopleTab>("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peoplePage, setPeoplePage] = useState(0);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBus, setSelectedBus] = useState<BusRecord | null>(null);
  const [profileHistory, setProfileHistory] = useState<HistoryRow[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profilePage, setProfilePage] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showBusModal, setShowBusModal] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: "", badge_no: "", role: "Driver", employee_code: "", depot_name: "" });
  const [busForm, setBusForm] = useState({ vehicle_no: "", bus_type: "", depot_name: "" });
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VehicleEntry | null>(null);
  const [closingEntry, setClosingEntry] = useState<VehicleEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const [addForm, setAddForm] = useState<FormState>({
    vehicle_no: "",
    driver_name: "",
    badge_no: "",
    conductor_name: "",
    conductor_badge_no: "",
    entry_date: getToday(),
    entry_time: getCurrentTime(),
    shift: "Morning",
    opening_km: "",
    diesel_litres: "",
    route: "",
  });

  const [closeForm, setCloseForm] = useState<CloseFormState>({
    closing_date: getToday(),
    closing_time: getCurrentTime(),
    closing_km: "",
  });

  async function loadCurrentProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,depot_name,employee_code,badge_no,status")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("User profile not found. Please contact an administrator.");

    const nextProfile = data as UserProfile;
    if (nextProfile.status !== "Active") {
      await supabase.auth.signOut();
      throw new Error("This account is inactive. Please contact an administrator.");
    }

    setProfile(nextProfile);
    return nextProfile;
  }

  async function handleSignOut() {
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(errorText(error));
  }

  function canAccessPage(page: MainPage) {
    if (!profile) return false;
    if (profile.role === "Admin") return true;
    if (profile.role === "Officer") {
      return ["dashboard", "live", "history", "people", "analytics", "diesel", "reports", "alerts"].includes(page);
    }
    return ["dashboard", "add", "live", "history"].includes(page);
  }

  function navigateSecure(page: MainPage) {
    if (!canAccessPage(page)) {
      setAuthError(`Your ${profile?.role ?? "user"} account does not have access to this section.`);
      return;
    }
    setActivePage(page);
    setSidebarOpen(false);
    if (page === "add") openAddEntry();
  }

  useEffect(() => {
    if (profile && !canAccessPage(activePage)) {
      setActivePage("dashboard");
    }
  }, [profile, activePage]);

  async function changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key,setting_value")
      .in("setting_key", ["depot_profile", "operations", "alerts", "reports", "system"]);
    if (error) throw error;

    const next = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsState;
    for (const row of (data ?? []) as any[]) {
      if (!(row.setting_key in next) || row.setting_value == null) continue;
      let value = row.setting_value;
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { continue; }
      }
      if (value && typeof value === "object") {
        const key = row.setting_key as keyof SettingsState;
        next[key] = { ...next[key], ...value } as never;
      }
    }
    setSettings(next);
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    setDatabaseError("");
    try {
      for (const [setting_key, setting_value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ setting_key, setting_value: JSON.stringify(setting_value) }, { onConflict: "setting_key" });
        if (error) throw error;
      }
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 3000);
    } catch (error) {
      setDatabaseError(`Unable to save settings. ${errorText(error)}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  function resetSettings() {
    if (!window.confirm("Reset all system settings to the recommended defaults?")) return;
    setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsState);
    setSettingsSaved(false);
  }

  async function loadDashboard() {
    const { data, error } = await supabase.rpc("get_dashboard_summary");
    if (error) throw error;
    const value = (data ?? {}) as Record<string, unknown>;
    setSummary({
      total_trips: Number(value.total_trips ?? 0),
      running_trips: Number(value.running_trips ?? 0),
      closed_trips: Number(value.closed_trips ?? 0),
      total_employees: Number(value.total_employees ?? 0),
      total_buses: Number(value.total_buses ?? 0),
      today_entries: Number(value.today_entries ?? 0),
      today_diesel: Number(value.today_diesel ?? 0),
      today_km: Number(value.today_km ?? 0),
    });
  }

  async function loadRunning() {
    const { data, error } = await supabase
      .from("vehicle_entries")
      .select("*")
      .eq("status", "Running")
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: false })
      .range(0, 99);
    if (error) throw error;
    setRunningEntries((data ?? []).map(mapEntry));
  }

  async function loadHistory(page = historyPage) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const query = historySearch.trim();

    let request = supabase
      .from("vehicle_entries")
      .select("*", { count: "exact" })
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: false })
      .range(from, to);

    if (query) {
      request = request.or(
        `vehicle_no.ilike.%${query}%,driver_name.ilike.%${query}%,conductor_name.ilike.%${query}%,route.ilike.%${query}%,badge_no.ilike.%${query}%`
      );
    }

    const { data, error, count } = await request;
    if (error) throw error;
    setHistoryEntries((data ?? []).map(mapEntry));
    setHistoryTotal(count ?? 0);
  }

  async function refreshAll() {
    setLoading(true);
    setDatabaseError("");
    try {
      const tasks = [loadDashboard(), loadRunning(), loadHistory(0)];
      if (profile?.role === "Admin") tasks.push(loadSettings());
      await Promise.all(tasks);
      setHistoryPage(0);
    } catch (error) {
      console.error(error);
      setDatabaseError(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      setAuthLoading(true);
      setAuthError("");
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        setSession(data.session);
        setAuthUser(data.session?.user ?? null);

        if (data.session?.user) {
          await loadCurrentProfile(data.session.user.id);
        }
      } catch (error) {
        if (mounted) {
          setSession(null);
          setAuthUser(null);
          setProfile(null);
          setAuthError(errorText(error));
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      setAuthError("");

      if (nextSession?.user) {
        try {
          await loadCurrentProfile(nextSession.user.id);
        } catch (error) {
          if (mounted) setAuthError(errorText(error));
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session && profile) {
      refreshAll();
    }
  }, [session, profile]);

  useEffect(() => {
    if (activePage === "history") {
      loadHistory(historyPage).catch((error) => setDatabaseError(errorText(error)));
    }
  }, [historyPage, historySearch]);

  async function loadPeople() {
    setPeopleLoading(true);
    setDatabaseError("");
    try {
      if (peopleTab === "employees") {
        const { data, error } = await supabase.rpc("get_employee_directory", {
          p_search: peopleSearch.trim(),
          p_limit: PAGE_SIZE,
          p_offset: peoplePage * PAGE_SIZE,
        });
        if (error) throw error;
        setEmployees(
          ((data ?? []) as any[]).map((row) => ({
            id: Number(row.id),
            name: row.name ?? "",
            badge_no: row.badge_no ?? null,
            role: row.role ?? "",
            status: row.status ?? "",
            total_trips: Number(row.total_trips ?? 0),
            total_km: Number(row.total_km ?? 0),
            total_diesel: Number(row.total_diesel ?? 0),
            buses_count: Number(row.buses_count ?? 0),
          }))
        );
        setPeopleTotal(Number((data?.[0] as any)?.total_count ?? 0));
      } else {
        const { data, error } = await supabase.rpc("get_bus_directory", {
          p_search: peopleSearch.trim(),
          p_limit: PAGE_SIZE,
          p_offset: peoplePage * PAGE_SIZE,
        });
        if (error) throw error;
        setBuses(
          ((data ?? []) as any[]).map((row) => ({
            id: Number(row.id),
            vehicle_no: row.vehicle_no ?? "",
            depot_name: row.depot_name ?? null,
            bus_type: row.bus_type ?? null,
            status: row.status ?? "",
            total_trips: Number(row.total_trips ?? 0),
            total_km: Number(row.total_km ?? 0),
            total_diesel: Number(row.total_diesel ?? 0),
            drivers_count: Number(row.drivers_count ?? 0),
          }))
        );
        setPeopleTotal(Number((data?.[0] as any)?.total_count ?? 0));
      }
    } catch (error) {
      setDatabaseError(errorText(error));
    } finally {
      setPeopleLoading(false);
    }
  }

  useEffect(() => {
    if (activePage === "people") loadPeople();
  }, [activePage, peopleTab, peoplePage, peopleSearch]);

  function openEmployeeModal() {
    setEmployeeForm({ name: "", badge_no: "", role: "Driver", employee_code: "", depot_name: "" });
    setShowEmployeeModal(true);
  }

  function openBusModal() {
    setBusForm({ vehicle_no: "", bus_type: "", depot_name: "" });
    setShowBusModal(true);
  }

  async function saveEmployeeMaster() {
    if (profile?.role !== "Admin") return alert("Only Admin can add employee master records.");
    if (!employeeForm.name.trim()) return alert("Please enter employee name.");
    if ((employeeForm.role === "Driver") && !employeeForm.badge_no.trim()) return alert("Driver badge number is compulsory.");
    setMasterSaving(true);
    try {
      const { error } = await supabase.from("employees").insert({
        name: employeeForm.name.trim(),
        badge_no: employeeForm.badge_no.trim() || null,
        role: employeeForm.role,
        employee_code: employeeForm.employee_code.trim() || null,
        depot_name: employeeForm.depot_name.trim() || null,
        status: "Active",
      });
      if (error) throw error;
      setShowEmployeeModal(false);
      setPeoplePage(0);
      await loadPeople();
      await loadDashboard();
    } catch (error) {
      alert(`Unable to add employee.\n\n${errorText(error)}`);
    } finally {
      setMasterSaving(false);
    }
  }

  async function saveBusMaster() {
    if (profile?.role !== "Admin") return alert("Only Admin can add bus master records.");
    if (!busForm.vehicle_no.trim()) return alert("Please enter vehicle number.");
    setMasterSaving(true);
    try {
      const { error } = await supabase.from("buses").insert({
        vehicle_no: busForm.vehicle_no.trim(),
        bus_type: busForm.bus_type.trim() || null,
        depot_name: busForm.depot_name.trim() || null,
        status: "Active",
      });
      if (error) throw error;
      setShowBusModal(false);
      setPeoplePage(0);
      await loadPeople();
      await loadDashboard();
    } catch (error) {
      alert(`Unable to add bus.\n\n${errorText(error)}`);
    } finally {
      setMasterSaving(false);
    }
  }

  async function openEmployeeProfile(employee: Employee) {
    setSelectedBus(null);
    setSelectedEmployee(employee);
    setProfilePage(0);
    setProfileHistory([]);
    await loadEmployeeHistory(employee.id, 0);
  }

  async function loadEmployeeHistory(employeeId: number, page: number) {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_employee_history", {
        p_employee_id: employeeId,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      setProfileHistory((data ?? []) as HistoryRow[]);
      setProfileTotal(Number((data?.[0] as any)?.total_count ?? 0));
    } catch (error) {
      setDatabaseError(errorText(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function openBusProfile(bus: BusRecord) {
    setSelectedEmployee(null);
    setSelectedBus(bus);
    setProfilePage(0);
    setProfileHistory([]);
    await loadBusHistory(bus.id, 0);
  }

  async function loadBusHistory(busId: number, page: number) {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_bus_history", {
        p_bus_id: busId,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      setProfileHistory((data ?? []) as HistoryRow[]);
      setProfileTotal(Number((data?.[0] as any)?.total_count ?? 0));
    } catch (error) {
      setDatabaseError(errorText(error));
    } finally {
      setProfileLoading(false);
    }
  }

  function resetAddForm() {
    setAddForm({
      vehicle_no: "",
      driver_name: "",
      badge_no: "",
      conductor_name: "",
      conductor_badge_no: "",
      entry_date: getToday(),
      entry_time: getCurrentTime(),
      shift: "Morning",
      opening_km: "",
      diesel_litres: "",
      route: "",
    });
  }

  function openAddEntry() {
    resetAddForm();
    setEditingEntry(null);
    setShowAddModal(true);
  }

  function openEditEntry(entry: VehicleEntry) {
    if (entry.status === "Closed") {
      alert("Closed entries cannot be edited from the live workflow.");
      return;
    }
    setEditingEntry(entry);
    setAddForm({
      vehicle_no: entry.vehicle_no,
      driver_name: entry.driver_name,
      badge_no: entry.badge_no,
      conductor_name: entry.conductor_name,
      conductor_badge_no: entry.conductor_badge_no,
      entry_date: entry.entry_date,
      entry_time: entry.entry_time,
      shift: entry.shift,
      opening_km: String(entry.opening_km),
      diesel_litres: String(entry.diesel_litres),
      route: entry.route,
    });
    setShowAddModal(true);
  }

  function openCloseEntry(entry: VehicleEntry) {
    setClosingEntry(entry);
    setCloseForm({
      closing_date: getToday(),
      closing_time: getCurrentTime(),
      closing_km: "",
    });
  }

  async function getOrCreateBus(vehicleNo: string) {
    const { data: existing, error: findError } = await supabase
      .from("buses")
      .select("id")
      .ilike("vehicle_no", vehicleNo.trim())
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return Number(existing.id);
    if (profile?.role !== "Admin") {
      throw new Error(`Vehicle ${vehicleNo.trim()} is not present in the bus master. Ask an Admin to add this bus first.`);
    }

    const { data, error } = await supabase
      .from("buses")
      .insert({ vehicle_no: vehicleNo.trim(), status: "Active" })
      .select("id")
      .single();
    if (error) throw error;
    return Number(data.id);
  }

  async function getOrCreateDriver(name: string, badge: string) {
    const { data: existing, error: findError } = await supabase
      .from("employees")
      .select("id")
      .eq("badge_no", badge.trim())
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return Number(existing.id);
    if (profile?.role !== "Admin") {
      throw new Error(`Driver ${name.trim()} (${badge.trim()}) is not present in the employee master. Ask an Admin to add this driver first.`);
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({ name: name.trim(), badge_no: badge.trim(), role: "Driver", status: "Active" })
      .select("id")
      .single();
    if (error) throw error;
    return Number(data.id);
  }

  async function getOrCreateConductor(name: string, badge: string) {
    let request = supabase.from("employees").select("id").ilike("name", name.trim()).limit(1);
    if (badge.trim()) request = request.eq("badge_no", badge.trim());
    const { data: existing, error: findError } = await request.maybeSingle();
    if (findError) throw findError;
    if (existing) return Number(existing.id);
    if (profile?.role !== "Admin") {
      throw new Error(`Conductor ${name.trim()} is not present in the employee master. Ask an Admin to add this conductor first.`);
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        name: name.trim(),
        badge_no: badge.trim() || null,
        role: "Conductor",
        status: "Active",
      })
      .select("id")
      .single();
    if (error) throw error;
    return Number(data.id);
  }

  async function saveEntry() {
    if (!addForm.vehicle_no.trim()) return alert("Please enter vehicle number.");
    if (!addForm.driver_name.trim()) return alert("Please enter driver name.");
    if (!addForm.badge_no.trim()) return alert("Please enter driver badge number.");
    if (!addForm.conductor_name.trim()) return alert("Please enter conductor name.");
    if (!addForm.route.trim()) return alert("Please enter route.");

    const openingKm = Number(addForm.opening_km);
    const diesel = Number(addForm.diesel_litres);
    if (!Number.isFinite(openingKm) || openingKm < 0) return alert("Please enter a valid opening KM.");
    if (!Number.isFinite(diesel) || diesel <= 0) return alert("Please enter valid diesel litres.");

    setSaving(true);
    try {
      const [vehicleId, driverId, conductorId] = await Promise.all([
        getOrCreateBus(addForm.vehicle_no),
        getOrCreateDriver(addForm.driver_name, addForm.badge_no),
        getOrCreateConductor(addForm.conductor_name, addForm.conductor_badge_no),
      ]);

      const payload = {
        vehicle_id: vehicleId,
        driver_id: driverId,
        conductor_id: conductorId,
        vehicle_no: addForm.vehicle_no.trim(),
        driver_name: addForm.driver_name.trim(),
        badge_no: addForm.badge_no.trim(),
        conductor_name: addForm.conductor_name.trim(),
        conductor_badge_no: addForm.conductor_badge_no.trim() || null,
        entry_date: addForm.entry_date,
        entry_time: addForm.entry_time,
        shift: addForm.shift,
        opening_km: openingKm,
        diesel_litres: diesel,
        route: addForm.route.trim(),
        status: "Running",
      };

      if (editingEntry) {
        const { error } = await supabase.from("vehicle_entries").update(payload).eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_entries").insert(payload);
        if (error) throw error;
      }

      setShowAddModal(false);
      setEditingEntry(null);
      resetAddForm();
      await refreshAll();
      setActivePage("live");
    } catch (error) {
      alert(`Unable to save entry.\n\n${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function closeVehicleEntry() {
    if (!closingEntry) return;
    const closingKm = Number(closeForm.closing_km);
    if (!closeForm.closing_date) return alert("Please select closing date.");
    if (!closeForm.closing_time) return alert("Please enter closing time.");
    if (!Number.isFinite(closingKm)) return alert("Please enter valid closing KM.");
    if (closingKm < closingEntry.opening_km) return alert("Closing KM cannot be lower than opening KM.");

    setClosing(true);
    try {
      const { error } = await supabase
        .from("vehicle_entries")
        .update({
          closing_date: closeForm.closing_date,
          closing_time: closeForm.closing_time,
          closing_km: closingKm,
          status: "Closed",
        })
        .eq("id", closingEntry.id);
      if (error) throw error;
      setClosingEntry(null);
      await refreshAll();
      setActivePage("history");
    } catch (error) {
      alert(`Unable to close vehicle entry.\n\n${errorText(error)}`);
    } finally {
      setClosing(false);
    }
  }

  async function deleteEntry(entry: VehicleEntry) {
    if (!window.confirm(`Delete trip record for ${entry.vehicle_no}?`)) return;
    try {
      const { error } = await supabase.from("vehicle_entries").delete().eq("id", entry.id);
      if (error) throw error;
      await refreshAll();
    } catch (error) {
      alert(`Unable to delete entry.\n\n${errorText(error)}`);
    }
  }

  function navigate(page: MainPage) {
    navigateSecure(page);
  }

  const filteredRunning = useMemo(() => {
    const q = liveSearch.trim().toLowerCase();
    if (!q) return runningEntries;
    return runningEntries.filter((entry) =>
      [entry.vehicle_no, entry.driver_name, entry.badge_no, entry.conductor_name, entry.route]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [runningEntries, liveSearch]);

  if (authLoading) return <AuthLoadingScreen />;
  if (!session || !authUser || !profile) {
    return <LoginPage errorMessage={authError} onLoggedIn={async (nextSession) => {
      setSession(nextSession);
      setAuthUser(nextSession.user);
      try {
        await loadCurrentProfile(nextSession.user.id);
        setAuthError("");
      } catch (error) {
        await supabase.auth.signOut();
        setAuthError(errorText(error));
      }
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <Sidebar activePage={activePage} sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={navigate} runningCount={summary.running_trips} role={profile?.role ?? "Clerk"} />

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-[74px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"><Menu size={20} /></button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                  <img src="/msrtc-logo.png" alt="MSRTC Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9f1d20]">MSRTC</p>
                  <h1 className="text-lg font-bold sm:text-xl">Diesel Management System</h1>
                </div>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />System Online</div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#9f1d20]"><UserCog size={16} /></div>
                <div className="hidden min-w-0 lg:block"><p className="max-w-[140px] truncate text-xs font-extrabold">{profile.full_name || profile.email || "User"}</p><p className="text-[10px] font-bold text-slate-500">{profile.role}</p></div>
                <button onClick={handleSignOut} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Sign out"><LogOut size={16} /></button>
              </div>
              <button onClick={refreshAll} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50" title="Refresh"><RefreshCw size={18} /></button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {databaseError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><Database className="mt-0.5 text-red-600" size={20} /><div className="flex-1"><p className="font-bold text-red-800">Database error</p><p className="mt-1 text-sm text-red-700">{databaseError}</p><button onClick={refreshAll} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div></div></div>}

          {loading ? <LoadingScreen /> : (
            <>
              {activePage === "dashboard" && <Dashboard summary={summary} runningEntries={runningEntries} onAdd={() => navigateSecure("add")} onLive={() => navigateSecure("live")} onClose={openCloseEntry} onPeople={() => navigateSecure("people")} />}
              {activePage === "live" && <LivePage entries={filteredRunning} search={liveSearch} setSearch={setLiveSearch} onAdd={() => navigateSecure("add")} onClose={openCloseEntry} onEdit={openEditEntry} onDelete={deleteEntry} />}
              {activePage === "history" && <HistoryPage entries={historyEntries} total={historyTotal} page={historyPage} search={historySearch} setSearch={(v) => { setHistorySearch(v); setHistoryPage(0); }} onPage={setHistoryPage} onEdit={openEditEntry} onDelete={deleteEntry} />}
              {activePage === "analytics" && <AnalyticsPage />}
              {activePage === "diesel" && <DieselManagementPage />}
              {activePage === "reports" && <ReportsPage refreshKey={reportRefreshKey} />}
              {activePage === "alerts" && <AlertsPage />}
              {activePage === "settings" && <SettingsPage settings={settings} setSettings={setSettings} loading={settingsLoading} saving={settingsSaving} saved={settingsSaved} onSave={saveSettings} onReset={resetSettings} onRefresh={loadSettings} onRefreshApp={refreshAll} profile={profile} onSignOut={handleSignOut} onChangePassword={changePassword} />}
              {activePage === "people" && <PeoplePage tab={peopleTab} setTab={(tab) => { setPeopleTab(tab); setPeoplePage(0); setPeopleSearch(""); setSelectedEmployee(null); setSelectedBus(null); }} search={peopleSearch} setSearch={(v) => { setPeopleSearch(v); setPeoplePage(0); }} page={peoplePage} setPage={setPeoplePage} employees={employees} buses={buses} loading={peopleLoading} total={peopleTotal} onEmployee={openEmployeeProfile} onBus={openBusProfile} onAddEmployee={profile.role === "Admin" ? openEmployeeModal : undefined} onAddBus={profile.role === "Admin" ? openBusModal : undefined} />}
            </>
          )}
        </main>
      </div>

      {showAddModal && <AddVehicleModal form={addForm} setForm={setAddForm} editing={Boolean(editingEntry)} saving={saving} onClose={() => { setShowAddModal(false); setEditingEntry(null); }} onSave={saveEntry} />}
      {closingEntry && <CloseVehicleModal entry={closingEntry} form={closeForm} setForm={setCloseForm} closing={closing} onClose={() => setClosingEntry(null)} onCloseEntry={closeVehicleEntry} />}
      {showEmployeeModal && <MasterEmployeeModal form={employeeForm} setForm={setEmployeeForm} saving={masterSaving} onClose={() => setShowEmployeeModal(false)} onSave={saveEmployeeMaster} />}
      {showBusModal && <MasterBusModal form={busForm} setForm={setBusForm} saving={masterSaving} onClose={() => setShowBusModal(false)} onSave={saveBusMaster} />}
      {(selectedEmployee || selectedBus) && <ProfileModal employee={selectedEmployee} bus={selectedBus} history={profileHistory} total={profileTotal} page={profilePage} loading={profileLoading} onPage={(page) => { setProfilePage(page); if (selectedEmployee) loadEmployeeHistory(selectedEmployee.id, page); if (selectedBus) loadBusHistory(selectedBus.id, page); }} onClose={() => { setSelectedEmployee(null); setSelectedBus(null); }} />}
    </div>
  );
}

function SettingsPage({ settings, setSettings, loading, saving, saved, onSave, onReset, onRefresh, onRefreshApp, profile, onSignOut, onChangePassword }: { settings: SettingsState; setSettings: React.Dispatch<React.SetStateAction<SettingsState>>; loading: boolean; saving: boolean; saved: boolean; onSave: () => void; onReset: () => void; onRefresh: () => void; onRefreshApp: () => void; profile: UserProfile; onSignOut: () => void; onChangePassword: (newPassword: string) => Promise<void>; }) {
  const updateSection = <K extends keyof SettingsState>(section: K, value: Partial<SettingsState[K]>) => {
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  };

  return <div className="mx-auto max-w-[1100px]">
    <PageHeader
      eyebrow="System"
      title="Settings"
      description="Manage the basic settings of the MSRTC Diesel Management System from one place."
    />

    {loading ? <LoadingScreen /> : <>
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-extrabold text-slate-900">System Settings</p>
            <p className="mt-1 text-sm text-slate-500">Update the settings below and click Save Settings.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw size={16} /> Reload
            </button>
            <button onClick={onRefreshApp} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Database size={16} /> Refresh Data
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <SettingsSection icon={<Building2 size={18} />} title="General" description="Basic depot information used across the application.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Depot Name" value={settings.depot_profile.depot_name} onChange={(v) => updateSection("depot_profile", { depot_name: v })} placeholder="Enter depot name" />
            <FormInput label="Division" value={settings.depot_profile.division_name} onChange={(v) => updateSection("depot_profile", { division_name: v })} placeholder="Enter division" />
            <FormInput label="Depot Code" value={settings.depot_profile.depot_code} onChange={(v) => updateSection("depot_profile", { depot_code: v })} placeholder="e.g. PUN-01" />
            <FormInput label="Location" value={settings.depot_profile.location} onChange={(v) => updateSection("depot_profile", { location: v })} placeholder="Depot location" />
            <FormInput label="Contact Number" value={settings.depot_profile.contact_number} onChange={(v) => updateSection("depot_profile", { contact_number: v })} placeholder="Contact number" />
            <FormInput label="Email" type="email" value={settings.depot_profile.email} onChange={(v) => updateSection("depot_profile", { email: v })} placeholder="Depot email" />
          </div>
        </SettingsSection>

        <SettingsSection icon={<SlidersHorizontal size={18} />} title="Data & Display" description="Choose the default format and behavior of the application.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">Default Shift</label>
              <select value={settings.operations.default_shift} onChange={(e) => updateSection("operations", { default_shift: e.target.value as Shift })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#9f1d20]">
                <option>Morning</option><option>Evening</option><option>Night</option>
              </select>
            </div>
            <FormInput label="Default Route" value={settings.operations.default_route} onChange={(v) => updateSection("operations", { default_route: v })} placeholder="Optional default route" />
            <FormInput label="Default Bus Type" value={settings.operations.default_bus_type} onChange={(v) => updateSection("operations", { default_bus_type: v })} placeholder="e.g. Ordinary" />
            <FormInput label="Auto Refresh (minutes)" type="number" value={String(settings.operations.auto_refresh_minutes)} onChange={(v) => updateSection("operations", { auto_refresh_minutes: Math.max(1, Number(v) || 1) })} />
            <FormInput label="Timezone" value={settings.system.timezone} onChange={(v) => updateSection("system", { timezone: v })} />
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">Date Format</label>
              <select value={settings.system.date_format} onChange={(e) => updateSection("system", { date_format: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#9f1d20]">
                <option>DD/MM/YYYY</option><option>YYYY-MM-DD</option><option>MM/DD/YYYY</option>
              </select>
            </div>
            <FormInput label="Decimal Places" type="number" value={String(settings.system.decimal_places)} onChange={(v) => updateSection("system", { decimal_places: Math.min(4, Math.max(0, Number(v) || 0)) })} />
          </div>
        </SettingsSection>

        <SettingsSection icon={<Bell size={18} />} title="Notifications & Alerts" description="Control the important diesel and vehicle alerts shown by the system.">
          <div className="space-y-3">
            <ToggleRow label="Low KMPL Alert" description="Flag closed trips below the selected KMPL value." checked={settings.alerts.low_kmpl_enabled} onChange={(v) => updateSection("alerts", { low_kmpl_enabled: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput label="Low KMPL Threshold" type="number" value={String(settings.alerts.low_kmpl_threshold)} onChange={(v) => updateSection("alerts", { low_kmpl_threshold: Math.max(0, Number(v) || 0) })} />
              <FormInput label="High Diesel / 100 KM" type="number" value={String(settings.alerts.high_diesel_per_100km)} onChange={(v) => updateSection("alerts", { high_diesel_per_100km: Math.max(0, Number(v) || 0) })} />
            </div>
            <ToggleRow label="High Diesel Alert" description="Flag trips with unusually high diesel consumption." checked={settings.alerts.high_diesel_enabled} onChange={(v) => updateSection("alerts", { high_diesel_enabled: v })} />
            <ToggleRow label="Running Vehicle Alert" description="Show vehicles that are currently running and have not been closed." checked={settings.alerts.running_trip_enabled} onChange={(v) => updateSection("alerts", { running_trip_enabled: v })} />
          </div>
        </SettingsSection>

        <SettingsSection icon={<FileText size={18} />} title="Reports" description="Set the default information used when generating reports.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormInput label="Organization Name" value={settings.reports.organization_name} onChange={(v) => updateSection("reports", { organization_name: v })} /></div>
            <FormInput label="Report Title" value={settings.reports.report_title} onChange={(v) => updateSection("reports", { report_title: v })} />
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">Default Report Period</label>
              <select value={settings.reports.default_period} onChange={(e) => updateSection("reports", { default_period: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#9f1d20]">
                <option value="current_year">Current Year</option><option value="current_month">Current Month</option><option value="last_30_days">Last 30 Days</option>
              </select>
            </div>
            <div className="sm:col-span-2"><FormInput label="Report Footer" value={settings.reports.footer_text} onChange={(v) => updateSection("reports", { footer_text: v })} /></div>
          </div>
        </SettingsSection>

        <AccountSecuritySection profile={profile} onSignOut={onSignOut} onChangePassword={onChangePassword} />

        <SettingsSection icon={<Database size={18} />} title="System Information" description="Basic application information and maintenance actions.">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoSetting label="Application" value="MSRTC Diesel Management System" />
            <InfoSetting label="Database" value="Supabase PostgreSQL" />
            <InfoSetting label="Platform" value="Next.js Web Application" />
            <InfoSetting label="Timezone" value={settings.system.timezone} />
          </div>
        </SettingsSection>
      </div>

      <div className="sticky bottom-4 z-20 mt-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {saved ? <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} />Settings saved successfully.</p> : <p className="text-xs text-slate-500">Save changes after updating the settings.</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onReset} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset Defaults</button>
          <button onClick={onSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <><RefreshCw size={17} className="animate-spin" />Saving...</> : <><Save size={17} />Save Settings</>}
          </button>
        </div>
      </div>
    </>}
  </div>;
}

function SettingsSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</div>
      <div><h3 className="font-extrabold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
    </div>
    <div className="mt-5">{children}</div>
  </section>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50">
    <div><p className="text-sm font-bold text-slate-900">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#9f1d20]" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></span>
  </button>;
}

function SecurityRow({ title, value }: { title: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-sm font-bold text-slate-900">{title}</p><span className="text-right text-xs font-semibold text-slate-500">{value}</span></div>;
}

function InfoSetting({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>;
}

function ReportsPage({ refreshKey }: { refreshKey: number }) {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ summary: {}, monthly: [], vehicles: [], drivers: [] });

  async function load() {
    if (!from || !to || from > to) {
      setError("Please select a valid report period.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_reports_dashboard", {
        p_from: from,
        p_to: to,
      });
      if (rpcError) throw rpcError;
      setData(result ?? { summary: {}, monthly: [], vehicles: [], drivers: [] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [refreshKey]);

  const summary = data.summary ?? {};
  const monthly = Array.isArray(data.monthly) ? data.monthly : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const drivers = Array.isArray(data.drivers) ? data.drivers : [];

  function downloadCsv() {
    const rows: string[][] = [
      ["MSRTC Diesel Management System"],
      ["Report Period", from, to],
      [],
      ["Summary"],
      ["Total Trips", String(summary.total_trips ?? 0)],
      ["Total KM", String(summary.total_km ?? 0)],
      ["Total Diesel (L)", String(summary.total_diesel ?? 0)],
      ["Average KMPL", String(summary.avg_kmpl ?? 0)],
      [],
      ["Vehicle-wise Report"],
      ["Vehicle", "Trips", "Total KM", "Diesel (L)", "KMPL"],
      ...vehicles.map((x: any) => [String(x.vehicle_no ?? ""), String(x.trips ?? 0), String(x.total_km ?? 0), String(x.diesel ?? 0), String(x.kmpl ?? 0)]),
      [],
      ["Driver-wise Report"],
      ["Driver", "Badge", "Trips", "Total KM", "Diesel (L)", "KMPL"],
      ...drivers.map((x: any) => [String(x.driver_name ?? ""), String(x.badge_no ?? ""), String(x.trips ?? 0), String(x.total_km ?? 0), String(x.diesel ?? 0), String(x.kmpl ?? 0)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MSRTC-Diesel-Report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  return <div className="mx-auto max-w-[1500px] print:max-w-none">
    <div className="print:hidden">
      <PageHeader eyebrow="Management Reports" title="Reports" description="Generate date-wise, monthly, vehicle-wise and driver-wise diesel reports from completed trips." />
      <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} loading={loading} onApply={load} label="Report Period" note="Reports include Closed trips only." />
      <div className="mb-6 flex flex-wrap gap-3">
        <button onClick={downloadCsv} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"><Download size={17} />Export CSV</button>
        <button onClick={printReport} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#9f1d20] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><FileText size={17} />Print / Save PDF</button>
      </div>
    </div>

    {error && <ErrorPanel message={error} onRetry={load} />}
    {loading && !error ? <LoadingScreen /> : !error && <div id="msrtc-report" className="space-y-6">
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-extrabold">MSRTC Diesel Management System</h1>
        <p className="mt-1 text-sm">Diesel Management Report • {from} to {to}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Trips" value={formatNumber(Number(summary.total_trips))} subtitle="Closed trips" icon={<Bus size={20} />} accent="blue" />
        <StatCard title="Total KM" value={`${formatNumber(Number(summary.total_km))} KM`} subtitle="Completed distance" icon={<TrendingUp size={20} />} accent="green" />
        <StatCard title="Total Diesel" value={`${formatNumber(Number(summary.total_diesel), 1)} L`} subtitle="Recorded diesel" icon={<Fuel size={20} />} accent="yellow" />
        <StatCard title="Average KMPL" value={`${formatNumber(Number(summary.avg_kmpl), 2)} KMPL`} subtitle="Total KM ÷ Diesel" icon={<Gauge size={20} />} accent="red" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold">Monthly Summary</h3><p className="mt-1 text-xs text-slate-500">Monthly trips, distance, diesel and average KMPL.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left"><thead className="bg-slate-50"><tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Month</th><th className="px-5 py-3">Trips</th><th className="px-5 py-3">Total KM</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KMPL</th></tr></thead><tbody className="divide-y divide-slate-100">{monthly.length ? monthly.map((x: any) => <tr key={x.month} className="text-sm"><td className="px-5 py-3 font-bold">{x.month}</td><td className="px-5 py-3">{formatNumber(Number(x.trips))}</td><td className="px-5 py-3">{formatNumber(Number(x.total_km))}</td><td className="px-5 py-3">{formatNumber(Number(x.diesel), 1)} L</td><td className="px-5 py-3 font-bold">{formatNumber(Number(x.kmpl), 2)}</td></tr>) : <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No completed trips in this period.</td></tr>}</tbody></table></div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold">Vehicle-wise Report</h3><p className="mt-1 text-xs text-slate-500">Distance and diesel consumption by bus.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-slate-50"><tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Vehicle</th><th className="px-5 py-3">Trips</th><th className="px-5 py-3">Total KM</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KMPL</th></tr></thead><tbody className="divide-y divide-slate-100">{vehicles.map((x: any) => <tr key={x.vehicle_no} className="text-sm"><td className="px-5 py-3 font-extrabold">{x.vehicle_no}</td><td className="px-5 py-3">{formatNumber(Number(x.trips))}</td><td className="px-5 py-3">{formatNumber(Number(x.total_km))} KM</td><td className="px-5 py-3">{formatNumber(Number(x.diesel), 1)} L</td><td className="px-5 py-3 font-bold">{formatNumber(Number(x.kmpl), 2)}</td></tr>)}</tbody></table></div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold">Driver-wise Report</h3><p className="mt-1 text-xs text-slate-500">Monthly/period distance and diesel records by driver.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50"><tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Badge</th><th className="px-5 py-3">Trips</th><th className="px-5 py-3">Total KM</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KMPL</th></tr></thead><tbody className="divide-y divide-slate-100">{drivers.map((x: any) => <tr key={`${x.driver_name}-${x.badge_no}`} className="text-sm"><td className="px-5 py-3 font-extrabold">{x.driver_name}</td><td className="px-5 py-3">{x.badge_no || "—"}</td><td className="px-5 py-3">{formatNumber(Number(x.trips))}</td><td className="px-5 py-3">{formatNumber(Number(x.total_km))} KM</td><td className="px-5 py-3">{formatNumber(Number(x.diesel), 1)} L</td><td className="px-5 py-3 font-bold">{formatNumber(Number(x.kmpl), 2)}</td></tr>)}</tbody></table></div>
      </div>
    </div>}
  </div>;
}

function AnalyticsPage() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ summary: {}, monthly: [], yearly: [], vehicles: [], drivers: [] });

  async function load() {
    if (!from || !to || from > to) { setError("Please select a valid date range."); return; }
    setLoading(true); setError("");
    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_analytics_dashboard", { p_from: from, p_to: to });
      if (rpcError) throw rpcError;
      setData(result ?? { summary: {}, monthly: [], yearly: [], vehicles: [], drivers: [] });
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const summary = data.summary ?? {};
  const monthly = Array.isArray(data.monthly) ? data.monthly : [];
  const yearly = Array.isArray(data.yearly) ? data.yearly : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const drivers = Array.isArray(data.drivers) ? data.drivers : [];
  const maxKm = Math.max(1, ...monthly.map((x: any) => Number(x.total_km ?? 0)));

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Operations Intelligence" title="Analytics" description="Analyze completed trips, distance, diesel consumption and KMPL from Supabase data." />
    <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} loading={loading} onApply={load} label="Analysis Period" note="Only Closed trips are included in Analytics." />
    {error && <ErrorPanel message={error} onRetry={load} />}
    {loading && !error ? <LoadingScreen /> : !error && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Completed Trips" value={formatNumber(Number(summary.total_trips))} subtitle="Closed trips in period" icon={<Bus size={20} />} accent="blue" />
        <StatCard title="Total KM" value={`${formatNumber(Number(summary.total_km))} KM`} subtitle="Completed distance" icon={<TrendingUp size={20} />} accent="green" />
        <StatCard title="Total Diesel" value={`${formatNumber(Number(summary.total_diesel), 1)} L`} subtitle="Recorded diesel" icon={<Fuel size={20} />} accent="yellow" />
        <StatCard title="Average KMPL" value={`${formatNumber(Number(summary.avg_kmpl), 2)} KMPL`} subtitle="Total KM ÷ Total Diesel" icon={<Gauge size={20} />} accent="red" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Monthly KM Trend</h3><p className="mt-1 text-xs text-slate-500">Completed distance by month</p></div><BarChart3 size={20} className="text-[#9f1d20]" /></div>{monthly.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">No closed trip data for this period.</div> : <div className="mt-6 space-y-4">{monthly.map((row: any) => <div key={row.period}><div className="mb-1 flex justify-between text-xs font-bold"><span>{row.period}</span><span>{formatNumber(Number(row.total_km))} KM</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#9f1d20]" style={{ width: `${Math.max(2, Number(row.total_km) / maxKm * 100)}%` }} /></div></div>)}</div>}</section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Year Comparison</h3><p className="mt-1 text-xs text-slate-500">Trips, KM, diesel and KMPL</p></div><CalendarDays size={20} className="text-blue-700" /></div><div className="mt-5 space-y-3">{yearly.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No yearly data.</p> : yearly.map((row: any) => <div key={row.year} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex justify-between"><span className="font-extrabold">{row.year}</span><span className="text-xs font-bold text-slate-500">{formatNumber(Number(row.trips))} trips</span></div><div className="mt-3 grid grid-cols-3 gap-2"><MiniSummary label="KM" value={formatNumber(Number(row.total_km))} /><MiniSummary label="Diesel" value={`${formatNumber(Number(row.total_diesel), 1)} L`} /><MiniSummary label="KMPL" value={formatNumber(Number(row.avg_kmpl), 2)} /></div></div>)}</div></section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><AnalyticsTable title="Vehicle-wise Performance" subtitle="Top vehicles by completed KM" rows={vehicles} nameKey="vehicle_no" /><AnalyticsTable title="Driver-wise Performance" subtitle="Top drivers by completed KM" rows={drivers} nameKey="driver_name" /></div>
    </>}
  </div>;
}

function AnalyticsTable({ title, subtitle, rows, nameKey }: { title: string; subtitle: string; rows: any[]; nameKey: string }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Trips</th><th className="px-5 py-3">KM</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KMPL</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No data available.</td></tr> : rows.map((row: any, i: number) => <tr key={`${row[nameKey]}-${i}`} className="hover:bg-slate-50"><td className="px-5 py-3 font-bold">{row[nameKey]}{row.badge_no ? <span className="ml-2 text-[10px] font-normal text-slate-400">Badge {row.badge_no}</span> : null}</td><td className="px-5 py-3">{formatNumber(Number(row.trips))}</td><td className="px-5 py-3 font-semibold">{formatNumber(Number(row.total_km))}</td><td className="px-5 py-3">{formatNumber(Number(row.total_diesel), 1)} L</td><td className="px-5 py-3">{formatNumber(Number(row.avg_kmpl), 2)}</td></tr>)}</tbody></table></div></section>;
}

function DieselManagementPage() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ summary: {}, daily: [], vehicles: [], alerts: [], running: [] });

  async function load() {
    if (!from || !to || from > to) { setError("Please select a valid date range."); return; }
    setLoading(true); setError("");
    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_diesel_management_summary", { p_from: from, p_to: to });
      if (rpcError) throw rpcError;
      setData(result ?? { summary: {}, daily: [], vehicles: [], alerts: [], running: [] });
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const summary = data.summary ?? {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const running = Array.isArray(data.running) ? data.running : [];
  const maxDaily = Math.max(1, ...daily.map((x: any) => Number(x.diesel_litres ?? 0)));

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Fuel Operations" title="Diesel Management" description="Monitor diesel consumption, KMPL, vehicle usage and low-efficiency records." />
    <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} loading={loading} onApply={load} label="Diesel Analysis Period" note="Diesel totals are based on Closed trips in the selected period." />
    {error && <ErrorPanel message={error} onRetry={load} />}
    {loading && !error ? <LoadingScreen /> : !error && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Diesel" value={`${formatNumber(Number(summary.total_diesel), 1)} L`} subtitle="Closed trips" icon={<Fuel size={20} />} accent="yellow" /><StatCard title="Diesel / Trip" value={`${formatNumber(Number(summary.diesel_per_trip), 1)} L`} subtitle="Average litres per trip" icon={<Gauge size={20} />} accent="blue" /><StatCard title="Average KMPL" value={`${formatNumber(Number(summary.avg_kmpl), 2)}`} subtitle="Total KM ÷ Diesel" icon={<TrendingUp size={20} />} accent="green" /><StatCard title="Low KMPL Alerts" value={formatNumber(Number(summary.low_kmpl_count))} subtitle="KMPL below 4.00" icon={<AlertTriangle size={20} />} accent="red" /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Daily Diesel Consumption</h3><p className="mt-1 text-xs text-slate-500">Litres recorded by entry date</p></div><Fuel size={20} className="text-amber-600" /></div>{daily.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">No diesel records for this period.</div> : <div className="mt-6 space-y-4">{daily.map((row: any) => <div key={row.date}><div className="mb-1 flex justify-between text-xs font-bold"><span>{row.date}</span><span>{formatNumber(Number(row.diesel_litres), 1)} L</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(2, Number(row.diesel_litres) / maxDaily * 100)}%` }} /></div></div>)}</div>}</section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Running Vehicles</h3><p className="mt-1 text-xs text-slate-500">Currently outside the depot</p></div><Activity size={20} className="text-amber-700" /></div>{running.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">No vehicles are currently running.</div> : <div className="mt-5 space-y-3">{running.slice(0, 10).map((row: any) => <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="font-extrabold">{row.vehicle_no}</span><StatusBadge status="Running" /></div><div className="mt-2 grid grid-cols-2 gap-3"><MiniSummary label="Driver" value={row.driver_name || "—"} /><MiniSummary label="Diesel" value={`${formatNumber(Number(row.diesel_litres), 1)} L`} /></div></div>)}</div>}</section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><DieselVehicleTable rows={vehicles} /><DieselAlertTable rows={alerts} /></div>
    </>}
  </div>;
}

function DieselVehicleTable({ rows }: { rows: any[] }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="font-extrabold">Vehicle-wise Diesel</h3><p className="mt-1 text-xs text-slate-500">Highest diesel consumption in selected period</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Vehicle</th><th className="px-5 py-3">Trips</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KM</th><th className="px-5 py-3">KMPL</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No data available.</td></tr> : rows.map((row: any, i: number) => <tr key={`${row.vehicle_no}-${i}`}><td className="px-5 py-3 font-bold">{row.vehicle_no}</td><td className="px-5 py-3">{formatNumber(Number(row.trips))}</td><td className="px-5 py-3 font-semibold">{formatNumber(Number(row.total_diesel), 1)} L</td><td className="px-5 py-3">{formatNumber(Number(row.total_km))}</td><td className="px-5 py-3">{formatNumber(Number(row.avg_kmpl), 2)}</td></tr>)}</tbody></table></div></section>;
}

function DieselAlertTable({ rows }: { rows: any[] }) {
  return <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm"><div className="border-b border-red-100 bg-red-50 p-5"><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-red-700" /><h3 className="font-extrabold text-red-900">Low KMPL Alerts</h3></div><p className="mt-1 text-xs text-red-700">Closed trips with KMPL below 4.00</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Vehicle</th><th className="px-5 py-3">KMPL</th><th className="px-5 py-3">Diesel</th><th className="px-5 py-3">KM</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-emerald-700">No low-KMPL records found.</td></tr> : rows.slice(0, 20).map((row: any, i: number) => <tr key={`${row.id}-${i}`}><td className="px-5 py-3">{row.entry_date}</td><td className="px-5 py-3 font-bold">{row.vehicle_no}</td><td className="px-5 py-3 font-extrabold text-red-700">{formatNumber(Number(row.kmpl), 2)}</td><td className="px-5 py-3">{formatNumber(Number(row.diesel_litres), 1)} L</td><td className="px-5 py-3">{formatNumber(Number(row.total_km))}</td></tr>)}</tbody></table></div></section>;
}

function DateFilter({ from, to, setFrom, setTo, loading, onApply, label, note }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; loading: boolean; onApply: () => void; label: string; note: string }) {
  return <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-extrabold">{label}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px_auto]"><FormInput label="From Date" type="date" value={from} onChange={setFrom} /><FormInput label="To Date" type="date" value={to} onChange={setTo} /><button onClick={onApply} disabled={loading} className="h-11 rounded-xl bg-[#9f1d20] px-5 text-sm font-bold text-white disabled:opacity-60">{loading ? "Loading..." : "Apply Filter"}</button></div></div></section>;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><Database className="mt-0.5 text-red-600" size={20} /><div><p className="font-bold text-red-800">Module data error</p><p className="mt-1 text-sm text-red-700">{message}</p><button onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div></div></div>;
}

function AlertsPage() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ summary: {}, alerts: [], running: [] });

  async function load() {
    if (!from || !to || from > to) {
      setError("Please select a valid alert monitoring period.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_alerts_dashboard", {
        p_from: from,
        p_to: to,
      });

      if (rpcError) throw rpcError;

      setData(result ?? { summary: {}, alerts: [], running: [] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data.summary ?? {};
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const running = Array.isArray(data.running) ? data.running : [];

  function alertTitle(type: string) {
    switch (type) {
      case "LOW_KMPL": return "Low KMPL";
      case "INVALID_DIESEL": return "Invalid Diesel";
      case "INVALID_KM": return "Invalid KM";
      case "MISSING_CLOSING": return "Missing Closing";
      default: return "Data Alert";
    }
  }

  function alertDescription(type: string) {
    switch (type) {
      case "LOW_KMPL": return "Diesel efficiency is below the configured threshold.";
      case "INVALID_DIESEL": return "Diesel quantity is missing or invalid.";
      case "INVALID_KM": return "Closing KM is lower than opening KM.";
      case "MISSING_CLOSING": return "The vehicle trip has not been closed properly.";
      default: return "Please review this vehicle entry.";
    }
  }

  function alertStyle(type: string) {
    switch (type) {
      case "LOW_KMPL":
        return { icon: "bg-red-100 text-red-700", badge: "bg-red-100 text-red-700" };
      case "INVALID_DIESEL":
        return { icon: "bg-amber-100 text-amber-700", badge: "bg-amber-100 text-amber-700" };
      case "INVALID_KM":
        return { icon: "bg-orange-100 text-orange-700", badge: "bg-orange-100 text-orange-700" };
      case "MISSING_CLOSING":
        return { icon: "bg-yellow-100 text-yellow-700", badge: "bg-yellow-100 text-yellow-700" };
      default:
        return { icon: "bg-slate-100 text-slate-700", badge: "bg-slate-100 text-slate-700" };
    }
  }

  function alertIcon(type: string) {
    switch (type) {
      case "LOW_KMPL": return <Fuel size={18} />;
      case "INVALID_DIESEL": return <Fuel size={18} />;
      case "INVALID_KM": return <Gauge size={18} />;
      case "MISSING_CLOSING": return <Clock3 size={18} />;
      default: return <AlertTriangle size={18} />;
    }
  }

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader
      eyebrow="Safety & Monitoring"
      title="Alerts"
      description="Monitor diesel efficiency, vehicle data quality and active running vehicles."
    />

    <DateFilter
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      loading={loading}
      onApply={load}
      label="Alert Monitoring Period"
      note="Alerts are calculated from vehicle entries in the selected period."
    />

    {error && <ErrorPanel message={error} onRetry={load} />}

    {loading && !error ? <LoadingScreen /> : !error && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Alerts" value={formatNumber(Number(summary.total_alerts ?? 0))} subtitle="Requires attention" icon={<AlertTriangle size={20} />} accent="red" />
        <StatCard title="Low KMPL" value={formatNumber(Number(summary.low_kmpl_count ?? 0))} subtitle="Below 4 KMPL" icon={<Fuel size={20} />} accent="red" />
        <StatCard title="Invalid Diesel" value={formatNumber(Number(summary.invalid_diesel_count ?? 0))} subtitle="Data validation" icon={<Fuel size={20} />} accent="yellow" />
        <StatCard title="Invalid KM" value={formatNumber(Number(summary.invalid_km_count ?? 0))} subtitle="KM validation" icon={<Gauge size={20} />} accent="yellow" />
        <StatCard title="Running Vehicles" value={formatNumber(Number(summary.running_vehicle_count ?? 0))} subtitle="Currently open" icon={<Activity size={20} />} accent="blue" />
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Active Alerts</h3>
            <p className="mt-1 text-xs text-slate-500">Vehicle entries that require review or correction.</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} />}
            title="No alerts found"
            description="No vehicle entries require attention for the selected period."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((item: any) => {
              const style = alertStyle(item.alert_type);
              return <div key={`${item.id}-${item.alert_type}`} className="p-5 transition hover:bg-slate-50">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
                      {alertIcon(item.alert_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900">{alertTitle(item.alert_type)}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${style.badge}`}>{item.alert_type}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{alertDescription(item.alert_type)}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                        <span className="font-bold text-slate-800">Vehicle: {item.vehicle_no || "—"}</span>
                        <span className="text-slate-500">Date: {item.entry_date || "—"}</span>
                        <span className="text-slate-500">Shift: {item.shift || "—"}</span>
                        <span className="text-slate-500">Route: {item.route || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Driver</p>
                      <p className="mt-1 truncate text-sm font-extrabold text-slate-800">{item.driver_name || "—"}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">Badge {item.badge_no || "—"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total KM</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-800">{item.total_km == null ? "—" : `${formatNumber(Number(item.total_km))} KM`}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Diesel</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-800">{item.diesel_litres == null ? "—" : `${formatNumber(Number(item.diesel_litres), 1)} L`}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">KMPL</p>
                      <p className={`mt-1 text-sm font-extrabold ${Number(item.kmpl) < 4 ? "text-red-600" : "text-slate-800"}`}>
                        {item.kmpl == null ? "—" : formatNumber(Number(item.kmpl), 2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>;
            })}
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Bus size={20} /></div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Running Vehicles</h3>
              <p className="mt-1 text-xs text-slate-500">Vehicles that have started their trip but have not been closed.</p>
            </div>
          </div>
        </div>

        {running.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={26} />}
            title="No vehicles are currently running"
            description="There are no open vehicle trips for the selected period."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Badge</th>
                  <th className="px-5 py-3">Conductor</th>
                  <th className="px-5 py-3">Start Date</th>
                  <th className="px-5 py-3">Start Time</th>
                  <th className="px-5 py-3">Opening KM</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {running.map((item: any) => <tr key={item.id} className="text-sm hover:bg-slate-50">
                  <td className="px-5 py-4 font-extrabold text-slate-900">{item.vehicle_no || "—"}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{item.driver_name || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{item.badge_no || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.conductor_name || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.entry_date || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.entry_time || "—"}</td>
                  <td className="px-5 py-4 font-bold text-slate-800">{item.opening_km == null ? "—" : `${formatNumber(Number(item.opening_km))} KM`}</td>
                  <td className="max-w-[220px] truncate px-5 py-4 text-slate-600">{item.route || "—"}</td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-blue-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />Running</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-[#f8f4e9] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#9f1d20] shadow-sm"><AlertTriangle size={18} /></div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">Alert Monitoring Rules</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">Low KMPL is currently flagged below 4 KMPL. Invalid diesel, invalid KM and missing closing information are also monitored automatically.</p>
          </div>
        </div>
      </div>
    </>}
  </div>;
}

function Sidebar({ activePage, sidebarOpen, onClose, onNavigate, runningCount, role }: { activePage: MainPage; sidebarOpen: boolean; onClose: () => void; onNavigate: (page: MainPage) => void; runningCount: number; role: "Admin" | "Officer" | "Clerk"; }) {
  return <>
    {sidebarOpen && <button onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" aria-label="Close menu" />}
    <aside className={`fixed inset-y-0 left-0 z-50 w-[270px] border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 px-5 py-5"><div className="flex items-center justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white"><img src="/msrtc-logo.png" alt="MSRTC Logo" className="h-full w-full object-contain" /></div><div className="min-w-0"><p className="font-extrabold tracking-wide">MSRTC</p><p className="truncate text-[11px] text-slate-500">Diesel Management System</p></div></div><button onClick={onClose} className="rounded-lg p-2 text-slate-500 lg:hidden"><X size={18} /></button></div></div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Operations</p>
          <div className="space-y-1">
            <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activePage === "dashboard"} onClick={() => onNavigate("dashboard")} />
            <SidebarItem icon={<Plus size={18} />} label="Add Vehicle Entry" active={activePage === "add"} onClick={() => onNavigate("add")} />
            <SidebarItem icon={<Activity size={18} />} label="Live Vehicles" active={activePage === "live"} badge={runningCount} onClick={() => onNavigate("live")} />
            <SidebarItem icon={<FileText size={18} />} label="Vehicle History" active={activePage === "history"} onClick={() => onNavigate("history")} />
            {role !== "Clerk" && <SidebarItem icon={<Users size={18} />} label="Employees & Buses" active={activePage === "people"} onClick={() => onNavigate("people")} />}
          </div>
          <p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Analytics</p>
          <div className="space-y-1">
            {role !== "Clerk" && <SidebarItem icon={<BarChart3 size={18} />} label="Analytics" active={activePage === "analytics"} onClick={() => onNavigate("analytics")} />}
            {role !== "Clerk" && <SidebarItem icon={<Fuel size={18} />} label="Diesel Management" active={activePage === "diesel"} onClick={() => onNavigate("diesel")} />}
            {role !== "Clerk" && <SidebarItem icon={<FileText size={18} />} label="Reports" active={activePage === "reports"} onClick={() => onNavigate("reports")} />}
            {role !== "Clerk" && <SidebarItem icon={<AlertTriangle size={18} />} label="Alerts" active={activePage === "alerts"} onClick={() => onNavigate("alerts")} />}
          </div>
          <p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">System</p>
          <div className="space-y-1">
            {role === "Admin" && <SidebarItem icon={<Settings size={18} />} label="Settings" active={activePage === "settings"} onClick={() => onNavigate("settings")} />}
          </div>
        </div>
        <div className="border-t border-slate-200 p-4"><div className="rounded-2xl bg-[#f8f4e9] p-4"><div className="flex items-center gap-2"><Zap size={17} className="text-[#9f1d20]" /><p className="text-sm font-bold">Live Operations</p></div><p className="mt-1 text-xs leading-5 text-slate-500">Track every vehicle from departure to return.</p></div></div>
      </div>
    </aside>
  </>;
}

function SidebarItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void; }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${active ? "bg-[#9f1d20] text-white shadow-lg" : "text-slate-600 hover:bg-slate-100"}`}>{icon}<span className="flex-1">{label}</span>{badge !== undefined && badge > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>{badge}</span>}</button>;
}

function Dashboard({ summary, runningEntries, onAdd, onLive, onClose, onPeople }: { summary: DashboardSummary; runningEntries: VehicleEntry[]; onAdd: () => void; onLive: () => void; onClose: (entry: VehicleEntry) => void; onPeople: () => void; }) {
  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-2 text-sm font-semibold text-[#9f1d20]">Operations Overview</p><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Diesel Control Dashboard</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Monitor vehicle departures, live trips, fuel usage, crew and fleet records without loading the full database into the browser.</p></div><button onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-5 py-3 text-sm font-bold text-white shadow-lg"><Plus size={18} />Add Vehicle Entry</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard title="Buses" value={formatNumber(summary.total_buses)} subtitle="Active fleet records" icon={<Bus size={20} />} accent="yellow" />
      <StatCard title="Diesel Today" value={`${formatNumber(summary.today_diesel, 1)} L`} subtitle="Recorded diesel" icon={<Fuel size={20} />} accent="green" />
      <StatCard title="KM Today" value={`${formatNumber(summary.today_km)} KM`} subtitle="Closed trips for today only" icon={<TrendingUp size={20} />} accent="blue" />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><h3 className="font-extrabold">Live Vehicles</h3></div><p className="mt-1 text-xs text-slate-500">Latest running trips</p></div><button onClick={onLive} className="text-sm font-bold text-[#9f1d20]">View all</button></div>{runningEntries.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No vehicles are currently running.</div> : <div className="divide-y divide-slate-100">{runningEntries.slice(0, 8).map((entry) => <div key={entry.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-[#9f1d20]"><Bus size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold">{entry.vehicle_no}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">RUNNING</span></div><p className="mt-1 text-xs text-slate-500">{entry.driver_name} • Badge {entry.badge_no}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{entry.route}</p></div><button onClick={() => onClose(entry)} className="rounded-xl bg-[#9f1d20] px-4 py-2.5 text-xs font-bold text-white">Close Trip</button></div>)}</div>}</section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8f4e9] text-[#9f1d20]"><Users size={19} /></div><div><h3 className="font-extrabold">Employees & Buses</h3><p className="text-xs text-slate-500">Master collection and history</p></div></div><p className="mt-5 text-sm leading-6 text-slate-600">Open any employee to see every bus and trip associated with that employee. Open any bus to see drivers, conductors, routes, KM, diesel and KMPL history.</p><button onClick={onPeople} className="mt-5 w-full rounded-xl bg-[#9f1d20] px-4 py-3 text-sm font-bold text-white">Open Employees & Buses</button><div className="mt-5 grid grid-cols-2 gap-3"><MiniSummary label="Total Trips" value={formatNumber(summary.total_trips)} /><MiniSummary label="Closed Trips" value={formatNumber(summary.closed_trips)} /></div></section>
    </div>
  </div>;
}

function LivePage({ entries, search, setSearch, onAdd, onClose, onEdit, onDelete }: { entries: VehicleEntry[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onClose: (entry: VehicleEntry) => void; onEdit: (entry: VehicleEntry) => void; onDelete: (entry: VehicleEntry) => void; }) {
  return <div className="mx-auto max-w-[1500px]"><PageHeader eyebrow="Live Operations" title="Live Vehicles" description="Only running records are loaded here, so the screen remains light even when historical data becomes large." actionLabel="Add Vehicle Entry" onAction={onAdd} /><div className="mb-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, driver, badge, conductor or route..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#9f1d20] focus:bg-white" /></div><div className="flex items-center rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700">{entries.length} shown</div></div>{entries.length === 0 ? <EmptyState icon={<Bus size={28} />} title="No running vehicles" description="Start a trip from Add Vehicle Entry and it will appear here." buttonLabel="Add Vehicle Entry" onClick={onAdd} /> : <div className="grid gap-4">{entries.map((entry) => <LiveVehicleCard key={entry.id} entry={entry} onClose={() => onClose(entry)} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />)}</div>}</div>;
}

function LiveVehicleCard({ entry, onClose, onEdit, onDelete }: { entry: VehicleEntry; onClose: () => void; onEdit: () => void; onDelete: () => void; }) {
  return <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#9f1d20]"><Bus size={26} /></div><div className="min-w-[170px]"><div className="flex items-center gap-2"><h3 className="text-lg font-extrabold">{entry.vehicle_no}</h3><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">RUNNING</span></div><p className="mt-1 text-xs text-slate-500">{entry.route}</p></div><div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><InfoItem icon={<UserRound size={15} />} label="Driver" value={entry.driver_name} secondary={`Badge ${entry.badge_no}`} /><InfoItem icon={<Users size={15} />} label="Conductor" value={entry.conductor_name} secondary={entry.conductor_badge_no ? `Badge ${entry.conductor_badge_no}` : "Badge —"} /><InfoItem icon={<Clock3 size={15} />} label="Departure" value={entry.entry_time} secondary={entry.entry_date} /><InfoItem icon={<TrendingUp size={15} />} label="Opening KM" value={`${formatNumber(entry.opening_km)} KM`} secondary={`${formatNumber(entry.diesel_litres, 1)} L diesel`} /></div><div className="flex flex-wrap gap-2"><button onClick={onClose} className="inline-flex items-center gap-2 rounded-xl bg-[#9f1d20] px-4 py-2.5 text-xs font-bold text-white"><CheckCircle2 size={15} />Close Trip</button><button onClick={onEdit} className="rounded-xl border border-slate-200 p-2.5 text-slate-600" title="Edit"><Edit3 size={16} /></button><button onClick={onDelete} className="rounded-xl border border-red-100 p-2.5 text-red-600" title="Delete"><Trash2 size={16} /></button></div></div></div>;
}

function HistoryPage({ entries, total, page, search, setSearch, onPage, onEdit, onDelete }: { entries: VehicleEntry[]; total: number; page: number; search: string; setSearch: (value: string) => void; onPage: (page: number) => void; onEdit: (entry: VehicleEntry) => void; onDelete: (entry: VehicleEntry) => void; }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="mx-auto max-w-[1500px]"><PageHeader eyebrow="Vehicle Records" title="Vehicle History" description="History is paginated at database level. The browser never downloads the complete trip table." /><div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, driver, badge, conductor or route..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#9f1d20] focus:bg-white" /></div></div>{entries.length === 0 ? <EmptyState icon={<FileText size={28} />} title="No vehicle history" description="No records match the current search." /> : <><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left"><thead className="border-b border-slate-200 bg-slate-50"><tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500"><th className="px-5 py-4">Vehicle</th><th className="px-5 py-4">Driver</th><th className="px-5 py-4">Conductor</th><th className="px-5 py-4">Departure</th><th className="px-5 py-4">Return</th><th className="px-5 py-4">KM</th><th className="px-5 py-4">Diesel</th><th className="px-5 py-4">KMPL</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.id} className="text-sm hover:bg-slate-50"><td className="px-5 py-4"><p className="font-extrabold">{entry.vehicle_no}</p><p className="text-xs text-slate-500">{entry.route}</p></td><td className="px-5 py-4"><p className="font-semibold">{entry.driver_name}</p><p className="text-xs text-slate-500">Badge: {entry.badge_no}</p></td><td className="px-5 py-4"><p className="font-semibold">{entry.conductor_name}</p><p className="text-xs text-slate-500">Badge: {entry.conductor_badge_no || "—"}</p></td><td className="px-5 py-4"><p className="font-semibold">{entry.entry_date}</p><p className="text-xs text-slate-500">{entry.entry_time}</p></td><td className="px-5 py-4">{entry.closing_date ? <><p className="font-semibold">{entry.closing_date}</p><p className="text-xs text-slate-500">{entry.closing_time}</p></> : <span className="text-xs font-semibold text-amber-600">Not returned</span>}</td><td className="px-5 py-4 font-bold">{formatNumber(entry.total_km)} KM</td><td className="px-5 py-4">{formatNumber(entry.diesel_litres, 1)} L</td><td className="px-5 py-4 font-bold">{entry.kmpl > 0 ? formatNumber(entry.kmpl, 2) : "—"}</td><td className="px-5 py-4"><StatusBadge status={entry.status} /></td><td className="px-5 py-4"><div className="flex gap-2">{entry.status === "Running" && <button onClick={() => onEdit(entry)} className="rounded-lg border border-slate-200 p-2 text-slate-600"><Edit3 size={15} /></button>}<button onClick={() => onDelete(entry)} className="rounded-lg border border-red-100 p-2 text-red-600"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></div><Pagination page={page} pages={pages} onPage={onPage} total={total} /></>}</div>;
}

function PeoplePage({ tab, setTab, search, setSearch, page, setPage, employees, buses, loading, total, onEmployee, onBus, onAddEmployee, onAddBus }: { tab: PeopleTab; setTab: (tab: PeopleTab) => void; search: string; setSearch: (value: string) => void; page: number; setPage: (page: number) => void; employees: Employee[]; buses: BusRecord[]; loading: boolean; total: number; onEmployee: (employee: Employee) => void; onBus: (bus: BusRecord) => void; onAddEmployee?: () => void; onAddBus?: () => void; }) {
  return <div className="mx-auto max-w-[1500px]"><PageHeader eyebrow="Master Collection" title="Employees & Buses" description="Central master records for every employee and every bus. Add master records here and open any record to view its complete trip history." /><div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row"><div className="flex rounded-xl bg-slate-100 p-1"><button onClick={() => setTab("employees")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "employees" ? "bg-white text-[#9f1d20] shadow-sm" : "text-slate-500"}`}>Employees</button><button onClick={() => setTab("buses")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "buses" ? "bg-white text-[#9f1d20] shadow-sm" : "text-slate-500"}`}>Buses</button></div><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "employees" ? "Search name, badge or role..." : "Search vehicle, depot or bus type..."} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#9f1d20] focus:bg-white" /></div>{((tab === "employees" && onAddEmployee) || (tab === "buses" && onAddBus)) && <button onClick={tab === "employees" ? onAddEmployee : onAddBus} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-5 text-sm font-bold text-white"><Plus size={17} />{tab === "employees" ? "Add Employee" : "Add Bus"}</button>}</div>{loading ? <LoadingScreen /> : tab === "employees" ? <EmployeeList employees={employees} onEmployee={onEmployee} /> : <BusList buses={buses} onBus={onBus} />}<Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPage={setPage} total={total} compact /></div>;
}

function EmployeeList({ employees, onEmployee }: { employees: Employee[]; onEmployee: (employee: Employee) => void; }) {
  if (!employees.length) return <EmptyState icon={<Users size={28} />} title="No employees found" description="Employees are created automatically when a valid driver or conductor is used in a trip." />;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => <button key={employee.id} onClick={() => onEmployee(employee)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#9f1d20]"><UserRound size={22} /></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{employee.status}</span></div><h3 className="mt-4 text-lg font-extrabold">{employee.name}</h3><p className="mt-1 text-xs text-slate-500">{employee.role} • Badge {employee.badge_no || "—"}</p><div className="mt-5 grid grid-cols-2 gap-3"><MiniSummary label="Trips" value={formatNumber(employee.total_trips)} /><MiniSummary label="Driving KM" value={formatNumber(employee.total_km)} /><MiniSummary label="Diesel" value={`${formatNumber(employee.total_diesel, 1)} L`} /><MiniSummary label="Buses" value={formatNumber(employee.buses_count)} /></div><p className="mt-5 text-xs font-bold text-[#9f1d20]">Open employee history →</p></button>)}</div>;
}

function BusList({ buses, onBus }: { buses: BusRecord[]; onBus: (bus: BusRecord) => void; }) {
  if (!buses.length) return <EmptyState icon={<Bus size={28} />} title="No buses found" description="Buses are created automatically when a vehicle number is used in a trip." />;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{buses.map((bus) => <button key={bus.id} onClick={() => onBus(bus)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Bus size={22} /></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{bus.status}</span></div><h3 className="mt-4 text-lg font-extrabold">{bus.vehicle_no}</h3><p className="mt-1 text-xs text-slate-500">{bus.bus_type || "Bus"} {bus.depot_name ? `• ${bus.depot_name}` : ""}</p><div className="mt-5 grid grid-cols-2 gap-3"><MiniSummary label="Trips" value={formatNumber(bus.total_trips)} /><MiniSummary label="Total KM" value={formatNumber(bus.total_km)} /><MiniSummary label="Diesel" value={`${formatNumber(bus.total_diesel, 1)} L`} /><MiniSummary label="Drivers" value={formatNumber(bus.drivers_count)} /></div><p className="mt-5 text-xs font-bold text-[#9f1d20]">Open bus history →</p></button>)}</div>;
}

function MasterEmployeeModal({ form, setForm, saving, onClose, onSave }: { form: { name: string; badge_no: string; role: string; employee_code: string; depot_name: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; badge_no: string; role: string; employee_code: string; depot_name: string }>>; saving: boolean; onClose: () => void; onSave: () => void; }) {
  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9f1d20]">Employee Master</p><h2 className="mt-1 text-xl font-extrabold">Add Employee</h2><p className="mt-1 text-xs text-slate-500">Create a reusable driver or conductor record for future trips.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500"><X size={20} /></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><FormInput label="Employee Name" value={form.name} onChange={(v) => setForm(x => ({ ...x, name: v }))} required /><FormInput label="Employee Code" value={form.employee_code} onChange={(v) => setForm(x => ({ ...x, employee_code: v }))} placeholder="Optional" /><div><label className="mb-2 block text-xs font-bold text-slate-700">Role<span className="ml-1 text-[#9f1d20]">*</span></label><select value={form.role} onChange={(e) => setForm(x => ({ ...x, role: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#9f1d20]"><option>Driver</option><option>Conductor</option><option>Officer</option><option>Clerk</option></select></div><FormInput label="Badge No." value={form.badge_no} onChange={(v) => setForm(x => ({ ...x, badge_no: v }))} placeholder={form.role === "Driver" ? "Required for driver" : "Optional"} required={form.role === "Driver"} /><FormInput label="Depot" value={form.depot_name} onChange={(v) => setForm(x => ({ ...x, depot_name: v }))} placeholder="Optional" /></div><div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold">Cancel</button><button onClick={onSave} disabled={saving} className="rounded-xl bg-[#9f1d20] px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Employee"}</button></div></div></div>;
}

function MasterBusModal({ form, setForm, saving, onClose, onSave }: { form: { vehicle_no: string; bus_type: string; depot_name: string }; setForm: React.Dispatch<React.SetStateAction<{ vehicle_no: string; bus_type: string; depot_name: string }>>; saving: boolean; onClose: () => void; onSave: () => void; }) {
  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9f1d20]">Bus Master</p><h2 className="mt-1 text-xl font-extrabold">Add Bus</h2><p className="mt-1 text-xs text-slate-500">Create the vehicle master record used by trip entries.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500"><X size={20} /></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><FormInput label="Vehicle Number" value={form.vehicle_no} onChange={(v) => setForm(x => ({ ...x, vehicle_no: v }))} placeholder="Example: MH-12-AB-1234" required /><FormInput label="Bus Type" value={form.bus_type} onChange={(v) => setForm(x => ({ ...x, bus_type: v }))} placeholder="Ordinary / Shivneri / AC" /><FormInput label="Depot" value={form.depot_name} onChange={(v) => setForm(x => ({ ...x, depot_name: v }))} placeholder="Depot name" /></div><div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold">Cancel</button><button onClick={onSave} disabled={saving} className="rounded-xl bg-[#9f1d20] px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Bus"}</button></div></div></div>;
}

function ProfileModal({ employee, bus, history, total, page, loading, onPage, onClose }: { employee: Employee | null; bus: BusRecord | null; history: HistoryRow[]; total: number; page: number; loading: boolean; onPage: (page: number) => void; onClose: () => void; }) {
  const title = employee?.name ?? bus?.vehicle_no ?? "History";
  const subtitle = employee ? `${employee.role} • Badge ${employee.badge_no || "—"}` : `${bus?.bus_type || "Bus"}${bus?.depot_name ? ` • ${bus.depot_name}` : ""}`;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9f1d20]">{employee ? "Employee History" : "Bus History"}</p><h2 className="mt-1 text-2xl font-extrabold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div><div className="max-h-[calc(92vh-125px)] overflow-y-auto p-5 sm:p-7"><div className="grid gap-3 sm:grid-cols-4"><CalculationCard label="Trips on page" value={formatNumber(history.length)} /><CalculationCard label="Total KM" value={formatNumber(employee?.total_km ?? bus?.total_km ?? 0)} /><CalculationCard label="Diesel" value={`${formatNumber(employee?.total_diesel ?? bus?.total_diesel ?? 0, 1)} L`} /><CalculationCard label={employee ? "Buses Driven" : "Drivers"} value={formatNumber(employee?.buses_count ?? bus?.drivers_count ?? 0)} /></div><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">{loading ? <div className="p-12 text-center text-sm text-slate-500">Loading history...</div> : history.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No trip history found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left"><thead className="bg-slate-50"><tr className="text-[10px] font-bold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bus</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Driver Badge</th><th className="px-4 py-3">Conductor</th><th className="px-4 py-3">Conductor Badge</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Opening</th><th className="px-4 py-3">Closing</th><th className="px-4 py-3">KM</th><th className="px-4 py-3">Diesel</th><th className="px-4 py-3">KMPL</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{history.map((row) => <tr key={row.id} className="text-xs hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold">{row.entry_date}</p><p className="text-slate-500">{row.entry_time}</p></td><td className="px-4 py-3 font-bold">{row.vehicle_no}</td><td className="px-4 py-3">{row.driver_name}</td><td className="px-4 py-3">{row.driver_badge_no || "—"}</td><td className="px-4 py-3">{row.conductor_name}</td><td className="px-4 py-3">{row.conductor_badge_no || "—"}</td><td className="px-4 py-3">{row.route}</td><td className="px-4 py-3">{formatNumber(row.opening_km)}</td><td className="px-4 py-3">{row.closing_km == null ? "—" : formatNumber(row.closing_km)}</td><td className="px-4 py-3 font-bold">{formatNumber(row.total_km)}</td><td className="px-4 py-3">{formatNumber(row.diesel_litres, 1)} L</td><td className="px-4 py-3 font-bold">{row.kmpl ? formatNumber(row.kmpl, 2) : "—"}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>}</div><div className="mt-4 flex items-center justify-between"><p className="text-xs text-slate-500">50 records are loaded per page.</p><Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPage={onPage} total={total} compact /></div></div></div></div>;
}

function AddVehicleModal({ form, setForm, editing, saving, onClose, onSave }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; editing: boolean; saving: boolean; onClose: () => void; onSave: () => void; }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9f1d20]">Vehicle Departure</p><h2 className="mt-1 text-xl font-extrabold">{editing ? "Edit Vehicle Entry" : "Add Vehicle Entry"}</h2><p className="mt-1 text-xs text-slate-500">Create a running trip. Closing KM is entered when the vehicle returns.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500"><X size={20} /></button></div><div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5 sm:p-7"><div className="grid gap-6"><section><SectionTitle icon={<Bus size={17} />} title="Vehicle Details" /><div className="mt-4 grid gap-4 md:grid-cols-2"><FormInput label="Vehicle Number" value={form.vehicle_no} onChange={(v) => setForm((x) => ({ ...x, vehicle_no: v }))} placeholder="Example: MH-12-AB-1234" required /><FormInput label="Route" value={form.route} onChange={(v) => setForm((x) => ({ ...x, route: v }))} placeholder="Example: Pune - Mumbai" required /><FormInput label="Departure Date" type="date" value={form.entry_date} onChange={(v) => setForm((x) => ({ ...x, entry_date: v }))} required /><FormInput label="Departure Time" type="time" value={form.entry_time} onChange={(v) => setForm((x) => ({ ...x, entry_time: v }))} required /><div><label className="mb-2 block text-xs font-bold text-slate-700">Shift</label><select value={form.shift} onChange={(e) => setForm((x) => ({ ...x, shift: e.target.value as Shift }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#9f1d20]"><option>Morning</option><option>Evening</option><option>Night</option></select></div></div></section><section><SectionTitle icon={<Users size={17} />} title="Crew Assignment" /><div className="mt-4 grid gap-4 md:grid-cols-2"><FormInput label="Driver Name" value={form.driver_name} onChange={(v) => setForm((x) => ({ ...x, driver_name: v }))} placeholder="Enter driver name" required /><FormInput label="Driver Badge No." value={form.badge_no} onChange={(v) => setForm((x) => ({ ...x, badge_no: v }))} placeholder="Enter driver badge number" required /><FormInput label="Conductor Name" value={form.conductor_name} onChange={(v) => setForm((x) => ({ ...x, conductor_name: v }))} placeholder="Enter conductor name" required /><FormInput label="Conductor Badge No." value={form.conductor_badge_no} onChange={(v) => setForm((x) => ({ ...x, conductor_badge_no: v }))} placeholder="Optional" /></div></section><section><SectionTitle icon={<Fuel size={17} />} title="Departure Fuel and KM" /><div className="mt-4 grid gap-4 md:grid-cols-2"><FormInput label="Opening KM" type="number" value={form.opening_km} onChange={(v) => setForm((x) => ({ ...x, opening_km: v }))} placeholder="Enter opening odometer" required /><FormInput label="Diesel Litres" type="number" value={form.diesel_litres} onChange={(v) => setForm((x) => ({ ...x, diesel_litres: v }))} placeholder="Enter diesel litres" required /></div><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Trip status</p><p className="mt-2 text-sm font-bold">RUNNING</p><p className="mt-1 text-xs text-slate-600">Closing KM and closing date/time will be captured when the vehicle returns.</p></div></section></div></div><div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold">Cancel</button><button onClick={onSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? <><RefreshCw size={17} className="animate-spin" />Saving...</> : <><CheckCircle2 size={17} />{editing ? "Update Vehicle Entry" : "Start Vehicle Trip"}</>}</button></div></div></div>;
}

function CloseVehicleModal({ entry, form, setForm, closing, onClose, onCloseEntry }: { entry: VehicleEntry; form: CloseFormState; setForm: React.Dispatch<React.SetStateAction<CloseFormState>>; closing: boolean; onClose: () => void; onCloseEntry: () => void; }) {
  const closingKm = Number(form.closing_km);
  const valid = Number.isFinite(closingKm) && closingKm >= entry.opening_km;
  const totalKm = valid ? closingKm - entry.opening_km : 0;
  const kmpl = totalKm > 0 && entry.diesel_litres > 0 ? totalKm / entry.diesel_litres : 0;
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Vehicle Return</p><h2 className="mt-2 text-xl font-extrabold">Close Vehicle Entry</h2><p className="mt-1 text-sm text-slate-500">{entry.vehicle_no} • {entry.driver_name} • {entry.conductor_name}</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500"><X size={20} /></button></div><div className="p-5 sm:p-7"><div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"><MiniSummary label="Opening KM" value={formatNumber(entry.opening_km)} /><MiniSummary label="Diesel" value={`${formatNumber(entry.diesel_litres, 1)} L`} /><MiniSummary label="Departure" value={`${entry.entry_date} ${entry.entry_time}`} /><MiniSummary label="Route" value={entry.route} /></div><div className="mt-6"><SectionTitle icon={<CheckCircle2 size={17} />} title="Closing Information" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><FormInput label="Closing Date" type="date" value={form.closing_date} onChange={(v) => setForm((x) => ({ ...x, closing_date: v }))} required /><FormInput label="Closing Time" type="time" value={form.closing_time} onChange={(v) => setForm((x) => ({ ...x, closing_time: v }))} required /><div className="sm:col-span-2"><FormInput label="Closing KM" type="number" value={form.closing_km} onChange={(v) => setForm((x) => ({ ...x, closing_km: v }))} placeholder="Enter closing odometer" required /></div></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><CalculationCard label="Total KM" value={valid ? `${formatNumber(totalKm)} KM` : "Enter closing KM"} /><CalculationCard label="Diesel" value={`${formatNumber(entry.diesel_litres, 1)} L`} /><CalculationCard label="KMPL" value={kmpl > 0 ? `${formatNumber(kmpl, 2)} KMPL` : "Auto calculated"} /></div></div><div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold">Cancel</button><button onClick={onCloseEntry} disabled={closing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{closing ? <><RefreshCw size={17} className="animate-spin" />Closing...</> : <><CheckCircle2 size={17} />Close Vehicle Entry</>}</button></div></div></div>;
}

function PageHeader({ eyebrow, title, description, actionLabel, onAction }: { eyebrow: string; title: string; description: string; actionLabel?: string; onAction?: () => void; }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-2 text-sm font-semibold text-[#9f1d20]">{eyebrow}</p><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div>{actionLabel && onAction && <button onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-5 py-3 text-sm font-bold text-white"><Plus size={18} />{actionLabel}</button>}</div>;
}

function StatCard({ title, value, subtitle, icon, accent }: { title: string; value: string; subtitle: string; icon: React.ReactNode; accent: "red" | "blue" | "yellow" | "green"; }) {
  const classes = { red: "bg-red-50 text-[#9f1d20]", blue: "bg-blue-50 text-blue-700", yellow: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p><p className="mt-3 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes[accent]}`}>{icon}</div></div></div>;
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-extrabold text-slate-800">{value}</p></div>;
}

function FormInput({ label, value, onChange, placeholder, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; }) {
  return <div><label className="mb-2 block text-xs font-bold text-slate-700">{label}{required && <span className="ml-1 text-[#9f1d20]">*</span>}</label><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#9f1d20] focus:ring-2 focus:ring-red-100" /></div>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</div><h3 className="text-sm font-extrabold">{title}</h3></div>;
}

function CalculationCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-extrabold text-slate-800">{value}</p></div>;
}

function InfoItem({ icon, label, value, secondary }: { icon: React.ReactNode; label: string; value: string; secondary?: string }) {
  return <div><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{icon}{label}</div><p className="mt-1 text-sm font-bold text-slate-800">{value}</p>{secondary && <p className="mt-0.5 text-[10px] text-slate-500">{secondary}</p>}</div>;
}

function StatusBadge({ status }: { status: VehicleStatus }) {
  return status === "Closed" ? <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">CLOSED</span> : <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">RUNNING</span>;
}

function Pagination({ page, pages, onPage, total, compact = false }: { page: number; pages: number; onPage: (page: number) => void; total?: number; compact?: boolean; }) {
  const safePages = Math.max(1, pages);
  return <div className={`mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 ${compact ? "shadow-none" : "shadow-sm"}`}><p className="text-xs text-slate-500">{total !== undefined ? `Total ${formatNumber(total)} records` : "50 records per page"}</p><div className="flex items-center gap-2"><button disabled={page <= 0} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Page {page + 1}</span><button disabled={page >= safePages - 1} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button></div></div>;
}

function EmptyState({ icon, title, description, buttonLabel, onClick }: { icon: React.ReactNode; title: string; description: string; buttonLabel?: string; onClick?: () => void; }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div><h3 className="mt-5 font-extrabold text-slate-800">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{buttonLabel && onClick && <button onClick={onClick} className="mt-5 rounded-xl bg-[#9f1d20] px-5 py-3 text-sm font-bold text-white">{buttonLabel}</button>}</div>;
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
          <img src="/msrtc-logo.png" alt="MSRTC Logo" className="h-full w-full object-contain" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
          <RefreshCw size={17} className="animate-spin text-[#9f1d20]" />
          Checking secure session...
        </div>
      </div>
    </div>
  );
}

function LoginPage({ errorMessage, onLoggedIn }: { errorMessage: string; onLoggedIn: (session: Session) => Promise<void>; }) {
  const [email, setEmail] = useState("admin@msrtc.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(errorMessage);
  const [message, setMessage] = useState("");
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => setError(errorMessage), [errorMessage]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!email.trim()) throw new Error("Enter your email address.");
      if (!forgotMode && !password) throw new Error("Enter your password.");

      if (forgotMode) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}`,
        });
        if (resetError) throw resetError;
        setMessage("If this email is registered, a password reset link has been sent.");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (!data.session) throw new Error("Login succeeded but no secure session was returned.");
      await onLoggedIn(data.session);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden bg-white lg:flex lg:flex-col lg:justify-between lg:border-r lg:border-slate-200 lg:p-12 xl:p-16">
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <img src="/msrtc-logo.png" alt="MSRTC Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#9f1d20]">MSRTC</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Diesel Management System</h1>
              </div>
            </div>
            <div className="mt-20 max-w-xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9f1d20]">Secure Operations</p>
              <h2 className="mt-4 text-5xl font-extrabold leading-tight tracking-tight text-slate-900">Manage every vehicle trip with confidence.</h2>
              <p className="mt-6 text-base leading-7 text-slate-500">Centralized diesel entry, live vehicle status, closing records, analytics and reports for depot operations.</p>
            </div>
          </div>
          <div className="rounded-3xl bg-[#f8f4e9] p-6">
            <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-[#9f1d20]" /><p className="font-extrabold">Protected with Supabase Authentication</p></div>
            <p className="mt-2 text-sm leading-6 text-slate-500">Access is controlled using authenticated sessions and application roles.</p>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"><img src="/msrtc-logo.png" alt="MSRTC Logo" className="h-full w-full object-contain" /></div>
                <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9f1d20]">MSRTC</p><p className="font-extrabold">Diesel Management System</p></div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
              <div className="mb-7">
                <p className="text-sm font-bold text-[#9f1d20]">Account & Security</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{forgotMode ? "Reset your password" : "Welcome back"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{forgotMode ? "Enter your registered email to receive a secure password reset link." : "Sign in to continue to the MSRTC Diesel Management System."}</p>
              </div>

              {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">{error}</div>}
              {message && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">{message}</div>}

              <form onSubmit={submit} className="space-y-5">
                <FormInput label="Email Address" type="email" value={email} onChange={setEmail} placeholder="Enter your email" required />
                {!forgotMode && <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Password<span className="ml-1 text-[#9f1d20]">*</span></label>
                  <div className="relative">
                    <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#9f1d20] focus:ring-2 focus:ring-red-100" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>}

                <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-5 text-sm font-extrabold text-white shadow-lg shadow-red-900/15 transition hover:bg-[#86171a] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <><RefreshCw size={17} className="animate-spin" />Processing...</> : forgotMode ? <><Mail size={17} />Send Reset Link</> : <><ShieldCheck size={17} />Sign In Securely</>}
                </button>
              </form>

              <button onClick={() => { setForgotMode((v) => !v); setError(""); setMessage(""); }} className="mt-5 w-full text-center text-xs font-bold text-[#9f1d20] hover:underline">
                {forgotMode ? "Back to Sign In" : "Forgot Password?"}
              </button>
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Authorized MSRTC users only. Access and changes may be recorded for operational security.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSecuritySection({ profile, onSignOut, onChangePassword }: { profile: UserProfile; onSignOut: () => void; onChangePassword: (newPassword: string) => Promise<void>; }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function updatePassword() {
    setMessage("");
    setError("");
    if (newPassword.length < 8) return setError("Password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setSaving(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return <SettingsSection icon={<ShieldCheck size={18} />} title="Account & Security" description="Manage the signed-in account and authentication security.">
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#9f1d20]"><UserCog size={22} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold">{profile.full_name || "User"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Mail size={14} />{profile.email || "No email"}</p>
          </div>
          <span className="rounded-full bg-red-100 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#9f1d20]">{profile.role}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SecurityRow title="Account Status" value={profile.status} />
          <SecurityRow title="Depot" value={profile.depot_name || "Not assigned"} />
          <SecurityRow title="Employee Code" value={profile.employee_code || "Not assigned"} />
          <SecurityRow title="Badge Number" value={profile.badge_no || "Not assigned"} />
        </div>
        <button onClick={onSignOut} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"><LogOut size={16} />Sign Out</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2"><KeyRound size={18} className="text-[#9f1d20]" /><p className="font-extrabold">Change Password</p></div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Use at least 8 characters. Your current session remains active after the change.</p>
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</div>}
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">New Password</label>
            <div className="relative">
              <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 pr-11 text-sm outline-none focus:border-[#9f1d20] focus:ring-2 focus:ring-red-100" placeholder="Minimum 8 characters" />
              <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500">{showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </div>
          <FormInput label="Confirm New Password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />
          <button onClick={updatePassword} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f1d20] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? <><RefreshCw size={17} className="animate-spin" />Updating...</> : <><KeyRound size={17} />Update Password</>}</button>
        </div>
      </div>
    </div>
  </SettingsSection>;
}

function LoadingScreen() {
  return <div className="flex min-h-[500px] items-center justify-center"><div className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#9f1d20]"><RefreshCw size={24} className="animate-spin" /></div><p className="mt-4 font-bold text-slate-700">Loading vehicle data...</p><p className="mt-1 text-sm text-slate-500">Connecting to the database</p></div></div>;
}
