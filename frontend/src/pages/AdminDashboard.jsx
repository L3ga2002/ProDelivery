import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LogOut,
  MapPin,
  Package,
  Users,
  RefreshCw,
  Truck,
  UserCheck,
  Clock,
  Plus,
  Store,
  DollarSign,
  Settings,
  MapPinned,
  Timer,
  CalendarCheck,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const activeDriverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const restaurantIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const getStatusBadge = (status) => {
  const statusConfig = {
    NEW: { label: "Nouă", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    PREPARING: { label: "Pregătire", className: "bg-blue-100 text-blue-800 border-blue-300" },
    READY: { label: "Gata", className: "bg-green-100 text-green-800 border-green-300" },
    ASSIGNED: { label: "Alocată", className: "bg-purple-100 text-purple-800 border-purple-300" },
    ACCEPTED: { label: "Acceptată", className: "bg-indigo-100 text-indigo-800 border-indigo-300" },
    PICKED_UP: { label: "Ridicată", className: "bg-orange-100 text-orange-800 border-orange-300" },
    DELIVERED: { label: "Livrată", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  };
  const config = statusConfig[status] || { label: status, className: "" };
  return <Badge className={`${config.className} border`}>{config.label}</Badge>;
};

const getSourceBadge = (source) => {
  const colors = {
    S: "bg-gray-100 text-gray-800",
    G: "bg-orange-100 text-orange-800",
    W: "bg-cyan-100 text-cyan-800",
    B: "bg-green-100 text-green-800",
  };
  const names = { S: "Site", G: "Glovo", W: "Wolt", B: "Bolt" };
  return <Badge className={colors[source] || "bg-gray-100"}>{names[source] || source}</Badge>;
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialogs
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [isNewDriverDialogOpen, setIsNewDriverDialogOpen] = useState(false);
  const [isNewRestaurantDialogOpen, setIsNewRestaurantDialogOpen] = useState(false);
  
  // New order form
  const [newOrder, setNewOrder] = useState({
    restaurant_id: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    items: [{ name: "", quantity: 1, price: 0 }],
    total_amount: 0,
    payment_type: "CASH",
    notes: "",
    source: "S"
  });
  
  // New driver form
  const [newDriver, setNewDriver] = useState({ name: "", phone: "", email: "" });
  
  // New restaurant form
  const [newRestaurant, setNewRestaurant] = useState({ name: "", address: "", phone: "" });
  
  // Settings (demo)
  const [settings, setSettings] = useState({
    autoAssign: false,
    timeout: 60,
    maxRadius: 5,
    zones: [
      { id: 1, name: "Zona 1 - Centru", price: 5 },
      { id: 2, name: "Zona 2 - Semicentral", price: 8 },
      { id: 3, name: "Zona 3 - Periferie", price: 12 },
      { id: 4, name: "Zona 4 - Extins", price: 15 },
    ]
  });
  
  // Check-in status with schedule (demo)
  const [checkIns, setCheckIns] = useState([
    { driver_id: "driver-001", name: "Ion Popescu", checked_in: true, hours: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
    { driver_id: "driver-002", name: "Maria Ionescu", checked_in: true, hours: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
    { driver_id: "driver-003", name: "Andrei Popa", checked_in: false, hours: [] },
    { driver_id: "driver-004", name: "Elena Dumitrescu", checked_in: true, hours: [18, 19, 20, 21, 22, 23, 0, 1, 2] },
    { driver_id: "driver-005", name: "Bogdan Stanescu", checked_in: false, hours: [] },
  ]);
  
  const workHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
  
  const formatHour = (h) => {
    const nextH = h === 23 ? 0 : h === 0 ? 1 : h === 1 ? 2 : h + 1;
    return `${h.toString().padStart(2, '0')}-${nextH.toString().padStart(2, '0')}`;
  };
  
  const getDriversAtHour = (hour) => {
    return checkIns.filter(c => c.checked_in && c.hours.includes(hour));
  };

  // Simulare mișcare livratori pe hartă
  const [driverPositions, setDriverPositions] = useState({});
  
  useEffect(() => {
    // Inițializare poziții livratori
    const initialPositions = {};
    drivers.forEach(d => {
      initialPositions[d.id] = { lat: d.latitude, lng: d.longitude };
    });
    setDriverPositions(initialPositions);
    
    // Animație mișcare livratori activi
    const moveInterval = setInterval(() => {
      setDriverPositions(prev => {
        const newPositions = { ...prev };
        drivers.forEach(d => {
          if (d.is_active && prev[d.id]) {
            // Mișcare aleatorie mică
            newPositions[d.id] = {
              lat: prev[d.id].lat + (Math.random() - 0.5) * 0.002,
              lng: prev[d.id].lng + (Math.random() - 0.5) * 0.002
            };
          }
        });
        return newPositions;
      });
    }, 3000);
    
    return () => clearInterval(moveInterval);
  }, [drivers]);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, driversRes, restaurantsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders`),
        axios.get(`${API_URL}/api/drivers`),
        axios.get(`${API_URL}/api/restaurants`),
        axios.get(`${API_URL}/api/stats`),
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data);
      setRestaurants(restaurantsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAssignOrder = (order) => {
    setSelectedOrder(order);
    setSelectedDriver("");
    setIsAssignDialogOpen(true);
  };

  const confirmAssign = async () => {
    if (!selectedDriver) {
      toast.error("Selectează un livrator");
      return;
    }
    try {
      await axios.put(`${API_URL}/api/orders/${selectedOrder.id}/assign`, { driver_id: selectedDriver });
      toast.success("Comandă alocată cu succes!");
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Eroare la alocare");
    }
  };

  const createOrder = async () => {
    if (!newOrder.restaurant_id || !newOrder.customer_name || !newOrder.customer_phone) {
      toast.error("Completează câmpurile obligatorii");
      return;
    }
    try {
      await axios.post(`${API_URL}/api/orders`, newOrder);
      toast.success("Comandă creată!");
      setIsNewOrderDialogOpen(false);
      setNewOrder({
        restaurant_id: "",
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        items: [{ name: "", quantity: 1, price: 0 }],
        total_amount: 0,
        payment_type: "CASH",
        notes: "",
        source: "S"
      });
      fetchData();
    } catch (error) {
      toast.error("Eroare la creare comandă");
    }
  };

  const createDriver = async () => {
    if (!newDriver.name || !newDriver.phone || !newDriver.email) {
      toast.error("Completează toate câmpurile");
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/drivers`, newDriver);
      toast.success(`Livrator creat! Parolă: ${res.data.password}`);
      setIsNewDriverDialogOpen(false);
      setNewDriver({ name: "", phone: "", email: "" });
      fetchData();
    } catch (error) {
      toast.error("Eroare la creare livrator");
    }
  };

  const createRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.address || !newRestaurant.phone) {
      toast.error("Completează toate câmpurile");
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/restaurants`, newRestaurant);
      toast.success(`Restaurant creat! Login: ${res.data.login_email} / ${res.data.password}`);
      setIsNewRestaurantDialogOpen(false);
      setNewRestaurant({ name: "", address: "", phone: "" });
      fetchData();
    } catch (error) {
      toast.error("Eroare la creare restaurant");
    }
  };

  const activeOrders = orders.filter((o) => o.status !== "DELIVERED");
  const activeDrivers = drivers.filter((d) => d.is_active);
  const availableDrivers = drivers.filter((d) => d.is_active && !d.current_order_id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" data-testid="admin-dashboard">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                PRODELIVERY
              </h1>
              <p className="text-xs text-muted-foreground">Dashboard Admin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} data-testid="refresh-button">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizează
            </Button>
            <div className="text-sm text-right hidden sm:block">
              <p className="font-medium">{user?.name}</p>
              <p className="text-muted-foreground text-xs">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-button">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.active_orders || 0}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_orders || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.active_drivers || 0}</p>
                  <p className="text-xs text-muted-foreground">Livratori</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Store className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_restaurants || 0}</p>
                  <p className="text-xs text-muted-foreground">Restaurante</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.delivered_orders || 0}</p>
                  <p className="text-xs text-muted-foreground">Livrate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{(stats.total_revenue || 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">RON</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button onClick={() => setIsNewOrderDialogOpen(true)} data-testid="new-order-btn">
            <Plus className="w-4 h-4 mr-2" />
            Comandă Nouă
          </Button>
          <Button variant="outline" onClick={() => setIsNewDriverDialogOpen(true)} data-testid="new-driver-btn">
            <Plus className="w-4 h-4 mr-2" />
            Livrator Nou
          </Button>
          <Button variant="outline" onClick={() => setIsNewRestaurantDialogOpen(true)} data-testid="new-restaurant-btn">
            <Plus className="w-4 h-4 mr-2" />
            Restaurant Nou
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders">Comenzi ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="map">Hartă</TabsTrigger>
            <TabsTrigger value="drivers">Livratori ({drivers.length})</TabsTrigger>
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurante ({restaurants.length})</TabsTrigger>
            <TabsTrigger value="zones">Zone Livrare</TabsTrigger>
            <TabsTrigger value="settings">Setări</TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Nr.</TableHead>
                      <TableHead>Sursă</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Sumă</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Livrator</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nu există comenzi active
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                          <TableCell>{getSourceBadge(order.source)}</TableCell>
                          <TableCell className="font-medium">{order.restaurant_name}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{order.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{order.total_amount} RON</span>
                            <Badge variant="outline" className="ml-2 text-xs">{order.payment_type}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>{order.driver_name || "-"}</TableCell>
                          <TableCell className="text-right">
                            {["NEW", "PREPARING", "READY"].includes(order.status) && (
                              <Button size="sm" onClick={() => handleAssignOrder(order)}>
                                Alocă
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Hartă Live
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] rounded-lg overflow-hidden border">
                  <MapContainer center={[44.4268, 26.1025]} zoom={13} className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {drivers.map((driver) => (
                      <Marker
                        key={driver.id}
                        position={[driver.latitude, driver.longitude]}
                        icon={driver.is_active ? activeDriverIcon : driverIcon}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{driver.name}</p>
                            <p>{driver.phone}</p>
                            <Badge className={driver.is_active ? "bg-green-100" : "bg-gray-100"}>
                              {driver.is_active ? "Activ" : "Inactiv"}
                            </Badge>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {restaurants.map((rest) => (
                      <Marker key={rest.id} position={[rest.latitude, rest.longitude]} icon={restaurantIcon}>
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{rest.name}</p>
                            <p className="text-muted-foreground">{rest.address}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Livrator Activ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Livrator Inactiv</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>Restaurant</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <Card>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers.map((driver) => (
                    <div
                      key={driver.id}
                      className={`p-4 rounded-lg border ${driver.is_active ? 'bg-green-50 border-green-200' : 'bg-muted/50'}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${driver.is_active ? 'bg-green-500' : 'bg-gray-400'}`}>
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-bold">{driver.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{driver.phone}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Livrări: {driver.total_deliveries || 0}</span>
                        <span>Câștig: {(driver.total_earnings || 0).toFixed(0)} RON</span>
                      </div>
                      <Badge className={`mt-2 ${driver.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {driver.is_active ? 'Activ' : 'Inactiv'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Restaurants Tab */}
          <TabsContent value="restaurants">
            <Card>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {restaurants.map((rest) => (
                    <div key={rest.id} className="p-4 rounded-lg border bg-orange-50 border-orange-200">
                      <div className="flex items-center gap-3 mb-2">
                        <Store className="w-8 h-8 text-orange-600" />
                        <p className="font-bold">{rest.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{rest.address}</p>
                      <p className="text-sm font-mono mt-1">{rest.phone}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Login: {rest.id.replace("rest-", "rest-")}@delivery.ro
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin">
            <div className="space-y-6">
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5" />
                    Program Livratori pentru Mâine
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Livratorii își selectează orele de lucru (10:00 - 02:00)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {checkIns.map((item) => (
                      <div 
                        key={item.driver_id} 
                        className={`p-4 rounded-lg border-2 ${
                          item.checked_in 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Truck className={`w-6 h-6 ${item.checked_in ? 'text-green-600' : 'text-red-400'}`} />
                            <span className="font-bold">{item.name}</span>
                          </div>
                          <Badge className={item.checked_in ? 'bg-green-500' : 'bg-red-500'}>
                            {item.checked_in ? `${item.hours.length}h` : 'ABSENT'}
                          </Badge>
                        </div>
                        {item.checked_in ? (
                          <div className="flex flex-wrap gap-1">
                            {item.hours.sort((a,b) => {
                              const aVal = a < 10 ? a + 24 : a;
                              const bVal = b < 10 ? b + 24 : b;
                              return aVal - bVal;
                            }).map(h => (
                              <span key={h} className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
                                {formatHour(h)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600">Nu a selectat program</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hourly Coverage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Acoperire pe Ore
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Câți livratori sunt disponibili în fiecare oră
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 min-w-max pb-2">
                      {workHours.map((hour) => {
                        const driversAtHour = getDriversAtHour(hour);
                        const count = driversAtHour.length;
                        return (
                          <div 
                            key={hour} 
                            className={`flex flex-col items-center p-2 rounded-lg min-w-[60px] ${
                              count === 0 ? 'bg-red-100' :
                              count === 1 ? 'bg-yellow-100' :
                              count === 2 ? 'bg-blue-100' :
                              'bg-green-100'
                            }`}
                          >
                            <span className="text-xs font-medium text-muted-foreground">{formatHour(hour)}</span>
                            <span className={`text-2xl font-bold ${
                              count === 0 ? 'text-red-600' :
                              count === 1 ? 'text-yellow-600' :
                              count === 2 ? 'text-blue-600' :
                              'text-green-600'
                            }`}>{count}</span>
                            <span className="text-xs text-muted-foreground">livratori</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex gap-4 mt-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                      <span>0 - Neacoperit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                      <span>1 - Minim</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
                      <span>2 - OK</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                      <span>3+ - Bine</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {checkIns.filter(c => c.checked_in).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Livratori activi</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">
                      {checkIns.filter(c => !c.checked_in).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Absenți</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {checkIns.reduce((sum, c) => sum + c.hours.length, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total ore-livrator</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Zones Tab */}
          <TabsContent value="zones">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinned className="w-5 h-5" />
                  Zone de Livrare - Bacău
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configurează zonele și tarifele de livrare
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {settings.zones.map((zone) => (
                    <div key={zone.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-lg">{zone.name}</h4>
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {zone.price} RON
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type="number" 
                          value={zone.price}
                          onChange={(e) => {
                            const newZones = settings.zones.map(z => 
                              z.id === zone.id ? {...z, price: parseFloat(e.target.value) || 0} : z
                            );
                            setSettings({...settings, zones: newZones});
                          }}
                          className="w-24"
                        />
                        <span className="flex items-center text-muted-foreground">RON / livrare</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Notă:</strong> Zonele vor fi configurate pe hartă în faza următoare. 
                    Clientul va defini granițele exacte pentru fiecare zonă.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Setări Sistem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Assign */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-bold">Alocare Automată</h4>
                    <p className="text-sm text-muted-foreground">
                      Sistemul alocă automat comenzile către cel mai apropiat livrator
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={settings.autoAssign ? 'text-green-600' : 'text-muted-foreground'}>
                      {settings.autoAssign ? 'ACTIV' : 'INACTIV'}
                    </span>
                    <Switch 
                      checked={settings.autoAssign}
                      onCheckedChange={(checked) => setSettings({...settings, autoAssign: checked})}
                    />
                  </div>
                </div>

                {/* Timeout */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        Timeout Acceptare
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Timp de așteptare până la reatribuire automată
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg">
                      {settings.timeout} secunde
                    </Badge>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="number" 
                      value={settings.timeout}
                      onChange={(e) => setSettings({...settings, timeout: parseInt(e.target.value) || 60})}
                      className="w-24"
                      disabled={!settings.autoAssign}
                    />
                    <span className="text-muted-foreground">secunde</span>
                    {!settings.autoAssign && (
                      <span className="text-sm text-orange-600 ml-4">
                        (Activează alocarea automată pentru a folosi timeout)
                      </span>
                    )}
                  </div>
                </div>

                {/* Max Radius */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Rază Maximă Alocare
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Distanța maximă între livrator și restaurant
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg">
                      {settings.maxRadius} km
                    </Badge>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="number" 
                      value={settings.maxRadius}
                      onChange={(e) => setSettings({...settings, maxRadius: parseFloat(e.target.value) || 5})}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">kilometri</span>
                  </div>
                </div>

                {/* Save Button */}
                <Button className="w-full" onClick={() => toast.success('Setări salvate (demo)')}>
                  Salvează Setările
                </Button>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Mod Demo:</strong> Setările sunt afișate pentru demonstrație. 
                    Funcționalitatea completă va fi activată în fazele următoare.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocă Comandă</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-mono text-sm mb-2">{selectedOrder.order_number}</p>
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_address}</p>
                <p className="font-semibold mt-2">{selectedOrder.total_amount} RON</p>
              </div>
              <div>
                <Label>Selectează Livrator</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alege un livrator" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Anulează</Button>
            <Button onClick={confirmAssign}>Alocă</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={isNewOrderDialogOpen} onOpenChange={setIsNewOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comandă Nouă</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Restaurant *</Label>
                <Select value={newOrder.restaurant_id} onValueChange={(v) => setNewOrder({...newOrder, restaurant_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sursă</Label>
                <Select value={newOrder.source} onValueChange={(v) => setNewOrder({...newOrder, source: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Site/Telefon</SelectItem>
                    <SelectItem value="G">Glovo</SelectItem>
                    <SelectItem value="W">Wolt</SelectItem>
                    <SelectItem value="B">Bolt Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nume Client *</Label>
              <Input value={newOrder.customer_name} onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})} />
            </div>
            <div>
              <Label>Telefon Client *</Label>
              <Input value={newOrder.customer_phone} onChange={(e) => setNewOrder({...newOrder, customer_phone: e.target.value})} />
            </div>
            <div>
              <Label>Adresă Livrare *</Label>
              <Input value={newOrder.customer_address} onChange={(e) => setNewOrder({...newOrder, customer_address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sumă Totală (RON) *</Label>
                <Input type="number" value={newOrder.total_amount} onChange={(e) => setNewOrder({...newOrder, total_amount: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Plată</Label>
                <Select value={newOrder.payment_type} onValueChange={(v) => setNewOrder({...newOrder, payment_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observații</Label>
              <Textarea value={newOrder.notes} onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOrderDialogOpen(false)}>Anulează</Button>
            <Button onClick={createOrder}>Creează Comandă</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Driver Dialog */}
      <Dialog open={isNewDriverDialogOpen} onOpenChange={setIsNewDriverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Livrator Nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume *</Label>
              <Input value={newDriver.name} onChange={(e) => setNewDriver({...newDriver, name: e.target.value})} />
            </div>
            <div>
              <Label>Telefon *</Label>
              <Input value={newDriver.phone} onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={newDriver.email} onChange={(e) => setNewDriver({...newDriver, email: e.target.value})} />
            </div>
            <p className="text-sm text-muted-foreground">Parola implicită: driver123</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDriverDialogOpen(false)}>Anulează</Button>
            <Button onClick={createDriver}>Creează Livrator</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Restaurant Dialog */}
      <Dialog open={isNewRestaurantDialogOpen} onOpenChange={setIsNewRestaurantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurant Nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume Restaurant *</Label>
              <Input value={newRestaurant.name} onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})} />
            </div>
            <div>
              <Label>Adresă *</Label>
              <Input value={newRestaurant.address} onChange={(e) => setNewRestaurant({...newRestaurant, address: e.target.value})} />
            </div>
            <div>
              <Label>Telefon *</Label>
              <Input value={newRestaurant.phone} onChange={(e) => setNewRestaurant({...newRestaurant, phone: e.target.value})} />
            </div>
            <p className="text-sm text-muted-foreground">Se va crea automat un cont pentru restaurant cu parola: restaurant123</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewRestaurantDialogOpen(false)}>Anulează</Button>
            <Button onClick={createRestaurant}>Creează Restaurant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
