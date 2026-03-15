import { useState, useEffect, useCallback } from "react";
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
} from "../components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Clock,
  Truck,
  Save,
  Users,
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

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = (i + 8) % 24;
  return `${String(h).padStart(2, "0")}:00`;
});

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

export const AdminScheduleView = () => {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDriver, setEditDriver] = useState(null);
  const [editSlots, setEditSlots] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/schedules/admin/summary?week_start=${toISODate(weekStart)}`);
      setSummary(res.data);
    } catch {
      toast.error("Eroare la încărcarea programelor");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const shiftWeek = (dir) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

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
        newDaySlots = [...daySlots, { start: hour, end: `${String(endH).padStart(2, "0")}:00` }];
      }
      return { ...prev, [dayKey]: newDaySlots };
    });
  };

  const isSelected = (dayKey, hour) => (editSlots[dayKey] || []).some((s) => s.start === hour);

  const saveSchedule = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/schedules`, {
        driver_id: editDriver.driver_id,
        week_start: toISODate(weekStart),
        slots: editSlots,
      });
      toast.success(`Program salvat pentru ${editDriver.driver_name}`);
      setEditDriver(null);
      fetchSummary();
    } catch {
      toast.error("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const getDayHoursCount = (schedules, dayKey) => {
    const sched = schedules?.find((s) => s.week_start === toISODate(weekStart));
    return (sched?.slots?.[dayKey] || []).length;
  };

  // Coverage calculation
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

  return (
    <div className="space-y-6" data-testid="admin-schedule-view">
      {/* Week Selector */}
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

      {/* Driver Cards */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((driver) => {
            const sched = driver.schedules?.find((s) => s.week_start === toISODate(weekStart));
            const weekHours = sched?.total_hours || 0;
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

                  {/* Mini day schedule */}
                  <div className="flex gap-1">
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

                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Comenzi livrate: {driver.total_orders_delivered}</span>
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
            {HOURS.map((hour) => {
              const avg = getCoverageAtHour(hour);
              return (
                <div
                  key={hour}
                  className={`flex flex-col items-center p-1.5 rounded min-w-[48px] ${
                    avg === 0 ? "bg-red-100" : avg <= 1 ? "bg-yellow-100" : avg <= 2 ? "bg-blue-100" : "bg-green-100"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">{hour}</span>
                  <span className={`text-lg font-bold ${
                    avg === 0 ? "text-red-600" : avg <= 1 ? "text-yellow-600" : avg <= 2 ? "text-blue-600" : "text-green-600"
                  }`}>{avg}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDriver} onOpenChange={(open) => !open && setEditDriver(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5" />
              Program {editDriver?.driver_name} - {formatWeekRange(weekStart)}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-1 w-16">
                    <Clock className="w-3 h-3 inline mr-1" />Ora
                  </th>
                  {DAYS.map((d) => (
                    <th key={d.key} className="p-1 text-center min-w-[44px] font-semibold">{d.label.substring(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-1 font-mono text-muted-foreground">{hour}</td>
                    {DAYS.map((d) => {
                      const sel = isSelected(d.key, hour);
                      return (
                        <td key={d.key} className="p-0.5 text-center">
                          <button
                            onClick={() => toggleHour(d.key, hour)}
                            className={`w-full h-7 rounded transition-all ${
                              sel ? "bg-green-500 hover:bg-green-600" : "bg-muted/50 hover:bg-muted border border-transparent hover:border-green-300"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              Total: {Object.values(editSlots).reduce((s, ds) => s + ds.length, 0)}h
            </span>
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
