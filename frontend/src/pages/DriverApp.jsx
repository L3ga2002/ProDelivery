import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  LogOut,
  Package,
  MapPin,
  Phone,
  User,
  CreditCard,
  Banknote,
  Navigation,
  CheckCircle2,
  Truck,
  RefreshCw,
  FileText,
  Clock,
  Download,
  XCircle,
  AlertTriangle,
  Moon,
  Sun,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { DriverSchedule } from "../components/DriverSchedule";
import { useTheme } from "../context/ThemeContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

const getStatusConfig = (status) => {
  const config = {
    ASSIGNED: { label: "Alocată", color: "bg-blue-500", textColor: "text-blue-800 dark:text-blue-100", bgColor: "bg-blue-100 dark:bg-blue-950/40" },
    ACCEPTED: { label: "Acceptată", color: "bg-purple-500", textColor: "text-purple-800 dark:text-purple-100", bgColor: "bg-purple-100 dark:bg-purple-950/40" },
    PICKED_UP: { label: "Ridicată", color: "bg-orange-500", textColor: "text-orange-800 dark:text-orange-100", bgColor: "bg-orange-100 dark:bg-orange-950/40" },
    DELIVERED: { label: "Livrată", color: "bg-green-500", textColor: "text-green-800 dark:text-green-100", bgColor: "bg-green-100 dark:bg-green-950/40" },
  };
  return config[status] || { label: status, color: "bg-gray-500", textColor: "text-gray-800 dark:text-slate-100", bgColor: "bg-gray-100 dark:bg-slate-800" };
};

const DriverApp = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [currentOrder, setCurrentOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const lastOrderIdRef = useRef(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // {status, label}
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  
  // Check if PWA can be installed
  useEffect(() => {
    const checkInstall = () => {
      setCanInstall(!!deferredPrompt);
    };
    checkInstall();
    window.addEventListener('beforeinstallprompt', checkInstall);
    return () => window.removeEventListener('beforeinstallprompt', checkInstall);
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Aplicație instalată cu succes!');
      setCanInstall(false);
    }
    deferredPrompt = null;
  };

  const fetchOrder = useCallback(async () => {
    if (!user?.driver_id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/orders/driver/${user.driver_id}`);
      const orders = response.data;
      // Get the first non-delivered order
      const activeOrder = orders.find((o) => o.status !== "DELIVERED");
      
      // Play notification sound for new order
      if (activeOrder && activeOrder.id !== lastOrderIdRef.current) {
        const prevId = lastOrderIdRef.current;
        lastOrderIdRef.current = activeOrder.id;
        if (prevId !== null) {
          // Flash banner
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 5000);
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playBeep = (freq, startTime, duration) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = freq;
              osc.type = 'sine';
              gain.gain.value = 0.4;
              osc.start(ctx.currentTime + startTime);
              osc.stop(ctx.currentTime + startTime + duration);
            };
            playBeep(600, 0, 0.15);
            playBeep(800, 0.2, 0.15);
            playBeep(1000, 0.4, 0.25);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
          } catch (e) { /* audio not supported */ }
        }
      }
      
      setCurrentOrder(activeOrder || null);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [user?.driver_id, lastOrderIdRef, setCurrentOrder, setIsLoading, setNewOrderFlash]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchOrder]);

  const updateStatus = async (newStatus) => {
    if (!currentOrder) return;
    
    setIsUpdating(true);
    try {
      await axios.put(`${API_URL}/api/orders/${currentOrder.id}/status`, {
        status: newStatus,
      });
      
      const statusLabels = {
        ACCEPTED: "Comandă acceptată!",
        PICKED_UP: "Comandă ridicată!",
        DELIVERED: "Livrare finalizată!",
      };
      
      toast.success(statusLabels[newStatus] || "Status actualizat!");
      setConfirmAction(null);
      
      if (newStatus === "DELIVERED") {
        setCurrentOrder(null);
      } else {
        fetchOrder();
      }
    } catch (error) {
      toast.error("Eroare la actualizare status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("Motivul anulării este obligatoriu!");
      return;
    }
    try {
      await axios.put(`${API_URL}/api/orders/${currentOrder.id}/status`, {
        status: "CANCELLED",
        cancellation_reason: cancelReason.trim()
      });
      toast.success("Comanda a fost anulată");
      setCancelDialog(false);
      setCancelReason("");
      setCurrentOrder(null);
      fetchOrder();
    } catch (error) {
      toast.error("Eroare la anulare");
    }
  };

  const openNavigation = (address) => {
    const encodedAddress = encodeURIComponent(address);
    // Try Google Maps first, fallback to generic maps
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const callCustomer = (phone) => {
    window.open(`tel:${phone}`, "_self");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" data-testid="driver-app">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(215 75% 22%)' }}>
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                PRODELIVERY <span style={{ color: 'hsl(24 95% 53%)', fontSize: '0.75em' }}>BACAU</span>
              </h1>
              <p className="text-xs text-muted-foreground">{user?.name}</p>
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
              data-testid="driver-theme-toggle"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {canInstall && (
              <Button variant="outline" size="icon" onClick={installPWA} data-testid="install-pwa-button" title="Instalează aplicația">
                <Download className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={fetchOrder} data-testid="refresh-button">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-button">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {/* New Order Flash Banner */}
        {newOrderFlash && (
          <div 
            className="mb-4 p-4 rounded-xl text-center animate-pulse shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, hsl(215 75% 22%), hsl(215 75% 35%))',
              color: 'white'
            }}
            data-testid="driver-new-order-flash"
          >
            <p className="text-lg font-bold tracking-wide">COMANDĂ NOUĂ PRIMITĂ!</p>
            <p className="text-sm opacity-90 mt-1">Verifică detaliile comenzii</p>
          </div>
        )}
        {!currentOrder ? (
          // No Order State
          <div className="h-full flex flex-col items-center justify-center text-center py-12" data-testid="no-order-state">
            {/* Schedule Card */}
            {user?.driver_id && (
              <div className="w-full mb-6">
                <DriverSchedule driverId={user.driver_id} />
              </div>
            )}
            
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              NICIO COMANDĂ
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xs">
              Așteptăm să ți se aloce o nouă comandă. Vei primi notificare instant.
            </p>
            <Button variant="outline" onClick={fetchOrder} data-testid="check-orders-button">
              <RefreshCw className="w-4 h-4 mr-2" />
              Verifică Comenzi
            </Button>
          </div>
        ) : (
          // Active Order
          <div className="space-y-4" data-testid="active-order">
            {/* Order Header */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getStatusConfig(currentOrder.status).color}`}>
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-mono text-sm text-muted-foreground">{currentOrder.order_number}</p>
                      <CardTitle className="text-xl">{currentOrder.restaurant_name}</CardTitle>
                    </div>
                  </div>
                  <Badge className={`${getStatusConfig(currentOrder.status).bgColor} ${getStatusConfig(currentOrder.status).textColor} border-0 text-sm px-3 py-1`}>
                    {getStatusConfig(currentOrder.status).label}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Customer Info */}
            <Card data-testid="customer-info-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Detalii Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nume</p>
                    <p className="font-semibold text-lg">{currentOrder.customer_name}</p>
                  </div>
                </div>

                {/* Phone with Call Button */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <p className="font-mono font-semibold text-lg">{currentOrder.customer_phone}</p>
                  </div>
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 h-14 px-6"
                    onClick={() => callCustomer(currentOrder.customer_phone)}
                    data-testid="call-customer-button"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    SUNĂ
                  </Button>
                </div>

                {/* Address with Navigate Button */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0 mt-1">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Adresă Livrare</p>
                    <p className="font-semibold">{currentOrder.customer_address}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => openNavigation(currentOrder.customer_address)}
                  data-testid="navigate-button"
                >
                  <Navigation className="w-5 h-5 mr-2" />
                  Deschide Navigația
                </Button>
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card data-testid="order-details-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Detalii Comandă
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                {currentOrder.items && currentOrder.items.length > 0 && (
                  <div className="space-y-2">
                    {currentOrder.items.map((item) => (
                      <div key={`${currentOrder.id}-${item.name}-${item.price}-${item.quantity}`} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-mono">{item.price * item.quantity} RON</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total & Payment */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {currentOrder.payment_type === "CASH" ? (
                      <Banknote className="w-6 h-6 text-green-600" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">De încasat</p>
                      <p className="text-2xl font-bold">{currentOrder.total_amount} RON</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-base px-4 py-2">
                    {currentOrder.payment_type === "CASH" ? "NUMERAR" : "CARD"}
                  </Badge>
                </div>

                {/* Notes */}
                {currentOrder.notes && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/30 dark:border-yellow-900">
                    <p className="text-sm font-medium text-yellow-800 mb-1 dark:text-yellow-100">Observații:</p>
                    <p className="text-yellow-900 dark:text-yellow-50">{currentOrder.notes}</p>
                  </div>
                )}

                {/* Created Time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Comandă primită la: {new Date(currentOrder.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Action Buttons - Fixed at Bottom */}
      {currentOrder && (
        <div className="sticky bottom-0 p-4 bg-card border-t space-y-3" data-testid="action-buttons">
          {currentOrder.status === "ASSIGNED" && (
            <Button
              className="driver-btn bg-purple-600 hover:bg-purple-700"
              onClick={() => updateStatus("ACCEPTED")}
              disabled={isUpdating}
              data-testid="accept-button"
            >
              <CheckCircle2 className="w-6 h-6 mr-3" />
              {isUpdating ? "SE PROCESEAZĂ..." : "ACCEPT COMANDA"}
            </Button>
          )}

          {currentOrder.status === "ACCEPTED" && (
            <Button
              className="driver-btn bg-orange-500 hover:bg-orange-600"
              onClick={() => setConfirmAction({ status: "PICKED_UP", label: "Confirmați că ați ridicat comanda de la restaurant?" })}
              disabled={isUpdating}
              data-testid="pickup-button"
            >
              <Package className="w-6 h-6 mr-3" />
              {isUpdating ? "SE PROCESEAZĂ..." : "AM RIDICAT COMANDA"}
            </Button>
          )}

          {currentOrder.status === "PICKED_UP" && (
            <Button
              className="driver-btn bg-green-600 hover:bg-green-700"
              onClick={() => setConfirmAction({ status: "DELIVERED", label: "Confirmați că ați livrat comanda clientului?" })}
              disabled={isUpdating}
              data-testid="deliver-button"
            >
              <CheckCircle2 className="w-6 h-6 mr-3" />
              {isUpdating ? "SE PROCESEAZĂ..." : "AM LIVRAT"}
            </Button>
          )}

          {/* Cancel Button */}
          {["ASSIGNED", "ACCEPTED"].includes(currentOrder.status) && (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 h-12"
              onClick={() => { setCancelDialog(true); setCancelReason(""); }}
              data-testid="cancel-order-button"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Anulează Comanda
            </Button>
          )}
        </div>
      )}

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirmare Acțiune
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-base">{confirmAction?.label}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Comanda: <strong>{currentOrder?.order_number}</strong> - {currentOrder?.restaurant_name}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} data-testid="cancel-confirm-action">
              Înapoi
            </Button>
            <Button
              onClick={() => updateStatus(confirmAction?.status)}
              disabled={isUpdating}
              data-testid="confirm-action-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isUpdating ? "Se procesează..." : "Da, Confirmă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Anulare Comandă
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Motivul anulării este obligatoriu.
            </p>
            <Textarea
              placeholder="Scrieți motivul anulării..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[100px]"
              data-testid="driver-cancel-reason-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>
              Înapoi
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={!cancelReason.trim()}
              data-testid="driver-confirm-cancel-btn"
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

export default DriverApp;
