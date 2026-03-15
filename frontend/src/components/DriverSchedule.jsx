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

export const DriverSchedule = ({ driverId }) => {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [slots, setSlots] = useState({});
  const [saving, setSaving] = useState(false);
  const [totalHours, setTotalHours] = useState(0);

  const fetchSchedule = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await axios.get(`${API_URL}/api/schedules/driver/${driverId}?year=${weekStart.getFullYear()}`);
      const wsKey = toISODate(weekStart);
      const found = res.data.find((s) => s.week_start === wsKey);
      if (found) {
        setSlots(found.slots || {});
        setTotalHours(found.total_hours || 0);
      } else {
        setSlots({});
        setTotalHours(0);
      }
    } catch {
      // No schedule found
      setSlots({});
      setTotalHours(0);
    }
  }, [driverId, weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const toggleHour = (dayKey, hour) => {
    setSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      const exists = daySlots.find((s) => s.start === hour);
      let newDaySlots;
      if (exists) {
        newDaySlots = daySlots.filter((s) => s.start !== hour);
      } else {
        const endH = (parseInt(hour) + 1) % 24;
        newDaySlots = [...daySlots, { start: hour, end: `${String(endH).padStart(2, "0")}:00` }];
      }
      const newSlots = { ...prev, [dayKey]: newDaySlots };
      // Recalc total
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
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/schedules`, {
        driver_id: driverId,
        week_start: toISODate(weekStart),
        slots,
      });
      toast.success("Program salvat cu succes!");
      fetchSchedule();
    } catch (err) {
      toast.error("Eroare la salvare program");
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
    setSlots((prev) => {
      const daySlots = prev[dayKey] || [];
      let newSlots;
      if (daySlots.length === HOURS.length) {
        newSlots = { ...prev, [dayKey]: [] };
      } else {
        newSlots = {
          ...prev,
          [dayKey]: HOURS.map((h) => {
            const endH = (parseInt(h) + 1) % 24;
            return { start: h, end: `${String(endH).padStart(2, "0")}:00` };
          }),
        };
      }
      let total = 0;
      Object.values(newSlots).forEach((ds) => { total += ds.length; });
      setTotalHours(total);
      return newSlots;
    });
  };

  return (
    <Card data-testid="driver-schedule-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-5 h-5" />
            Program Săptămânal
          </CardTitle>
          <Badge variant="outline" className="text-sm">{totalHours}h total</Badge>
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
                      className="hover:text-primary font-semibold"
                      onClick={() => selectFullDay(d.key)}
                      title="Click pt. selectare/deselectare zi"
                    >
                      {d.label.substring(0, 3)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="p-1 font-mono text-muted-foreground sticky left-0 bg-card z-10">
                    {hour}
                  </td>
                  {DAYS.map((d) => {
                    const sel = isSelected(d.key, hour);
                    return (
                      <td key={d.key} className="p-0.5 text-center">
                        <button
                          onClick={() => toggleHour(d.key, hour)}
                          className={`w-full h-7 rounded transition-all ${
                            sel
                              ? "bg-orange-500 hover:bg-orange-600"
                              : "bg-muted/50 hover:bg-muted border border-transparent hover:border-orange-300"
                          }`}
                          data-testid={`slot-${d.key}-${hour}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
      </CardContent>
    </Card>
  );
};
