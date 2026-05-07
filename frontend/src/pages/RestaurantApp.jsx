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
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  } catch {
    // Audio poate fi blocat de browser până la prima interacțiune.
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
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-100",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100",
  };
  return (
    <Card className={`premium-card ${tones[tone]}`} data-testid={testId}>
      <CardContent className="p-4 text-center">
        <p className="text-3xl font-black tracking-tight">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      </CardContent>
    </Card>
  );
};

const RestaurantApp = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingOrder, setPreparingOrder] = useState(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [confirmReadyOrder, setConfirmReadyOrder] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lateAlertedOrders, setLateAlertedOrders] = useState(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/restaurant/${user?.restaurant_id}`);
      setOrders(response.data);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [user?.restaurant_id, setIsLoading, setOrders]);

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [fetchOrders, user?.restaurant_id]);

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
      setTimeout(() => setNewOrderFlash(false), 4000);
      
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
      } catch (e) {
        // audio not supported in all browsers
      }
    }
  }, [orders, seenOrderIds]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
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

  const setPreparationTime = async (orderId, minutes) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/preparing`, {
        preparation_time: minutes
      });
      toast.success(`Timp pregătire setat: ${minutes} minute`);
      setPreparingOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error("Eroare la setare timp");
    }
  };

  const markAsReady = async (orderId) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/ready`);
      toast.success("Comanda este GATA pentru ridicare!");
      setConfirmReadyOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error("Eroare la marcare gata");
    }
  };

  const handleCancelOrder = async () => {
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
      toast.error("Eroare la anulare");
    }
  };

  const activeOrders = orders.filter(o => !['DELIVERED', 'PICKED_UP', 'CANCELLED'].includes(o.status));
  const completedToday = orders.filter(o => o.status === 'DELIVERED').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" data-testid="restaurant-app">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur-xl dark:bg-slate-950/85">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-700 shadow-sm">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                {user?.restaurant_name || 'RESTAURANT'}
              </h1>
              <p className="text-xs text-muted-foreground">Panou Comenzi</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="border-border/80 bg-card/85 backdrop-blur"
              title={isDark ? "Schimbă la tema light" : "Schimbă la tema dark"}
              data-testid="restaurant-theme-toggle"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchOrders} data-testid="refresh-button">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-button">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* New Order Flash Banner */}
      {newOrderFlash && (
        <div 
          className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm dark:border-amber-900 dark:bg-amber-950/25"
          style={{ 
            color: 'hsl(24 90% 28%)'
          }}
          data-testid="new-order-flash"
        >
          <p className="text-lg font-bold tracking-wide">COMANDĂ NOUĂ PRIMITĂ!</p>
          <p className="text-sm opacity-80 mt-1">Verifică lista de comenzi</p>
        </div>
      )}

      {/* Stats */}
      <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-sm" data-testid="restaurant-kitchen-hero">
        <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Badge className="mb-2 border-white/20 bg-white/10 text-white hover:bg-white/10">Kitchen Queue</Badge>
            <h2 className="text-2xl font-black tracking-tight">Comenzi pregătite rapid, fără haos în bucătărie.</h2>
            <p className="mt-1 text-sm text-slate-300">Timerul live măsoară pregătirea reală și întârzierea pentru analytics.</p>
          </div>
          <div className="font-mono text-sm text-slate-300">{new Date(now).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </section>

      <div className="p-4 grid grid-cols-3 gap-3">
        <RestaurantStatTile label="Noi" value={orders.filter(o => o.status === 'NEW').length} tone="amber" testId="restaurant-stat-new" />
        <RestaurantStatTile label="În pregătire" value={orders.filter(o => o.status === 'PREPARING').length} tone="indigo" testId="restaurant-stat-preparing" />
        <RestaurantStatTile label="Livrate" value={completedToday} tone="emerald" testId="restaurant-stat-delivered" />
      </div>

      {/* Orders List */}
      <main className="p-4 space-y-4">
        {activeOrders.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Nicio comandă activă</h2>
            <p className="text-muted-foreground">Vei primi notificare când apare o comandă nouă</p>
          </div>
        ) : (
          activeOrders.map((order) => (
            <Card 
              key={order.id} 
              className={`premium-card overflow-hidden ${order.status === 'NEW' ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10' : 'control-surface'}`}
              data-testid={`order-card-${order.id}`}
            >
              <CardHeader className="border-b bg-white/60 pb-3 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-tight">{order.order_number}</span>
                    <Badge className={`${getStatusConfig(order.status).bgColor} ${getStatusConfig(order.status).textColor} border-0`}>
                      {getStatusConfig(order.status).label}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Items */}
                <div className="rounded-lg border bg-slate-50/80 p-3 dark:bg-slate-900/60">
                  {order.items?.map((item) => (
                    <div key={`${order.id}-${item.name}-${item.price}-${item.quantity}`} className="flex justify-between text-sm">
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                      <span className="text-muted-foreground">{item.price * item.quantity} RON</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold text-lg">
                    <span>TOTAL</span>
                    <span>{order.total_amount} RON</span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{order.customer_address}</span>
                  </div>
                  {order.notes && (
                    <div className="text-orange-600 font-medium dark:text-orange-200">📝 {order.notes}</div>
                  )}
                </div>

                {/* Driver Info */}
                {order.driver_name && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg dark:bg-blue-950/30">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-100">Livrator: {order.driver_name}</span>
                  </div>
                )}

                {/* Actions */}
                {order.status === 'NEW' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Timp pregătire:</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setPreparationTime(order.id, 5)}
                        className="h-12"
                        data-testid={`prep-5-${order.id}`}
                      >
                        5 min
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setPreparationTime(order.id, 10)}
                        className="h-12"
                        data-testid={`prep-10-${order.id}`}
                      >
                        10 min
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreparationTime(order.id, 15)}
                        className="h-12"
                        data-testid={`prep-15-${order.id}`}
                      >
                        15 min
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreparationTime(order.id, 20)}
                        className="h-12"
                        data-testid={`prep-20-${order.id}`}
                      >
                        20 min
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreparationTime(order.id, 25)}
                        className="h-12"
                        data-testid={`prep-25-${order.id}`}
                      >
                        25 min
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreparationTime(order.id, 30)}
                        className="h-12"
                        data-testid={`prep-30-${order.id}`}
                      >
                        30 min
                      </Button>
                    </div>
                  </div>
                )}

                {order.status === 'PREPARING' && (
                  <div className="space-y-2">
                    {(() => {
                      const timer = getPreparationTimer(order, now);
                      return (
                        <div
                          className={`tracing-timer ${timer?.isLate ? "timer-late" : ""} rounded-xl border p-4 ${timer?.isLate ? "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30" : "border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30"}`}
                          data-testid={`preparation-timer-${order.id}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Clock className={`w-5 h-5 ${timer?.isLate ? "text-rose-600" : "text-indigo-600"}`} />
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Timer preparare</p>
                                <p className="text-sm font-medium">Estimare: {order.preparation_time || "-"} min</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-mono text-5xl font-black tracking-tight ${timer?.isLate ? "text-rose-700 dark:text-rose-100" : "text-indigo-700 dark:text-indigo-100"}`} data-testid={`restaurant-timer-display-${order.id}`}>
                                {timer?.label || "--:--"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {timer?.isLate ? "întârziere" : "rămas"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <Button 
                      className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setConfirmReadyOrder(order)}
                      data-testid={`ready-${order.id}`}
                    >
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      COMANDA GATA
                    </Button>
                  </div>
                )}

                {order.status === 'READY' && (
                  <div className="p-3 bg-emerald-100 rounded-lg text-center dark:bg-emerald-950/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                    <p className="font-bold text-emerald-700 dark:text-emerald-100">GATA PENTRU RIDICARE</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-200">Așteptăm livratorul</p>
                  </div>
                )}

                {['ASSIGNED', 'ACCEPTED'].includes(order.status) && (
                  <div className="p-3 bg-blue-100 rounded-lg text-center dark:bg-blue-950/30">
                    <Truck className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                    <p className="font-bold text-blue-700 dark:text-blue-100">LIVRATORUL VINE</p>
                    <p className="text-sm text-blue-600 dark:text-blue-200">{order.driver_name} preia comanda</p>
                  </div>
                )}

                {/* Cancel Button - available for NEW, PREPARING, READY */}
                {['NEW', 'PREPARING', 'READY'].includes(order.status) && (
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => { setCancelOrder(order); setCancelReason(""); }}
                    data-testid={`cancel-${order.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Anulează Comanda
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
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
