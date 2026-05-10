import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  CalendarCheck,
  Clock,
  Lock,
  Info,
  Flame,
  CheckCircle2,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { key: "monday", label: "Luni" },
  { key: "tuesday", label: "Marți" },
  { key: "wednesday", label: "Miercuri" },
  { key: "thursday", label: "Joi" },
  { key: "friday", label: "Vineri" },
  { key: "saturday", label: "Sâmbătă" },
  { key: "sunday", label: "Duminică" },
];

// Driver editable: 10:00-22:00 (12 intervals: 10-11, 11-12, ..., 21-22)
const DRIVER_HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 10).padStart(2, "0")}:00`);
// Night: 22-23, 23-00, 00-01, 01-02 (admin only, read-only for driver)
const NIGHT_HOURS = ["22:00", "23:00", "00:00", "01:00"];
const ALL_HOURS = [...DRIVER_HOURS, ...NIGHT_HOURS];

function formatInterval(hour) {
  const h = parseInt(hour);
  const next = (h + 1) % 24;
  return `${String(h).padStart(2, "0")}-${String(next).padStart(2, "0")}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(monday) {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  const opts = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("ro-RO", opts)} - ${sun.toLocaleDateString("ro-RO", opts)}`;
}

function toISODate(d) {
  return d.toISOString().split("T")[0];
}

export const DriverSchedule = ({ driverId }) => {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [slots, setSlots] = useState({});
  const [saving, setSaving] = useState(false);
  const [totalHours, setTotalHours] = useState(0);
  const [windowOpen, setWindowOpen] = useState(true);
  const [scheduleWindowInfo, setScheduleWindowInfo] = useState(null);
  const [emergencySlots, setEmergencySlots] = useState([]);
  const [claimDialog, setClaimDialog] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [rankDialogOpen, setRankDialogOpen] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!driverId) return;
    try {
      const [schedRes, windowRes, emergencyRes] = await Promise.all([
        axios.get(`${API_URL}/api/schedules/driver/${driverId}?year=${weekStart.getFullYear()}`),
        axios.get(`${API_URL}/api/schedules/scheduling-window`),
        axios.get(`${API_URL}/api/schedules/emergency?week_start=${toISODate(weekStart)}`),
      ]);
      const wsKey = toISODate(weekStart);
      const found = schedRes.data.find((s) => s.week_start === wsKey);
      if (found) {
        setSlots(found.slots || {});
        setTotalHours(found.total_hours || 0);
      } else {
        setSlots({});
        setTotalHours(0);
      }
      setWindowOpen(windowRes.data.can_select_schedule ?? windowRes.data.is_open);
      setScheduleWindowInfo(windowRes.data);
      setEmergencySlots(emergencyRes.data);
    } catch {
      setSlots({});
      setTotalHours(0);
    }
  }, [driverId, weekStart, setEmergencySlots, setScheduleWindowInfo, setSlots, setTotalHours, setWindowOpen]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const isNightHour = (hour) => NIGHT_HOURS.includes(hour);
  const isAdminSlot = (dayKey, hour) => (slots[dayKey] || []).some((s) => s.start === hour && s.added_by === "admin");
  const isEmergencySlot = (dayKey, hour) => (slots[dayKey] || []).some((s) => s.start === hour && s.added_by === "emergency");

  const getAvailableEmergency = (dayKey, hour) => {
    // Only show emergency slots where driver has NO schedule at this hour
    const hasSchedule = (slots[dayKey] || []).some((s) => s.start === hour);
    if (hasSchedule) return null;
    return emergencySlots.find((s) => s.day === dayKey && s.hour === hour && s.remaining_spots > 0 && !(s.claimed_by || []).includes(driverId));
  };

  const toggleHour = (dayKey, hour) => {
    if (isNightHour(hour)) return;
    if (isAdminSlot(dayKey, hour)) return;
    if (isEmergencySlot(dayKey, hour)) return;
    if (!windowOpen) return;

    setSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      const exists = daySlots.find((s) => s.start === hour && s.added_by !== "admin" && s.added_by !== "emergency");
      let newDaySlots;
      if (exists) {
        newDaySlots = daySlots.filter((s) => !(s.start === hour && s.added_by !== "admin" && s.added_by !== "emergency"));
      } else {
        const endH = (parseInt(hour) + 1) % 24;
        newDaySlots = [...daySlots, { start: hour, end: `${String(endH).padStart(2, "0")}:00`, added_by: "driver" }];
      }
      const newSlots = { ...prev, [dayKey]: newDaySlots };
      let total = 0;
      Object.values(newSlots).forEach((ds) => { total += ds.length; });
      setTotalHours(total);
      return newSlots;
    });
  };

  const isSelected = (dayKey, hour) => (slots[dayKey] || []).some((s) => s.start === hour);

  const claimEmergencySlot = async () => {
    if (!claimDialog) return;
    setClaiming(true);
    try {
      const res = await axios.post(`${API_URL}/api/schedules/emergency/${claimDialog.id}/claim`);
      toast.success(res.data.message);
      setClaimDialog(null);
      fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Eroare la preluare slot");
    } finally {
      setClaiming(false);
    }
  };

  const saveSchedule = async () => {
    if (!windowOpen) {
      toast.error("Programul poate fi modificat doar Duminică 22:00 - Luni 10:00");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/schedules`, {
        driver_id: driverId,
        week_start: toISODate(weekStart),
        slots,
        source: "driver",
      });
      toast.success("Program salvat cu succes!");
      fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (dir) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const selectFullDay = (dayKey) => {
    if (!windowOpen) return;
    setSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      const adminSlots = daySlots.filter((s) => s.added_by === "admin" || s.added_by === "emergency");
      const driverSlots = daySlots.filter((s) => s.added_by !== "admin" && s.added_by !== "emergency");

      let newSlots;
      if (driverSlots.length === DRIVER_HOURS.length) {
        newSlots = { ...prev, [dayKey]: adminSlots };
      } else {
        const fullDriverSlots = DRIVER_HOURS.map((h) => {
          const endH = (parseInt(h) + 1) % 24;
          return { start: h, end: `${String(endH).padStart(2, "0")}:00`, added_by: "driver" };
        });
        newSlots = { ...prev, [dayKey]: [...fullDriverSlots, ...adminSlots] };
      }
      let total = 0;
      Object.values(newSlots).forEach((ds) => { total += ds.length; });
      setTotalHours(total);
      return newSlots;
    });
  };

  const driverHoursCount = useMemo(
    () => Object.values(slots).reduce((sum, ds) => sum + ds.filter((s) => s.added_by === "driver" || !s.added_by).length, 0),
    [slots],
  );
  const adminHoursCount = useMemo(
    () => Object.values(slots).reduce((sum, ds) => sum + ds.filter((s) => s.added_by === "admin").length, 0),
    [slots],
  );
  const emergencyCount = useMemo(
    () => Object.values(slots).reduce((sum, ds) => sum + ds.filter((s) => s.added_by === "emergency").length, 0),
    [slots],
  );
  const availableEmergencyCount = useMemo(
    () => emergencySlots.filter((slot) => {
      const hasSchedule = (slots[slot.day] || []).some((scheduledSlot) => scheduledSlot.start === slot.hour);
      return !hasSchedule && slot.remaining_spots > 0 && !(slot.claimed_by || []).includes(driverId);
    }).length,
    [driverId, emergencySlots, slots],
  );

  return (
    <Card data-testid="driver-schedule-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-5 h-5" />
            Program Săptămânal
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Badge variant="outline" className="text-xs">{driverHoursCount}h ale tale</Badge>
            {adminHoursCount > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">{adminHoursCount}h admin</Badge>}
            {emergencyCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{emergencyCount}h urgență</Badge>}
          </div>
        </div>

        {/* Scheduling window info */}
        <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs ${
          windowOpen ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          {windowOpen ? (
            <>
              <CalendarCheck className="w-4 h-4 shrink-0" />
              <span className="font-medium">Fereastra de program este DESCHISĂ.</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 shrink-0" />
              <span className="font-medium">Programul se poate modifica doar Duminică 22:00 - Luni 10:00</span>
            </>
          )}
        </div>

        {scheduleWindowInfo?.tier && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs" data-testid="driver-ranking-access-info">
            <button type="button" onClick={() => setRankDialogOpen(true)} data-testid="driver-rank-info-button">
              <Badge className="bg-slate-900 text-white">Tier {scheduleWindowInfo.tier}</Badge>
            </button>
            <button type="button" onClick={() => setRankDialogOpen(true)} data-testid="driver-score-info-button">
              <Badge variant="outline">Scor {scheduleWindowInfo.score}</Badge>
            </button>
            {!windowOpen && <Badge variant="outline">Acces de la {scheduleWindowInfo.opens_at_label || scheduleWindowInfo.opens_at}</Badge>}
          </div>
        )}

        {/* Emergency slots notification */}
        {availableEmergencyCount > 0 && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200 animate-pulse">
            <Flame className="w-4 h-4 shrink-0" />
            <span className="font-bold">{availableEmergencyCount} sloturi de urgență disponibile! Apasă pe celulele roșii pentru a le lua.</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} data-testid="prev-week-btn">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium text-sm" data-testid="week-range">{formatWeekRange(weekStart)}</span>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} data-testid="next-week-btn">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-orange-500" /><span>Orele tale</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-blue-500" /><span>Admin</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-500" /><span>Urgență</span></div>
          <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-slate-300" /><span className="flex items-center gap-1"><Lock className="w-3 h-3" />Noapte</span></div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[440px] text-xs" role="table" aria-label="Program săptămânal livrator">
            <div className="grid grid-cols-[80px_repeat(7,minmax(44px,1fr))] items-center" role="row">
              <div className="sticky left-0 z-10 bg-card p-1 text-left font-semibold" role="columnheader">
                <Clock className="w-3 h-3 inline mr-1" />Ora
              </div>
              {DAYS.map((d) => (
                <div key={d.key} className="p-1 text-center" role="columnheader">
                  <button
                    type="button"
                    className={`font-semibold ${windowOpen ? "hover:text-primary" : "cursor-default text-muted-foreground"}`}
                    onClick={() => windowOpen && selectFullDay(d.key)}
                  >
                    {d.label.substring(0, 3)}
                  </button>
                </div>
              ))}
            </div>

            {ALL_HOURS.map((hour) => {
              const isNight = isNightHour(hour);
              return (
                <div key={hour} className={`grid grid-cols-[80px_repeat(7,minmax(44px,1fr))] items-center ${isNight ? "bg-slate-50" : ""}`} role="row">
                  <div className={`sticky left-0 z-10 p-1 font-mono ${isNight ? "text-slate-400 bg-slate-50" : "text-muted-foreground bg-card"}`} role="rowheader">
                    {formatInterval(hour)} {isNight && <Lock className="w-2.5 h-2.5 inline ml-0.5" />}
                  </div>
                  {DAYS.map((d) => {
                    const sel = isSelected(d.key, hour);
                    const admin = isAdminSlot(d.key, hour);
                    const emergency = isEmergencySlot(d.key, hour);
                    const availEmergency = getAvailableEmergency(d.key, hour);
                    const canEdit = !isNight && !admin && !emergency && windowOpen;

                    let cellClass = "bg-muted/30";
                    let cellContent = "";

                    if (emergency) {
                      cellClass = "bg-red-500";
                    } else if (sel && admin) {
                      cellClass = "bg-blue-500";
                    } else if (sel) {
                      cellClass = "bg-orange-500";
                    } else if (availEmergency) {
                      cellClass = "bg-red-100 border-2 border-red-400 hover:bg-red-200 cursor-pointer";
                      cellContent = `${availEmergency.remaining_spots}`;
                    } else if (isNight) {
                      cellClass = "bg-slate-200";
                    }

                    return (
                      <div key={d.key} className="p-0.5 text-center" role="cell">
                        <button
                          type="button"
                          onClick={() => {
                            if (availEmergency) {
                              setClaimDialog(availEmergency);
                            } else if (canEdit) {
                              toggleHour(d.key, hour);
                            }
                          }}
                          disabled={!canEdit && !availEmergency}
                          className={`w-full h-7 rounded transition-all text-[10px] font-bold ${cellClass} ${
                            canEdit || availEmergency ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                          }`}
                          data-testid={`slot-${d.key}-${hour}`}
                          title={
                            availEmergency ? `${availEmergency.remaining_spots} locuri urgență - click pentru a lua`
                            : emergency ? "Slot de urgență luat"
                            : isNight ? "Tura de noapte - doar admin"
                            : admin ? "Adăugat de administrator"
                            : !windowOpen ? "Fereastra închisă"
                            : sel ? "Deselectează" : "Selectează"
                          }
                        >
                          {cellContent && <span className="text-red-700">{cellContent}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {windowOpen ? (
          <Button
            className="w-full mt-4 h-12 text-base font-bold"
            style={{ background: "hsl(24 95% 53%)" }}
            onClick={saveSchedule}
            disabled={saving}
            data-testid="save-schedule-btn"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Se salvează..." : "SALVEAZĂ PROGRAMUL"}
          </Button>
        ) : (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Info className="w-4 h-4" />
            Programul se modifică doar Duminică 22:00 - Luni 10:00
          </div>
        )}
      </CardContent>

      {/* Claim Emergency Slot Dialog */}
      <Dialog open={!!claimDialog} onOpenChange={(open) => !open && setClaimDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Flame className="w-5 h-5" />
              Slot de Urgență
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              <strong>{DAYS.find((d) => d.key === claimDialog?.day)?.label}</strong> intervalul <strong>{claimDialog?.hour ? formatInterval(claimDialog.hour) : ""}</strong>
            </p>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-3xl font-bold text-red-600">{claimDialog?.remaining_spots}</p>
              <p className="text-sm text-red-700">locuri rămase din {claimDialog?.total_spots}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vrei să iei acest slot de urgență? Vei fi adăugat la program pe această oră.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialog(null)}>Înapoi</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={claimEmergencySlot}
              disabled={claiming}
              data-testid="claim-emergency-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {claiming ? "Se procesează..." : "Ia Slotul"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rankDialogOpen} onOpenChange={setRankDialogOpen}>
        <DialogContent className="max-w-md" data-testid="driver-rank-dialog">
          <DialogHeader>
            <DialogTitle>Scor și rank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Rank curent</p>
                <p className="text-2xl font-bold">{scheduleWindowInfo?.tier || "Start"}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Scor total</p>
                <p className="text-2xl font-bold">{scheduleWindowInfo?.score || 0}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {Object.entries(scheduleWindowInfo?.breakdown || {}).map(([key, value]) => {
                const labels = { deliveries: "Livrări", cancellations: "Anulări", punctuality: "Punctualitate", seniority: "Vechime" };
                return (
                  <div key={key} className="flex items-center justify-between rounded-md border p-2">
                    <span>{labels[key] || key}</span>
                    <strong>{value} pct</strong>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
              <p><strong>Ore selectate săptămâna asta:</strong> {totalHours}h</p>
              <p><strong>Livrări totale:</strong> {scheduleWindowInfo?.metrics?.total_deliveries || 0}</p>
              <p><strong>Punctualitate:</strong> {Math.round((scheduleWindowInfo?.metrics?.punctuality_rate || 0) * 100)}%</p>
              {scheduleWindowInfo?.next_tier ? (
                <p><strong>Următorul rank:</strong> încă {scheduleWindowInfo.points_to_next_tier} puncte până la {scheduleWindowInfo.next_tier.label}</p>
              ) : (
                <p><strong>Următorul rank:</strong> ești deja la nivelul maxim.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
