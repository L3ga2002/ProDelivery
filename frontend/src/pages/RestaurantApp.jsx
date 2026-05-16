import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  LogOut,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  RefreshCw,
  ChefHat,
  Bell,
  User,
  MapPin,
  XCircle,
  AlertTriangle,
  Flame,
  Utensils,
  Power,
  TimerReset,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ORDER_POLL_INTERVAL_MS = 5000;
const NEW_ORDER_FLASH_MS = 4000;
const TIMER_TICK_MS = 1000;
const PREPARATION_OPTIONS_MINUTES = [5, 10, 15, 20, 25, 30];

const formatSeconds = (totalSeconds) => {
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getPreparationTimer = (order, now) => {
  const dueAtRaw = order.preparation_due_at;
  if (!dueAtRaw) return null;
  const dueAt = new Date(dueAtRaw).getTime();
  if (Number.isNaN(dueAt)) return null;
  const remainingSeconds = Math.ceil((dueAt - now) / 1000);
  return {
    remainingSeconds,
    isLate: remainingSeconds <= 0,
    label: remainingSeconds > 0 ? formatSeconds(remainingSeconds) : `+${formatSeconds(remainingSeconds)}`,
  };
};

const playLatePreparationAlert = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const startedAt = audioContext.currentTime;
    [0, 0.45, 0.9, 1.35].forEach((offset) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 620;
      osc.type = "square";
      gain.gain.setValueAtTime(0.0001, startedAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.28, startedAt + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + offset + 0.36);
      osc.start(startedAt + offset);
      osc.stop(startedAt + offset + 0.38);
    });
    if (navigator.vibrate) navigator.vibrate([250, 80, 250, 80, 350]);
  } catch (error) {
    console.debug("Preparation alert audio unavailable", error);
  }
};

const getStatusConfig = (status) => {
  const config = {
    NEW: { label: "Nouă", color: "bg-amber-500", textColor: "text-amber-800 dark:text-amber-100", bgColor: "bg-amber-100 dark:bg-amber-950/40" },
    PREPARING: { label: "În Pregătire", color: "bg-indigo-500", textColor: "text-indigo-800 dark:text-indigo-100", bgColor: "bg-indigo-100 dark:bg-indigo-950/40" },
    READY: { label: "GATA", color: "bg-emerald-500", textColor: "text-emerald-800 dark:text-emerald-100", bgColor: "bg-emerald-100 dark:bg-emerald-950/40" },
    ASSIGNED: { label: "Alocată", color: "bg-blue-500", textColor: "text-blue-800 dark:text-blue-100", bgColor: "bg-blue-100 dark:bg-blue-950/40" },
    ACCEPTED: { label: "Acceptată", color: "bg-blue-500", textColor: "text-blue-800 dark:text-blue-100", bgColor: "bg-blue-100 dark:bg-blue-950/40" },
    PICKED_UP: { label: "Ridicată", color: "bg-orange-500", textColor: "text-orange-800 dark:text-orange-100", bgColor: "bg-orange-100 dark:bg-orange-950/40" },
    DELIVERED: { label: "Livrată", color: "bg-gray-500", textColor: "text-gray-800 dark:text-slate-100", bgColor: "bg-gray-100 dark:bg-slate-800" },
    CANCELLED: { label: "Anulată", color: "bg-red-500", textColor: "text-red-800 dark:text-red-100", bgColor: "bg-red-100 dark:bg-red-950/40" },
  };
  return config[status] || { label: status, color: "bg-gray-500", textColor: "text-gray-800 dark:text-slate-100", bgColor: "bg-gray-100 dark:bg-slate-800" };
};

const RestaurantStatTile = ({ label, value, tone, testId }) => {
  const tones = {
    amber: "border-orange-500/30 bg-orange-500/10 text-orange-100",
    indigo: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <Card className={`border ${tones[tone]} shadow-[0_18px_45px_-32px_rgba(0,0,0,0.9)]`} data-testid={testId}>
      <CardContent className="p-4 text-center">
        <p className="text-3xl font-black tracking-tight">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] opacity-70">{label}</p>
      </CardContent>
    </Card>
  );
};

const orderLaneMeta = {
  NEW: { title: "Nouă", className: "border-orange-500/40 bg-orange-500/10 text-orange-200", icon: Bell },
  PREPARING: { title: "În lucru", className: "border-blue-500/40 bg-blue-500/10 text-blue-200", icon: ChefHat },
  READY: { title: "Gata", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", icon: CheckCircle2 },
  ASSIGNED: { title: "Ridicare", className: "border-sky-500/40 bg-sky-500/10 text-sky-200", icon: Truck },
  ACCEPTED: { title: "Ridicare", className: "border-sky-500/40 bg-sky-500/10 text-sky-200", icon: Truck },
};

const RestaurantApp = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingOrder, setPreparingOrder] = useState(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [confirmReadyOrder, setConfirmReadyOrder] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lateAlertedOrders, setLateAlertedOrders] = useState(new Set());
  const [acceptingOrders, setAcceptingOrders] = useState(true);

  const fetchRestaurantStatus = useCallback(async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await axios.get(`${API_URL}/api/restaurants/${user.restaurant_id}`);
      setAcceptingOrders(response.data.accepting_orders !== false);
    } catch (error) {
      console.error("Failed to fetch restaurant status", error);
    }
  }, [user?.restaurant_id]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/restaurant/${user?.restaurant_id}`);
      setOrders(response.data);
    } catch (error) {
      console.error("Failed to fetch restaurant orders", error);
      toast.error("Nu am putut încărca comenzile restaurantului");
    } finally {
      setIsLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchOrders();
      fetchRestaurantStatus();
      const interval = setInterval(fetchOrders, ORDER_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [fetchOrders, fetchRestaurantStatus, user?.restaurant_id]);

  const toggleRestaurantStatus = async () => {
    if (!user?.restaurant_id) return;
    const next = !acceptingOrders;
    try {
      await axios.patch(`${API_URL}/api/restaurants/${user.restaurant_id}/status`, { accepting_orders: next });
      setAcceptingOrders(next);
      toast.success(next ? "Restaurant online pentru comenzi" : "Restaurant pus pe pauză");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Nu am putut schimba statusul restaurantului");
    }
  };

  // Play sound only once when NEW orders appear for the first time
  const [seenOrderIds, setSeenOrderIds] = useState(new Set());
  
  useEffect(() => {
    const newOrders = orders.filter(o => o.status === 'NEW');
    const unseenNewOrders = newOrders.filter(o => !seenOrderIds.has(o.id));
    
    if (unseenNewOrders.length > 0) {
      // Mark as seen
      setSeenOrderIds(prev => {
        const updated = new Set(prev);
        unseenNewOrders.forEach(o => updated.add(o.id));
        return updated;
      });
      
      // Flash banner
      setNewOrderFlash(true);
      setTimeout(() => setNewOrderFlash(false), NEW_ORDER_FLASH_MS);
      
      // Play notification sound — louder, triple beep
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, startTime, duration) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.value = 0.4;
          osc.start(audioContext.currentTime + startTime);
          osc.stop(audioContext.currentTime + startTime + duration);
        };
        playBeep(800, 0, 0.15);
        playBeep(1000, 0.2, 0.15);
        playBeep(1200, 0.4, 0.25);
        // Vibrate
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
      } catch (error) {
        console.debug("New order notification audio unavailable", error);
      }
    }
  }, [orders, seenOrderIds]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    orders
      .filter((order) => order.status === "PREPARING")
      .forEach((order) => {
        const timer = getPreparationTimer(order, now);
        if (timer?.isLate && !lateAlertedOrders.has(order.id)) {
          playLatePreparationAlert();
          setLateAlertedOrders((prev) => new Set(prev).add(order.id));
        }
      });
  }, [lateAlertedOrders, now, orders]);

  const setPreparationTime = useCallback(async (orderId, minutes) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/preparing`, {
        preparation_time: minutes
      });
      toast.success(`Timp pregătire setat: ${minutes} minute`);
      setPreparingOrder(null);
      fetchOrders();
    } catch (error) {
      console.error("Failed to set preparation time", error);
      toast.error("Eroare la setare timp");
    }
  }, [fetchOrders]);

  const markAsReady = useCallback(async (orderId) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/ready`);
      toast.success("Comanda este GATA pentru ridicare!");
      setConfirmReadyOrder(null);
      fetchOrders();
    } catch (error) {
      console.error("Failed to mark order ready", error);
      toast.error("Eroare la marcare gata");
    }
  }, [fetchOrders]);

  const handleCancelOrder = useCallback(async () => {
    if (!cancelReason.trim()) {
      toast.error("Motivul anulării este obligatoriu!");
      return;
    }
    try {
      await axios.put(`${API_URL}/api/orders/${cancelOrder.id}/status`, {
        status: "CANCELLED",
        cancellation_reason: cancelReason.trim()
      });
      toast.success("Comanda a fost anulată");
      setCancelOrder(null);
      setCancelReason("");
      fetchOrders();
    } catch (error) {
      console.error("Failed to cancel restaurant order", error);
      toast.error("Eroare la anulare");
    }
  }, [cancelOrder?.id, cancelReason, fetchOrders]);

  const activeOrders = orders.filter(o => !['DELIVERED', 'PICKED_UP', 'CANCELLED'].includes(o.status));
  const completedToday = orders.filter(o => o.status === 'DELIVERED').length;
  const newCount = orders.filter(o => o.status === 'NEW').length;
  const preparingCount = orders.filter(o => o.status === 'PREPARING').length;
  const readyCount = orders.filter(o => o.status === 'READY').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50" data-testid="restaurant-app">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500 text-zinc-950 shadow-[0_0_22px_rgba(249,115,22,0.25)]">
              <ChefHat className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Kitchen Queue</p>
              <h1 className="truncate text-lg font-black tracking-tight sm:text-xl" style={{ fontFamily: 'var(--font-heading)' }}>
                {user?.restaurant_name || 'Restaurant'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRestaurantStatus}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-black transition-colors ${acceptingOrders ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-500/15 text-red-300"}`}
              data-testid="restaurant-operational-toggle"
            >
              <Power className="h-4 w-4" />
              <span className="hidden sm:inline">{acceptingOrders ? "Acceptă comenzi" : "Pauză"}</span>
            </button>
            <Button variant="ghost" size="icon" onClick={fetchOrders} className="text-zinc-300 hover:bg-zinc-800 hover:text-white" data-testid="refresh-button">
              <RefreshCw className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="text-zinc-300 hover:bg-zinc-800 hover:text-white" data-testid="logout-button">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {newOrderFlash && (
        <div className="mx-auto mt-3 max-w-[1600px] px-4 lg:px-6">
          <div className="rounded-xl border border-orange-500/40 bg-orange-500/15 p-4 text-center text-orange-100 shadow-lg" data-testid="new-order-flash">
            <p className="text-lg font-black tracking-wide">COMANDĂ NOUĂ PRIMITĂ!</p>
            <p className="text-sm opacity-80">Alege timpul de preparare.</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 lg:px-6">
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_32%),linear-gradient(135deg,#18181b,#09090b)] shadow-2xl" data-testid="restaurant-kitchen-hero">
          <div className="grid gap-5 p-5 lg:grid-cols-[1.35fr_0.9fr] lg:p-7">
            <div>
              <Badge className="mb-3 border-orange-500/30 bg-orange-500/15 text-orange-300 hover:bg-orange-500/15">
                <Utensils className="mr-1 h-3.5 w-3.5" /> KDS live
              </Badge>
              <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Bucătărie organizată, timer mare, decizii rapide.</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">Comenzile sunt separate vizual pe status: nou, în lucru, gata și ridicare.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-zinc-400">Ora curentă</p><p className="font-mono text-2xl font-black text-white">{new Date(now).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-zinc-400">Active</p><p className="font-mono text-2xl font-black text-orange-300">{activeOrders.length}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-zinc-400">Gata</p><p className="font-mono text-2xl font-black text-emerald-300">{readyCount}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-zinc-400">Status</p><p className={`text-sm font-black ${acceptingOrders ? "text-emerald-300" : "text-red-300"}`}>{acceptingOrders ? "ONLINE" : "PAUZĂ"}</p></div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <RestaurantStatTile label="Noi" value={newCount} tone="amber" testId="restaurant-stat-new" />
          <RestaurantStatTile label="În lucru" value={preparingCount} tone="indigo" testId="restaurant-stat-preparing" />
          <RestaurantStatTile label="Livrate" value={completedToday} tone="emerald" testId="restaurant-stat-delivered" />
        </div>

        {activeOrders.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/70 py-16 text-center" data-testid="restaurant-empty-state">
            <Bell className="mx-auto mb-4 h-16 w-16 text-zinc-600" />
            <h2 className="text-2xl font-black">Nicio comandă activă</h2>
            <p className="mt-2 text-zinc-400">Vei primi alertă când apare o comandă nouă.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="restaurant-kds-grid">
            {activeOrders.map((order) => {
              const timer = getPreparationTimer(order, now);
              const lane = orderLaneMeta[order.status] || orderLaneMeta.NEW;
              const LaneIcon = lane.icon;
              return (
                <article key={order.id} className={`flex min-h-[420px] flex-col rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-colors hover:border-zinc-700 ${order.status === "NEW" ? "border-orange-500/50" : "border-zinc-800"}`} data-testid={`order-card-${order.id}`}>
                  <div className="mb-3 flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-black text-zinc-400">{order.order_number}</p>
                      <h3 className="mt-1 truncate text-xl font-black text-white">{order.customer_name}</h3>
                    </div>
                    <Badge className={`${lane.className} border`}><LaneIcon className="mr-1 h-3.5 w-3.5" />{lane.title}</Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500"><span>Produse</span><span>{order.items?.length || 0} poziții</span></div>
                      <div className="space-y-2">
                        {order.items?.map((item) => (
                          <div key={`${order.id}-${item.name}-${item.price}-${item.quantity}`} className="flex items-start justify-between gap-3 border-b border-zinc-800/70 pb-2 last:border-0 last:pb-0">
                            <span className="text-sm font-semibold text-zinc-100">{item.quantity}× {item.name}</span>
                            <span className="font-mono text-sm text-zinc-400">{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-lg font-black"><span>Total</span><span className="text-orange-300">{order.total_amount} RON</span></div>
                    </div>

                    <div className="space-y-2 text-sm text-zinc-400">
                      <p className="flex gap-2"><User className="mt-0.5 h-4 w-4 text-zinc-500" /><span className="min-w-0 truncate">{order.customer_name}</span></p>
                      <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><span className="line-clamp-2">{order.customer_address}</span></p>
                      {order.notes && <p className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-2 text-orange-200">📝 {order.notes}</p>}
                    </div>

                    {order.driver_name && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-sm font-semibold text-blue-200"><Truck className="h-4 w-4" /> Livrator: {order.driver_name}</div>}
                  </div>

                  <div className="mt-auto space-y-3 pt-4">
                    {order.status === 'NEW' && (
                      <div className="space-y-2" data-testid={`prep-options-${order.id}`}>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Setează timp</p>
                        <div className="grid grid-cols-3 gap-2">
                          {PREPARATION_OPTIONS_MINUTES.map((minutes) => (
                            <Button key={minutes} variant="outline" onClick={() => setPreparationTime(order.id, minutes)} className="h-11 border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-orange-500 hover:text-zinc-950" data-testid={`prep-${minutes}-${order.id}`}>{minutes}m</Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.status === 'PREPARING' && (
                      <div className={`rounded-xl border p-4 ${timer?.isLate ? "border-red-500/50 bg-red-500/10" : "border-orange-500/40 bg-orange-500/10"}`} data-testid={`preparation-timer-${order.id}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div><p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Timer</p><p className="text-sm text-zinc-400">Estimare {order.preparation_time || "-"} min</p></div>
                          <p className={`font-mono text-4xl font-black ${timer?.isLate ? "animate-pulse text-red-300" : "text-orange-300"}`} data-testid={`restaurant-timer-display-${order.id}`}>{timer?.label || "--:--"}</p>
                        </div>
                        <Button className="mt-3 h-13 w-full bg-emerald-500 font-black text-emerald-950 hover:bg-emerald-400" onClick={() => setConfirmReadyOrder(order)} data-testid={`ready-${order.id}`}><CheckCircle2 className="mr-2 h-5 w-5" /> COMANDA GATA</Button>
                      </div>
                    )}

                    {order.status === 'READY' && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-emerald-200"><CheckCircle2 className="mx-auto mb-1 h-8 w-8" /><p className="font-black">GATA PENTRU RIDICARE</p><p className="text-sm opacity-80">Așteptăm livratorul</p></div>}

                    {['ASSIGNED', 'ACCEPTED'].includes(order.status) && <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-center text-sky-200"><Truck className="mx-auto mb-1 h-8 w-8" /><p className="font-black">LIVRATORUL VINE</p><p className="text-sm opacity-80">{order.driver_name} preia comanda</p></div>}

                    {['NEW', 'PREPARING', 'READY'].includes(order.status) && <Button variant="outline" className="h-11 w-full border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20" onClick={() => { setCancelOrder(order); setCancelReason(""); }} data-testid={`cancel-${order.id}`}><XCircle className="mr-2 h-4 w-4" /> Anulează</Button>}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Confirm Ready Dialog */}
      <Dialog open={!!confirmReadyOrder} onOpenChange={(open) => !open && setConfirmReadyOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirmare - Comanda Gata
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-base">
              Confirmați că comanda <strong>{confirmReadyOrder?.order_number}</strong> este gata pentru ridicare?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              După confirmare, livratorul va fi notificat să ridice comanda.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReadyOrder(null)} data-testid="cancel-ready-confirm">
              Înapoi
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => markAsReady(confirmReadyOrder?.id)}
              data-testid="confirm-ready-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Da, Comanda e Gata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Anulare Comandă {cancelOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Motivul anulării este obligatoriu. Vă rugăm să specificați de ce anulați această comandă.
            </p>
            <Textarea
              placeholder="Scrieți motivul anulării..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[100px]"
              data-testid="cancel-reason-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)}>
              Înapoi
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={!cancelReason.trim()}
              data-testid="confirm-cancel-btn"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Confirmă Anularea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RestaurantApp;
