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
  Clock,
  CheckCircle2,
  Truck,
  RefreshCw,
  ChefHat,
  Bell,
  User,
  MapPin,
  Phone,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getStatusConfig = (status) => {
  const config = {
    NEW: { label: "Nouă", color: "bg-yellow-500", textColor: "text-yellow-800", bgColor: "bg-yellow-100" },
    PREPARING: { label: "În Pregătire", color: "bg-blue-500", textColor: "text-blue-800", bgColor: "bg-blue-100" },
    READY: { label: "GATA", color: "bg-green-500", textColor: "text-green-800", bgColor: "bg-green-100" },
    ASSIGNED: { label: "Alocată", color: "bg-purple-500", textColor: "text-purple-800", bgColor: "bg-purple-100" },
    ACCEPTED: { label: "Acceptată", color: "bg-purple-500", textColor: "text-purple-800", bgColor: "bg-purple-100" },
    PICKED_UP: { label: "Ridicată", color: "bg-orange-500", textColor: "text-orange-800", bgColor: "bg-orange-100" },
    DELIVERED: { label: "Livrată", color: "bg-gray-500", textColor: "text-gray-800", bgColor: "bg-gray-100" },
  };
  return config[status] || { label: status, color: "bg-gray-500", textColor: "text-gray-800", bgColor: "bg-gray-100" };
};

const RestaurantApp = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingOrder, setPreparingOrder] = useState(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/restaurant/${user?.restaurant_id}`);
      setOrders(response.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.restaurant_id]);

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
        console.log('Audio not supported');
      }
    }
  }, [orders, seenOrderIds]);

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
      fetchOrders();
    } catch (error) {
      toast.error("Eroare la marcare gata");
    }
  };

  const activeOrders = orders.filter(o => !['DELIVERED', 'PICKED_UP'].includes(o.status));
  const completedToday = orders.filter(o => o.status === 'DELIVERED').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" data-testid="restaurant-app">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(24 95% 53%)' }}>
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
          className="mx-4 mt-3 p-4 rounded-xl text-center animate-pulse shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, hsl(24 95% 53%), hsl(0 85% 55%))',
            color: 'white'
          }}
          data-testid="new-order-flash"
        >
          <p className="text-lg font-bold tracking-wide">COMANDĂ NOUĂ PRIMITĂ!</p>
          <p className="text-sm opacity-90 mt-1">Verifică lista de comenzi</p>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'NEW').length}</p>
            <p className="text-xs text-muted-foreground">Noi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === 'PREPARING').length}</p>
            <p className="text-xs text-muted-foreground">În Pregătire</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{completedToday}</p>
            <p className="text-xs text-muted-foreground">Livrate</p>
          </CardContent>
        </Card>
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
              className={`${order.status === 'NEW' ? 'border-yellow-400 border-2 animate-pulse' : ''}`}
              data-testid={`order-card-${order.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{order.order_number}</span>
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
                <div className="bg-muted/50 rounded-lg p-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                      <span className="text-muted-foreground">{item.price * item.quantity} RON</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
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
                    <div className="text-orange-600 font-medium">📝 {order.notes}</div>
                  )}
                </div>

                {/* Driver Info */}
                {order.driver_name && (
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                    <Truck className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Livrator: {order.driver_name}</span>
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
                    {order.preparation_time && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Timp estimat: {order.preparation_time} min</span>
                      </div>
                    )}
                    <Button 
                      className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
                      onClick={() => markAsReady(order.id)}
                      data-testid={`ready-${order.id}`}
                    >
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      COMANDA GATA
                    </Button>
                  </div>
                )}

                {order.status === 'READY' && (
                  <div className="p-3 bg-green-100 rounded-lg text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-1" />
                    <p className="font-bold text-green-700">GATA PENTRU RIDICARE</p>
                    <p className="text-sm text-green-600">Așteptăm livratorul</p>
                  </div>
                )}

                {['ASSIGNED', 'ACCEPTED'].includes(order.status) && (
                  <div className="p-3 bg-purple-100 rounded-lg text-center">
                    <Truck className="w-8 h-8 text-purple-600 mx-auto mb-1" />
                    <p className="font-bold text-purple-700">LIVRATORUL VINE</p>
                    <p className="text-sm text-purple-600">{order.driver_name} preia comanda</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default RestaurantApp;
