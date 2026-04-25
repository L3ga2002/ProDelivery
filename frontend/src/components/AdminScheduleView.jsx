import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
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
  CalendarCheck,
  Clock,
  Truck,
  Save,
  Users,
  MapPin,
  Moon,
  AlertTriangle,
  Flame,
  Plus,
  Minus,
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

// Admin editable: all hours 10:00-02:00 (16 intervals)
const ALL_HOURS = [
  ...Array.from({ length: 14 }, (_, i) => `${String(i + 10).padStart(2, "0")}:00`),
  "00:00", "01:00",
];
const NIGHT_HOURS = ["22:00", "23:00", "00:00", "01:00"];
// Emergency slots: ONLY 10:00-22:00
const EMERGENCY_HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 10).padStart(2, "0")}:00`);

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

const ZONE_COLORS = {
  "Zona 1": "bg-blue-100 text-blue-700",
  "Zona 2": "bg-green-100 text-green-700",
  "Zona 3": "bg-purple-100 text-purple-700",
  "Zona 4": "bg-orange-100 text-orange-700",
  "Neatribuită": "bg-gray-100 text-gray-600",
};

export const AdminScheduleView = () => {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDriver, setEditDriver] = useState(null);
  const [editSlots, setEditSlots] = useState({});
  const [saving, setSaving] = useState(false);
  // Emergency slots
  const [emergencySlots, setEmergencySlots] = useState([]);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyDialog, setEmergencyDialog] = useState(null); // {day, hour}
  const [emergencySpots, setEmergencySpots] = useState(1);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, emergencyRes] = await Promise.all([
        axios.get(`${API_URL}/api/schedules/admin/summary?week_start=${toISODate(weekStart)}`),
        axios.get(`${API_URL}/api/schedules/emergency?week_start=${toISODate(weekStart)}`),
      ]);
      setSummary(summaryRes.data);
      setEmergencySlots(emergencyRes.data);
    } catch {
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const shiftWeek = (dir) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  // Driver schedule edit
  const openEdit = (driver) => {
    const sched = driver.schedules?.find((s) => s.week_start === toISODate(weekStart));
    setEditSlots(sched?.slots || {});
    setEditDriver(driver);
  };

  const toggleHour = (dayKey, hour) => {
    setEditSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      const exists = daySlots.find((s) => s.start === hour);
      let newDaySlots;
      if (exists) {
        newDaySlots = daySlots.filter((s) => s.start !== hour);
      } else {
        const endH = (parseInt(hour) + 1) % 24;
        newDaySlots = [...daySlots, { start: hour, end: `${String(endH).padStart(2, "0")}:00`, added_by: "admin" }];
      }
      return { ...prev, [dayKey]: newDaySlots };
    });
  };

  const isSelected = (dayKey, hour) => (editSlots[dayKey] || []).some((s) => s.start === hour);
  const isAdminSlot = (dayKey, hour) => (editSlots[dayKey] || []).some((s) => s.start === hour && s.added_by === "admin");
  const isDriverSlot = (dayKey, hour) => (editSlots[dayKey] || []).some((s) => s.start === hour && s.added_by !== "admin");

  const saveSchedule = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/schedules`, {
        driver_id: editDriver.driver_id,
        week_start: toISODate(weekStart),
        slots: editSlots,
        source: "admin",
      });
      toast.success(`Program salvat pentru ${editDriver.driver_name}`);
      setEditDriver(null);
      fetchData();
    } catch {
      toast.error("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  // Emergency slot functions
  const getEmergencySlot = (day, hour) => {
    return emergencySlots.find((s) => s.day === day && s.hour === hour);
  };

  const handleEmergencyCellClick = (day, hour) => {
    const existing = getEmergencySlot(day, hour);
    setEmergencySpots(existing?.total_spots || 1);
    setEmergencyDialog({ day, hour, existing });
  };

  const saveEmergencySlot = async () => {
    try {
      await axios.post(`${API_URL}/api/schedules/emergency`, {
        week_start: toISODate(weekStart),
        day: emergencyDialog.day,
        hour: emergencyDialog.hour,
        total_spots: emergencySpots,
      });
      toast.success(`Slot urgență setat: ${emergencySpots} locuri`);
      setEmergencyDialog(null);
      fetchData();
    } catch {
      toast.error("Eroare la creare slot urgență");
    }
  };

  const deleteEmergencySlot = async (slotId) => {
    try {
      await axios.delete(`${API_URL}/api/schedules/emergency/${slotId}`);
      toast.success("Slot urgență șters");
      setEmergencyDialog(null);
      fetchData();
    } catch {
      toast.error("Eroare la ștergere");
    }
  };

  const autoGenerateEmergencySlots = async () => {
    setAutoGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/schedules/emergency/auto-generate`, null, {
        params: { week_start: toISODate(weekStart) },
      });
      toast.success(response.data.message);
      fetchData();
    } catch {
      toast.error("Eroare la generarea automată a sloturilor");
    } finally {
      setAutoGenerating(false);
    }
  };

  const getDayHoursCount = (schedules, dayKey) => {
    const sched = schedules?.find((s) => s.week_start === toISODate(weekStart));
    return (sched?.slots?.[dayKey] || []).length;
  };

  const getCoverageAtHour = (hour) => {
    let count = 0;
    summary.forEach((driver) => {
      const sched = driver.schedules?.find((s) => s.week_start === toISODate(weekStart));
      if (!sched) return;
      DAYS.forEach((d) => {
        if ((sched.slots?.[d.key] || []).some((s) => s.start === hour)) count++;
      });
    });
    return Math.round(count / 7);
  };

  const editTotalHours = Object.values(editSlots).reduce((s, ds) => s + ds.length, 0);
  const editDriverHours = Object.values(editSlots).reduce((s, ds) => s + ds.filter((sl) => sl.added_by !== "admin").length, 0);
  const editAdminHours = editTotalHours - editDriverHours;

  return (
    <div className="space-y-6" data-testid="admin-schedule-view">
      {/* Week Selector + Emergency Toggle */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} data-testid="admin-prev-week">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="font-bold text-lg" data-testid="admin-week-range">
          {formatWeekRange(weekStart)}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} data-testid="admin-next-week">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Emergency Mode Toggle */}
      <div className="grid md:grid-cols-2 gap-3">
        <Button
          variant={emergencyMode ? "default" : "outline"}
          className={emergencyMode
            ? "w-full bg-red-600 hover:bg-red-700 text-white"
            : "w-full border-red-300 text-red-600 hover:bg-red-50"
          }
          onClick={() => setEmergencyMode(!emergencyMode)}
          data-testid="emergency-mode-toggle"
        >
          <Flame className="w-5 h-5 mr-2" />
          {emergencyMode ? "MOD URGENȚĂ ACTIV - Click pe oră pentru a seta locuri" : "Setează Sloturi de Urgență"}
        </Button>
        <Button
          variant="outline"
          className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={autoGenerateEmergencySlots}
          disabled={autoGenerating}
          data-testid="auto-generate-emergency-btn"
        >
          <AlertTriangle className="w-5 h-5 mr-2" />
          {autoGenerating ? "Generez automat..." : "Generează Automat Sloturi"}
        </Button>
      </div>

      {/* Emergency Slots Grid (when mode is active) */}
      {emergencyMode && (
        <Card className="border-red-300 border-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Sloturi de Urgență - Click pe o celulă pentru a seta locuri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-1 w-16"><Clock className="w-3 h-3 inline mr-1" />Ora</th>
                    {DAYS.map((d) => (
                      <th key={d.key} className="p-1 text-center min-w-[52px] font-semibold">{d.label.substring(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EMERGENCY_HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="p-1 font-mono text-muted-foreground">{formatInterval(hour)}</td>
                      {DAYS.map((d) => {
                        const eSlot = getEmergencySlot(d.key, hour);
                        return (
                          <td key={d.key} className="p-0.5 text-center">
                            <button
                              onClick={() => handleEmergencyCellClick(d.key, hour)}
                              className={`w-full h-8 rounded transition-all text-xs font-bold ${
                                eSlot
                                  ? eSlot.remaining_spots > 0
                                    ? "bg-red-500 text-white hover:bg-red-600"
                                    : "bg-red-200 text-red-800 hover:bg-red-300"
                                  : "bg-muted/30 hover:bg-red-100 border border-transparent hover:border-red-300"
                              }`}
                              data-testid={`emergency-${d.key}-${hour}`}
                            >
                              {eSlot ? `${eSlot.remaining_spots}/${eSlot.total_spots}` : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emergency slots summary (always visible if there are any) */}
      {emergencySlots.length > 0 && !emergencyMode && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-red-500" />
              <span className="font-bold text-sm">Sloturi Urgență Active</span>
              <Badge className="bg-red-100 text-red-700">{emergencySlots.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {emergencySlots.map((s) => {
                const dayLabel = DAYS.find((d) => d.key === s.day)?.label || s.day;
                return (
                  <Badge key={s.id} className={`text-xs ${s.remaining_spots > 0 ? "bg-red-500 text-white" : "bg-red-200 text-red-800"}`}>
                    {dayLabel} {formatInterval(s.hour)}: {s.remaining_spots}/{s.total_spots}
                    {s.created_by === "system" && " · AUTO"}
                    {s.claimed_names?.length > 0 && ` (${s.claimed_names.join(", ")})`}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver Cards */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((driver) => {
            const sched = driver.schedules?.find((s) => s.week_start === toISODate(weekStart));
            const weekHours = sched?.total_hours || 0;
            const zones = driver.orders_by_zone || {};
            return (
              <Card
                key={driver.driver_id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${weekHours > 0 ? "border-green-200" : "border-red-200"}`}
                onClick={() => openEdit(driver)}
                data-testid={`driver-schedule-card-${driver.driver_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${driver.is_active ? "bg-green-500" : "bg-gray-400"}`}>
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{driver.driver_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{driver.phone}</p>
                    </div>
                    <Badge className={weekHours > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {weekHours}h
                    </Badge>
                  </div>

                    <div className="flex items-center justify-between mb-2 text-xs">
                      <Badge variant="outline">{driver.ranking_priority || "Start"}</Badge>
                      <span className="text-muted-foreground">Scor {driver.ranking_score || 0}</span>
                    </div>

                  <div className="flex gap-1 mb-3">
                    {DAYS.map((d) => {
                      const h = getDayHoursCount(driver.schedules, d.key);
                      return (
                        <div key={d.key} className="flex-1 text-center">
                          <p className="text-[10px] text-muted-foreground">{d.label.substring(0, 2)}</p>
                          <div className={`text-xs font-bold rounded py-0.5 ${h > 0 ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {h}h
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 border-t pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total comenzi livrate:</span>
                      <span className="font-bold">{driver.total_orders_delivered}</span>
                    </div>
                    {Object.keys(zones).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(zones).map(([zone, count]) => (
                          <Badge
                            key={zone}
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${ZONE_COLORS[zone] || "bg-gray-100 text-gray-600"}`}
                          >
                            <MapPin className="w-2.5 h-2.5 mr-0.5" />{zone}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hourly Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5" />
            Acoperire Medie pe Ore
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {ALL_HOURS.map((hour) => {
              const avg = getCoverageAtHour(hour);
              const isNight = NIGHT_HOURS.includes(hour);
              const eCount = emergencySlots.filter((s) => s.hour === hour).reduce((sum, s) => sum + s.remaining_spots, 0);
              return (
                <div
                  key={hour}
                  className={`flex flex-col items-center p-1.5 rounded min-w-[48px] ${
                    avg === 0 ? "bg-red-100" : avg <= 1 ? "bg-yellow-100" : avg <= 2 ? "bg-blue-100" : "bg-green-100"
                  } ${isNight ? "ring-1 ring-indigo-300" : ""}`}
                >
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    {isNight && <Moon className="w-2.5 h-2.5" />}
                    {formatInterval(hour)}
                  </span>
                  <span className={`text-lg font-bold ${
                    avg === 0 ? "text-red-600" : avg <= 1 ? "text-yellow-600" : avg <= 2 ? "text-blue-600" : "text-green-600"
                  }`}>{avg}</span>
                  {eCount > 0 && (
                    <span className="text-[9px] text-red-600 font-bold">+{eCount}u</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">
              {summary.filter((d) => {
                const s = d.schedules?.find((sc) => sc.week_start === toISODate(weekStart));
                return s && s.total_hours > 0;
              }).length}
            </p>
            <p className="text-sm text-muted-foreground">Cu program</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">
              {summary.filter((d) => {
                const s = d.schedules?.find((sc) => sc.week_start === toISODate(weekStart));
                return !s || s.total_hours === 0;
              }).length}
            </p>
            <p className="text-sm text-muted-foreground">Fără program</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">
              {summary.reduce((sum, d) => {
                const s = d.schedules?.find((sc) => sc.week_start === toISODate(weekStart));
                return sum + (s?.total_hours || 0);
              }, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Total ore</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">
              {emergencySlots.reduce((s, e) => s + e.remaining_spots, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Urgență libere</p>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Slot Dialog */}
      <Dialog open={!!emergencyDialog} onOpenChange={(open) => !open && setEmergencyDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Flame className="w-5 h-5" />
              Slot Urgență - {DAYS.find((d) => d.key === emergencyDialog?.day)?.label} {emergencyDialog?.hour ? formatInterval(emergencyDialog.hour) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Setează câte locuri de urgență sunt disponibile pe această oră.
              Livatorii fără program vor fi notificați și pot lua locuri.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setEmergencySpots(Math.max(1, emergencySpots - 1))}
                data-testid="emergency-spots-minus"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold text-red-600 w-16 text-center" data-testid="emergency-spots-count">{emergencySpots}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setEmergencySpots(emergencySpots + 1)}
                data-testid="emergency-spots-plus"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              locuri pentru livratori
            </p>
            {emergencyDialog?.existing?.claimed_names?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-700 mb-1">Deja luate de:</p>
                {emergencyDialog.existing.claimed_names.map((name, i) => (
                  <Badge key={i} variant="outline" className="text-xs mr-1">{name}</Badge>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {emergencyDialog?.existing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteEmergencySlot(emergencyDialog.existing.id)}
                data-testid="delete-emergency-slot"
              >
                Șterge Slot
              </Button>
            )}
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={saveEmergencySlot}
              data-testid="save-emergency-slot"
            >
              <Flame className="w-4 h-4 mr-2" />
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Schedule Dialog */}
      <Dialog open={!!editDriver} onOpenChange={(open) => !open && setEditDriver(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5" />
              Program {editDriver?.driver_name} - {formatWeekRange(weekStart)}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span>Setat de livrator</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>Setat de admin</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>Urgență</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tura de noapte</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-1 w-16"><Clock className="w-3 h-3 inline mr-1" />Ora</th>
                  {DAYS.map((d) => (
                    <th key={d.key} className="p-1 text-center min-w-[44px] font-semibold">{d.label.substring(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_HOURS.map((hour) => {
                  const isNight = NIGHT_HOURS.includes(hour);
                  return (
                    <tr key={hour} className={isNight ? "bg-indigo-50/50" : ""}>
                      <td className={`p-1 font-mono ${isNight ? "text-indigo-500" : "text-muted-foreground"}`}>
                        {isNight && <Moon className="w-2.5 h-2.5 inline mr-0.5" />}
                        {formatInterval(hour)}
                      </td>
                      {DAYS.map((d) => {
                        const sel = isSelected(d.key, hour);
                        const byDriver = isDriverSlot(d.key, hour);
                        const isEmergency = (editSlots[d.key] || []).some((s) => s.start === hour && s.added_by === "emergency");

                        let cellClass = "bg-muted/50 hover:bg-muted border border-transparent hover:border-green-300";
                        if (isEmergency) {
                          cellClass = "bg-red-500 hover:bg-red-400 text-white";
                        } else if (sel && byDriver) {
                          cellClass = "bg-orange-500 hover:bg-orange-400";
                        } else if (sel) {
                          cellClass = "bg-green-500 hover:bg-green-400";
                        }

                        return (
                          <td key={d.key} className="p-0.5 text-center">
                            <button
                              onClick={() => toggleHour(d.key, hour)}
                              className={`w-full h-7 rounded transition-all ${cellClass}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>Total: <strong>{editTotalHours}h</strong></span>
              <span className="text-orange-600">Livrator: {editDriverHours}h</span>
              <span className="text-green-600">Admin: {editAdminHours}h</span>
            </div>
            <Button onClick={saveSchedule} disabled={saving} data-testid="admin-save-schedule-btn">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Se salvează..." : "Salvează"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
