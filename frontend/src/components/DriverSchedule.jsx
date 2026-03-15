import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  CalendarCheck,
  Clock,
  Lock,
  ShieldCheck,
  Info,
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

// Driver: editable 10:00-22:00
const DRIVER_HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 10).padStart(2, "0")}:00`);
// Night hours: 22:00-02:00 (admin only, read-only for driver)
const NIGHT_HOURS = ["22:00", "23:00", "00:00", "01:00"];
// All visible hours for driver
const ALL_HOURS = [...DRIVER_HOURS, ...NIGHT_HOURS];

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
  const [windowOpen, setWindowOpen] = useState(true); // scheduling window

  const fetchSchedule = useCallback(async () => {
    if (!driverId) return;
    try {
      const [schedRes, windowRes] = await Promise.all([
        axios.get(`${API_URL}/api/schedules/driver/${driverId}?year=${weekStart.getFullYear()}`),
        axios.get(`${API_URL}/api/schedules/scheduling-window`),
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
      setWindowOpen(windowRes.data.is_open);
    } catch {
      setSlots({});
      setTotalHours(0);
    }
  }, [driverId, weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const isNightHour = (hour) => NIGHT_HOURS.includes(hour);
  const isAdminSlot = (dayKey, hour) => {
    return (slots[dayKey] || []).some((s) => s.start === hour && s.added_by === "admin");
  };

  const toggleHour = (dayKey, hour) => {
    // Can't toggle night hours or admin slots
    if (isNightHour(hour)) return;
    if (isAdminSlot(dayKey, hour)) return;
    if (!windowOpen) return;

    setSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      const exists = daySlots.find((s) => s.start === hour && s.added_by !== "admin");
      let newDaySlots;
      if (exists) {
        newDaySlots = daySlots.filter((s) => !(s.start === hour && s.added_by !== "admin"));
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

  const isSelected = (dayKey, hour) => {
    return (slots[dayKey] || []).some((s) => s.start === hour);
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
      const msg = err.response?.data?.detail || "Eroare la salvare program";
      toast.error(msg);
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
      const adminSlots = daySlots.filter((s) => s.added_by === "admin");
      const driverSlots = daySlots.filter((s) => s.added_by !== "admin");

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

  const driverHoursCount = Object.values(slots).reduce((sum, ds) =>
    sum + ds.filter((s) => s.added_by !== "admin").length, 0
  );
  const adminHoursCount = Object.values(slots).reduce((sum, ds) =>
    sum + ds.filter((s) => s.added_by === "admin").length, 0
  );

  return (
    <Card data-testid="driver-schedule-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-5 h-5" />
            Program Săptămânal
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm">{driverHoursCount}h ale tale</Badge>
            {adminHoursCount > 0 && (
              <Badge className="bg-blue-100 text-blue-700 text-sm">{adminHoursCount}h admin</Badge>
            )}
          </div>
        </div>

        {/* Scheduling window info */}
        <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs ${
          windowOpen ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          {windowOpen ? (
            <>
              <CalendarCheck className="w-4 h-4" />
              <span className="font-medium">Fereastra de program este DESCHISĂ. Poți modifica orele.</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span className="font-medium">Programul se poate modifica doar Duminică 22:00 - Luni 10:00</span>
            </>
          )}
        </div>

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
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span>Orele tale</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>Adăugat de admin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-300" />
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Noapte (doar admin)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-1 sticky left-0 bg-card z-10 w-20">
                  <Clock className="w-3 h-3 inline mr-1" />Ora
                </th>
                {DAYS.map((d) => (
                  <th key={d.key} className="p-1 text-center min-w-[44px]">
                    <button
                      className={`font-semibold ${windowOpen ? "hover:text-primary" : "cursor-default text-muted-foreground"}`}
                      onClick={() => windowOpen && selectFullDay(d.key)}
                      title={windowOpen ? "Click pt. selectare/deselectare zi (10-22)" : "Fereastra de editare este închisă"}
                    >
                      {d.label.substring(0, 3)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_HOURS.map((hour) => {
                const isNight = isNightHour(hour);
                return (
                  <tr key={hour} className={isNight ? "bg-slate-50" : ""}>
                    <td className={`p-1 font-mono sticky left-0 z-10 ${isNight ? "text-slate-400 bg-slate-50" : "text-muted-foreground bg-card"}`}>
                      {hour} {isNight && <Lock className="w-2.5 h-2.5 inline ml-0.5" />}
                    </td>
                    {DAYS.map((d) => {
                      const sel = isSelected(d.key, hour);
                      const admin = isAdminSlot(d.key, hour);
                      const canEdit = !isNight && !admin && windowOpen;

                      let cellClass = "bg-muted/30";
                      if (sel && admin) {
                        cellClass = "bg-blue-500";
                      } else if (sel) {
                        cellClass = "bg-orange-500";
                      } else if (isNight) {
                        cellClass = "bg-slate-200";
                      }

                      return (
                        <td key={d.key} className="p-0.5 text-center">
                          <button
                            onClick={() => canEdit && toggleHour(d.key, hour)}
                            disabled={!canEdit}
                            className={`w-full h-7 rounded transition-all ${cellClass} ${
                              canEdit
                                ? "hover:opacity-80 cursor-pointer"
                                : "cursor-not-allowed opacity-70"
                            }`}
                            data-testid={`slot-${d.key}-${hour}`}
                            title={
                              isNight ? "Tura de noapte - setat doar de admin"
                              : admin ? "Adăugat de administrator"
                              : !windowOpen ? "Fereastra de editare este închisă"
                              : sel ? "Click pentru a deselecta" : "Click pentru a selecta"
                            }
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
            Programul poate fi modificat doar Duminică 22:00 - Luni 10:00
          </div>
        )}
      </CardContent>
    </Card>
  );
};
