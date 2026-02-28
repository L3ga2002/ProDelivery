import { useState, useEffect, useCallback } from "react";
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
  CalendarCheck,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

const getStatusConfig = (status) => {
  const config = {
    ASSIGNED: { label: "Alocată", color: "bg-blue-500", textColor: "text-blue-800", bgColor: "bg-blue-100" },
    ACCEPTED: { label: "Acceptată", color: "bg-purple-500", textColor: "text-purple-800", bgColor: "bg-purple-100" },
    PICKED_UP: { label: "Ridicată", color: "bg-orange-500", textColor: "text-orange-800", bgColor: "bg-orange-100" },
    DELIVERED: { label: "Livrată", color: "bg-green-500", textColor: "text-green-800", bgColor: "bg-green-100" },
  };
  return config[status] || { label: status, color: "bg-gray-500", textColor: "text-gray-800", bgColor: "bg-gray-100" };
};

const DriverApp = () => {
  const { user, logout } = useAuth();
  const [currentOrder, setCurrentOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  
  // Program ore de muncă (10:00 - 02:00)
  const workHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
  const [selectedHours, setSelectedHours] = useState([]);

  // Check if check-in time (23:00 - 00:00)
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      setShowCheckIn(hour >= 23 || hour === 0);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleHour = (hour) => {
    if (selectedHours.includes(hour)) {
      setSelectedHours(selectedHours.filter(h => h !== hour));
    } else {
      setSelectedHours([...selectedHours, hour]);
    }
  };

  const selectAllHours = () => {
    if (selectedHours.length === workHours.length) {
      setSelectedHours([]);
    } else {
      setSelectedHours([...workHours]);
    }
  };

  const doCheckIn = () => {
    if (selectedHours.length === 0) {
      toast.error('Selectează cel puțin o oră de lucru!');
      return;
    }
    setHasCheckedIn(true);
    toast.success(`Program confirmat: ${selectedHours.length} ore pentru mâine!`);
  };

  const formatHour = (h) => {
    const nextH = h === 23 ? 0 : h === 0 ? 1 : h === 1 ? 2 : h + 1;
    return `${h.toString().padStart(2, '0')}-${nextH.toString().padStart(2, '0')}`;
  };

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
      setCurrentOrder(activeOrder || null);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.driver_id]);

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
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                PRODELIVERY
              </h1>
              <p className="text-xs text-muted-foreground">{user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
        {!currentOrder ? (
          // No Order State
          <div className="h-full flex flex-col items-center justify-center text-center py-12" data-testid="no-order-state">
            {/* Check-in Card */}
            {(showCheckIn || true) && (  /* Always show for demo */
              <Card className={`w-full mb-6 ${hasCheckedIn ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'} border-2`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <CalendarCheck className={`w-8 h-8 ${hasCheckedIn ? 'text-green-600' : 'text-orange-600'}`} />
                    <div className="text-left">
                      <h3 className="font-bold">Program pentru Mâine</h3>
                      <p className="text-sm text-muted-foreground">Selectează orele în care vei lucra</p>
                    </div>
                  </div>
                  
                  {hasCheckedIn ? (
                    <div className="text-center p-3 bg-green-100 rounded-lg">
                      <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-1" />
                      <p className="font-bold text-green-700">PROGRAM CONFIRMAT!</p>
                      <p className="text-sm text-green-600">{selectedHours.length} ore selectate pentru mâine</p>
                      <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {selectedHours.sort((a,b) => {
                          const aVal = a < 10 ? a + 24 : a;
                          const bVal = b < 10 ? b + 24 : b;
                          return aVal - bVal;
                        }).map(h => (
                          <Badge key={h} className="bg-green-600">{formatHour(h)}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Select All Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllHours}
                        className="w-full"
                      >
                        {selectedHours.length === workHours.length ? 'Deselectează Tot' : 'Selectează Toate Orele'}
                      </Button>
                      
                      {/* Hours Grid */}
                      <div className="grid grid-cols-4 gap-2">
                        {workHours.map((hour) => (
                          <button
                            key={hour}
                            onClick={() => toggleHour(hour)}
                            className={`p-2 rounded-lg text-sm font-bold transition-all ${
                              selectedHours.includes(hour)
                                ? 'bg-orange-500 text-white shadow-md scale-105'
                                : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-orange-300'
                            }`}
                          >
                            {formatHour(hour)}
                          </button>
                        ))}
                      </div>
                      
                      {/* Selected Count */}
                      <p className="text-center text-sm text-muted-foreground">
                        {selectedHours.length > 0 
                          ? `${selectedHours.length} ore selectate`
                          : 'Nicio oră selectată'}
                      </p>
                      
                      {/* Confirm Button */}
                      <Button 
                        className="w-full h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600"
                        onClick={doCheckIn}
                        disabled={selectedHours.length === 0}
                        data-testid="checkin-button"
                      >
                        <CalendarCheck className="w-6 h-6 mr-2" />
                        CONFIRMĂ PROGRAMUL
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                    {currentOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
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
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-1">Observații:</p>
                    <p className="text-yellow-900">{currentOrder.notes}</p>
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
              onClick={() => updateStatus("PICKED_UP")}
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
              onClick={() => updateStatus("DELIVERED")}
              disabled={isUpdating}
              data-testid="deliver-button"
            >
              <CheckCircle2 className="w-6 h-6 mr-3" />
              {isUpdating ? "SE PROCESEAZĂ..." : "AM LIVRAT"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverApp;
