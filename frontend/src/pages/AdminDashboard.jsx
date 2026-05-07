import { useState, useEffect, useCallback, useRef } from "react";
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
  DialogDescription,
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
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
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
  Settings,
  Timer,
  CalendarCheck,
  BarChart3,
  TrendingUp,
  Play,
  CheckCircle2,
  Loader2,
  Circle,
  XCircle,
  Moon,
  Sun,
} from "lucide-react";
import { AdminScheduleView } from "../components/AdminScheduleView";
import { RestaurantZonesManager } from "../components/RestaurantZonesManager";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { useTheme } from "../context/ThemeContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
    NEW: { label: "Nouă", className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-100 dark:border-yellow-900" },
    PREPARING: { label: "Pregătire", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900" },
    READY: { label: "Gata", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-100 dark:border-green-900" },
    ASSIGNED: { label: "Alocată", className: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-100 dark:border-purple-900" },
    ACCEPTED: { label: "Acceptată", className: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-900" },
    PICKED_UP: { label: "Ridicată", className: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-900" },
    DELIVERED: { label: "Livrată", className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900" },
    CANCELLED: { label: "Anulată", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-100 dark:border-red-900" },
  };
  const config = statusConfig[status] || { label: status, className: "" };
  return <Badge className={`${config.className} border`}>{config.label}</Badge>;
};

const getSourceBadge = (source) => {
  const colors = {
    S: "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100",
    G: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
    W: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
    B: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-100",
  };
  const names = { S: "Site", G: "Glovo", W: "Wolt", B: "Bolt" };
  return <Badge className={colors[source] || "bg-gray-100"}>{names[source] || source}</Badge>;
};

const OrderLocationMapEvents = ({ onChange }) => {
  useMapEvents({
    click(event) {
      onChange({
        customer_latitude: Number(event.latlng.lat.toFixed(6)),
        customer_longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
};

const MapAutoCenter = ({ position, zoom = 15 }) => {
  const map = useMap();

  useEffect(() => {
    if (position?.lat && position?.lng) {
      map.setView([position.lat, position.lng], zoom, { animate: true });
    }
  }, [map, position, zoom]);

  return null;
};

const RestaurantLocationMapInteractions = ({ onLocationChange }) => {
  useMapEvents({
    click(event) {
      onLocationChange?.({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
        location_source: "manual_adjusted",
      });
    },
  });
  return null;
};

const OrderLocationPicker = ({ value, onChange }) => {

  return (
    <div className="space-y-2" data-testid="order-location-picker">
      <div className="h-64 rounded-lg overflow-hidden border">
        <MapContainer center={[46.567, 26.913]} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <OrderLocationMapEvents onChange={onChange} />
          {value.customer_latitude && value.customer_longitude && (
            <Marker position={[value.customer_latitude, value.customer_longitude]}>
              <Popup>Locație livrare selectată</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Click pe hartă pentru a seta locația clientului. Sistemul verifică zona restaurantului selectat.
      </p>
    </div>
  );
};

const RestaurantLocationPreview = ({ restaurant, onLocationChange }) => {
  const position = {
    lat: restaurant.latitude || 46.567,
    lng: restaurant.longitude || 26.913,
  };

  const handleDragEnd = (event) => {
    const marker = event.target;
    const nextPosition = marker.getLatLng();
    onLocationChange?.({
      latitude: Number(nextPosition.lat.toFixed(6)),
      longitude: Number(nextPosition.lng.toFixed(6)),
      location_source: "manual_adjusted",
    });
  };

  return (
    <div className="space-y-2">
      <div className="relative h-64 overflow-hidden rounded-lg border border-slate-200 shadow-sm" data-testid="new-restaurant-location-map">
        <MapContainer center={[position.lat, position.lng]} zoom={15} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapAutoCenter position={position} />
          <RestaurantLocationMapInteractions onLocationChange={onLocationChange} />
          <Marker
            position={[position.lat, position.lng]}
            icon={restaurantIcon}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          >
            <Popup>{restaurant.name || "Restaurant nou"}</Popup>
          </Marker>
        </MapContainer>
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100">
          Mută pinul prin drag sau click pe hartă
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="new-restaurant-pin-help-text">
        După geocoding, poziția poate fi ajustată manual înainte de salvarea restaurantului.
      </p>
    </div>
  );
};

const AdminStatCard = ({ icon: Icon, label, value, tone = "slate", testId }) => {
  const toneClasses = {
    slate: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950",
    blue: "border-blue-200 bg-blue-50/80 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100",
    green: "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100",
    amber: "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100",
    orange: "border-orange-200 bg-orange-50/80 text-orange-900 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-100",
    red: "border-red-200 bg-red-50/80 text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100",
  };

  return (
    <Card className={`overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-md ${toneClasses[tone]}`} data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          </div>
          <div className="rounded-lg bg-white/70 p-2 shadow-sm dark:bg-slate-900/70">
            <Icon className="h-6 w-6 opacity-80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MetricTile = ({ label, value, icon: Icon, tone = "blue", testId }) => {
  const toneClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100",
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`} data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {Icon && <Icon className="h-6 w-6 opacity-80" />}
      </div>
    </div>
  );
};

const RestaurantChartCard = ({ title, icon: Icon, data, color = "hsl(215 75% 22%)", testId, interval }) => (
  <Card className="border-slate-200 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md" data-testid={testId}>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base">
        {Icon && <Icon className="h-5 w-5 text-slate-700 dark:text-slate-100" />}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 88%)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={interval} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
          <Bar dataKey="count" name="Comenzi" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const RestaurantAnalyticsPanel = ({ analytics, isLoading }) => {
  if (isLoading && !analytics) {
    return (
      <Card className="min-h-[620px] border-slate-200 shadow-sm" data-testid="restaurant-analytics-loading">
        <CardContent className="grid min-h-[620px] place-items-center p-6">
          <div className="space-y-3 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600" />
            <p>Se încarcă analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!analytics) return null;

  const summary = analytics.summary || {};
  const charts = analytics.charts || {};
  const recentOrders = analytics.recent_orders || [];

  return (
    <div className="relative space-y-4 transition-opacity duration-200" data-testid="restaurant-analytics-panel">
      {isLoading && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200" data-testid="restaurant-analytics-refresh-indicator">
          Actualizez discret...
        </div>
      )}
      <div className="grid md:grid-cols-4 gap-3">
        <MetricTile label="Comenzi total" value={summary.total_orders || 0} icon={Package} tone="slate" testId="restaurant-analytics-total-orders" />
        <MetricTile label="Prep. mediu" value={`${summary.avg_preparation_actual_minutes || 0} min`} icon={Timer} tone="blue" testId="restaurant-analytics-average-prep" />
        <MetricTile label="Întârziere medie" value={`${summary.avg_preparation_delay_minutes || 0} min`} icon={Clock} tone="amber" testId="restaurant-analytics-average-delay" />
        <MetricTile label="Livrare medie" value={`${summary.avg_delivery_minutes || 0} min`} icon={Truck} tone="green" testId="restaurant-analytics-average-delivery" />
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <RestaurantChartCard title="Comenzi pe ore" icon={BarChart3} data={charts.by_hour || []} testId="restaurant-chart-hour" interval={2} />
        <RestaurantChartCard title="Comenzi pe zile" icon={CalendarCheck} data={charts.by_day || []} color="hsl(158 64% 36%)" testId="restaurant-chart-day" />
        <RestaurantChartCard title="Comenzi pe săptămâni" icon={TrendingUp} data={charts.by_week || []} color="hsl(217 33% 35%)" testId="restaurant-chart-week" />
        <RestaurantChartCard title="Comenzi pe luni" icon={TrendingUp} data={charts.by_month || []} color="hsl(24 90% 50%)" testId="restaurant-chart-month" />
        <RestaurantChartCard title="Comenzi pe ani" icon={BarChart3} data={charts.by_year || []} color="hsl(220 14% 46%)" testId="restaurant-chart-year" />
        <Card className="border-slate-200 bg-slate-950 text-white shadow-sm" data-testid="restaurant-analytics-insight-card">
          <CardContent className="flex h-full min-h-[220px] flex-col justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Insight operațional</p>
              <p className="mt-3 text-3xl font-bold">{summary.avg_preparation_delay_minutes || 0} min</p>
              <p className="mt-1 text-sm text-slate-300">întârziere medie restaurant</p>
            </div>
            <p className="text-sm text-slate-300">Datele se actualizează din comenzile reale și ajută la discuții clare cu restaurantul.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Istoric comenzi restaurant</CardTitle>
          <p className="text-sm text-muted-foreground">Timp estimat, timp real și întârziere sunt calculate automat din fluxul comenzilor.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Prep. estimat</TableHead>
                <TableHead>Prep. real</TableHead>
                <TableHead>Întârziere</TableHead>
                <TableHead>Livrare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.slice(0, 12).map((order) => (
                <TableRow key={order.id} data-testid={`restaurant-analytics-order-${order.id}`}>
                  <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{order.total_amount} RON</TableCell>
                  <TableCell>{order.preparation_time ? `${order.preparation_time} min` : "-"}</TableCell>
                  <TableCell>{order.preparation_actual_minutes != null ? `${order.preparation_actual_minutes} min` : "-"}</TableCell>
                  <TableCell>{order.preparation_delay_minutes != null ? `${order.preparation_delay_minutes} min` : "-"}</TableCell>
                  <TableCell>{order.delivery_minutes != null ? `${order.delivery_minutes} min` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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
  const [isRestaurantPickerOpen, setIsRestaurantPickerOpen] = useState(false);
  
  // Hourly data for charts
  const [hourlyData, setHourlyData] = useState({ hourly_orders: [] });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [restaurantAnalytics, setRestaurantAnalytics] = useState(null);
  const [restaurantAnalyticsLoading, setRestaurantAnalyticsLoading] = useState(false);
  
  // Demo simulation
  const [isSimDialogOpen, setIsSimDialogOpen] = useState(false);
  const [simSteps, setSimSteps] = useState([]);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const simAbort = useRef(false);
  
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  
  // New order form
  const [newOrder, setNewOrder] = useState({
    restaurant_id: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    customer_latitude: null,
    customer_longitude: null,
    items: [{ name: "", quantity: 1, price: 0 }],
    subtotal_amount: 0,
    delivery_fee: 0,
    total_amount: 0,
    delivery_zone_id: null,
    delivery_zone_name: "",
    delivery_sector: "",
    delivery_zone_level: null,
    payment_type: "CASH",
    notes: "",
    source: "S"
  });
  
  // New driver form
  const [newDriver, setNewDriver] = useState({ name: "", phone: "", email: "" });
  
  // New restaurant form
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    address: "",
    phone: "",
    contact_name: "",
    email: "",
    latitude: 46.567,
    longitude: 26.913,
    location_source: "manual",
  });
  
  // Settings (demo)
  const [settings, setSettings] = useState({
    autoAssign: false,
    timeout: 60,
    maxRadius: 5,
  });
  
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
      const [ordersRes, driversRes, restaurantsRes, statsRes, hourlyRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders`),
        axios.get(`${API_URL}/api/drivers`),
        axios.get(`${API_URL}/api/restaurants`),
        axios.get(`${API_URL}/api/stats`),
        axios.get(`${API_URL}/api/stats/hourly`),
        axios.get(`${API_URL}/api/stats/analytics`).catch(() => ({ data: null })),
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data);
      setRestaurants(restaurantsRes.data);
      setStats(statsRes.data);
      setHourlyData(hourlyRes.data);
      if (analyticsRes.data) setAnalyticsData(analyticsRes.data);
    } catch (error) {
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setIsLoading(false);
    }
  }, [setAnalyticsData, setDrivers, setHourlyData, setIsLoading, setOrders, setRestaurants, setStats]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const effectiveRestaurantId = selectedRestaurantId || restaurants[0]?.id;

  useEffect(() => {
    if (!effectiveRestaurantId) return;
    let cancelled = false;
    setRestaurantAnalyticsLoading(true);
    axios.get(`${API_URL}/api/restaurants/${effectiveRestaurantId}/analytics`)
      .then((response) => {
        if (!cancelled) setRestaurantAnalytics(response.data);
      })
      .catch(() => {
        if (!cancelled) {
          setRestaurantAnalytics((previous) => (
            previous?.restaurant?.id === effectiveRestaurantId ? null : previous
          ));
        }
      })
      .finally(() => {
        if (!cancelled) setRestaurantAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveRestaurantId]);

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
    if (!newOrder.restaurant_id || !newOrder.customer_name || !newOrder.customer_phone || !newOrder.customer_latitude || !newOrder.customer_longitude) {
      toast.error("Completează câmpurile obligatorii");
      return;
    }
    if (!newOrder.delivery_zone_id) {
      toast.error("Selectează o locație validă dintr-o zonă de livrare");
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
        customer_latitude: null,
        customer_longitude: null,
        items: [{ name: "", quantity: 1, price: 0 }],
        subtotal_amount: 0,
        delivery_fee: 0,
        total_amount: 0,
        delivery_zone_id: null,
        delivery_zone_name: "",
        delivery_sector: "",
        delivery_zone_level: null,
        payment_type: "CASH",
        notes: "",
        source: "S"
      });
      fetchData();
    } catch (error) {
      toast.error("Eroare la creare comandă");
    }
  };

  const detectOrderZone = useCallback(async (lat, lng) => {
    if (!newOrder.restaurant_id) {
      toast.error("Selectează restaurantul înainte de verificarea zonei");
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/zones/detect`, {
        restaurant_id: newOrder.restaurant_id,
        lat,
        lng,
      });
      const zone = response.data;
      setNewOrder((prev) => {
        const deliveryFee = zone.fee || 0;
        const subtotal = Number(prev.subtotal_amount || 0);
        return {
          ...prev,
          delivery_zone_id: zone.zone_id,
          delivery_zone_name: zone.zone_name || "",
          delivery_sector: zone.sector || "",
          delivery_zone_level: zone.zone_level,
          delivery_fee: deliveryFee,
          total_amount: Number((subtotal + deliveryFee).toFixed(2)),
        };
      });
      if (zone.zone_id) {
        toast.success(`Zonă detectată: ${zone.zone_name} · ${zone.fee} lei`);
      } else {
        toast.error("Adresa este în afara zonelor acestui restaurant");
      }
    } catch {
      toast.error("Nu am putut detecta zona");
    }
  }, [newOrder.restaurant_id, setNewOrder]);

  const updateOrderLocation = useCallback((location) => {
    setNewOrder((prev) => ({
      ...prev,
      ...location,
    }));
    if (location.customer_latitude && location.customer_longitude) {
      detectOrderZone(location.customer_latitude, location.customer_longitude);
    }
  }, [detectOrderZone]);

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
    if (!newRestaurant.name || !newRestaurant.address || !newRestaurant.phone || !newRestaurant.latitude || !newRestaurant.longitude) {
      toast.error("Completează toate câmpurile");
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/restaurants`, newRestaurant);
      toast.success(`Restaurant creat! Login: ${res.data.login_email} / ${res.data.password}`);
      setIsNewRestaurantDialogOpen(false);
      setNewRestaurant({
        name: "",
        address: "",
        phone: "",
        contact_name: "",
        email: "",
        latitude: 46.567,
        longitude: 26.913,
        location_source: "manual",
      });
      setSelectedRestaurantId(res.data.restaurant_id);
      fetchData();
    } catch (error) {
      toast.error("Eroare la creare restaurant");
    }
  };

  // ============ DEMO SIMULATION ============
  const SIM_STEPS_TEMPLATE = [
    { key: "create", label: "Comandă nouă creată", icon: "Package", status: "pending" },
    { key: "preparing", label: "Restaurant setează timp pregătire (10 min)", icon: "Clock", status: "pending" },
    { key: "ready", label: "Restaurant marchează GATA", icon: "ChefHat", status: "pending" },
    { key: "assign", label: "Admin alocă livrator", icon: "Truck", status: "pending" },
    { key: "accept", label: "Livrator ACCEPTĂ comanda", icon: "CheckCircle", status: "pending" },
    { key: "pickup", label: "Livrator RIDICĂ comanda", icon: "Package", status: "pending" },
    { key: "deliver", label: "Livrator LIVREAZĂ cu succes", icon: "CheckCircle", status: "pending" },
  ];

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const updateStep = (stepIndex, status) => {
    setSimSteps((prev) => prev.map((s, i) => (i === stepIndex ? { ...s, status } : s)));
  };

  const runSimulation = async () => {
    simAbort.current = false;
    setSimSteps(SIM_STEPS_TEMPLATE.map((s) => ({ ...s })));
    setIsSimRunning(true);
    setIsSimDialogOpen(true);

    const randomNames = ["Alexandru Marin", "Elena Radu", "Bogdan Stoica", "Ana Gheorghe", "Mihai Florea"];
    const randomPhones = ["0722334455", "0733445566", "0744556677", "0755667788", "0766778899"];
    const randomAddresses = [
      "Calea Mărășești 45, Ap. 12, Bacău",
      "Str. Republicii 78, Ap. 3, Bacău",
      "Str. 9 Mai 22, Bacău",
      "Bd. Unirii 101, Ap. 8, Bacău",
      "Str. Mihai Eminescu 33, Bacău",
    ];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    try {
      // Step 1: Create order — apare la Restaurant
      updateStep(0, "active");
      await wait(1500);
      const rest = restaurants.length > 0 ? restaurants[Math.floor(Math.random() * restaurants.length)] : null;
      if (!rest) throw new Error("No restaurants");
      const orderRes = await axios.post(`${API_URL}/api/orders`, {
        restaurant_id: rest.id,
        customer_name: pick(randomNames),
        customer_phone: pick(randomPhones),
        customer_address: pick(randomAddresses),
        items: [{ name: "Pizza Margherita", quantity: 2, price: 35 }, { name: "Cola 500ml", quantity: 1, price: 8 }],
        total_amount: 78,
        payment_type: "CASH",
        notes: "Simulare demo - comandă test",
        source: "S",
      });
      const orderId = orderRes.data.id;
      updateStep(0, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 2: Restaurant setează pregătire
      updateStep(1, "active");
      await wait(5000);
      await axios.put(`${API_URL}/api/orders/${orderId}/preparing`, { preparation_time: 10 });
      updateStep(1, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 3: Restaurant marchează GATA
      updateStep(2, "active");
      await wait(5000);
      await axios.put(`${API_URL}/api/orders/${orderId}/ready`);
      updateStep(2, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 4: Admin alocă livrator — apare la Driver
      updateStep(3, "active");
      await wait(5000);
      const avail = drivers.filter((d) => d.is_active && !d.current_order_id);
      const driver = avail.length > 0 ? avail[0] : drivers.find((d) => d.is_active) || drivers[0];
      await axios.put(`${API_URL}/api/orders/${orderId}/assign`, { driver_id: driver.id });
      updateStep(3, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 5: Livrator acceptă
      updateStep(4, "active");
      await wait(5000);
      await axios.put(`${API_URL}/api/orders/${orderId}/status`, { status: "ACCEPTED" });
      updateStep(4, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 6: Livrator ridică
      updateStep(5, "active");
      await wait(5000);
      await axios.put(`${API_URL}/api/orders/${orderId}/status`, { status: "PICKED_UP" });
      updateStep(5, "done");
      if (simAbort.current) return;
      fetchData();

      // Step 7: Livrator livrează
      updateStep(6, "active");
      await wait(5000);
      await axios.put(`${API_URL}/api/orders/${orderId}/status`, { status: "DELIVERED" });
      updateStep(6, "done");
      fetchData();

      toast.success("Simulare completă! Comanda a parcurs tot fluxul.");
    } catch (err) {
      toast.error("Eroare în simulare: " + (err.message || "necunoscută"));
    } finally {
      setIsSimRunning(false);
    }
  };

  const activeOrders = orders.filter((o) => o.status !== "DELIVERED");
  const activeDrivers = drivers.filter((d) => d.is_active);
  const availableDrivers = drivers.filter((d) => d.is_active && !d.current_order_id);
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || restaurants[0] || null;

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
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(215 75% 22%)' }}>
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                PRODELIVERY <span style={{ color: 'hsl(24 95% 53%)', fontSize: '0.7em' }}>BACAU</span>
              </h1>
              <p className="text-xs text-muted-foreground">Dashboard Admin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="border-border/80 bg-card/85 backdrop-blur"
              data-testid="admin-theme-toggle"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </Button>
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
        <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-sm" data-testid="admin-command-center-hero">
          <div className="grid gap-4 p-5 lg:grid-cols-[1.5fr_1fr] lg:p-6">
            <div>
              <Badge className="mb-3 border-white/20 bg-white/10 text-white hover:bg-white/10">Control Room · Bacău</Badge>
              <h2 className="text-3xl font-bold tracking-tight">Operațiuni live, restaurante și program într-un singur panou.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Fluxul este construit pentru dispecerat: comenzi active, timp de preparare, zone per restaurant și sloturi normale generate rapid.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-white/10 bg-white/10 p-3" data-testid="hero-active-orders">
                <p className="text-2xl font-bold">{stats.active_orders || 0}</p>
                <p className="text-xs text-slate-300">active</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3" data-testid="hero-active-drivers">
                <p className="text-2xl font-bold">{activeDrivers.length}</p>
                <p className="text-xs text-slate-300">livratori</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3" data-testid="hero-restaurants">
                <p className="text-2xl font-bold">{restaurants.length}</p>
                <p className="text-xs text-slate-300">restaurante</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <AdminStatCard icon={Package} label="Active" value={stats.active_orders || 0} tone="amber" testId="admin-stat-active-orders" />
          <AdminStatCard icon={Clock} label="Total" value={stats.total_orders || 0} tone="blue" testId="admin-stat-total-orders" />
          <AdminStatCard icon={UserCheck} label="Livratori" value={stats.active_drivers || 0} tone="green" testId="admin-stat-active-drivers" />
          <AdminStatCard icon={Store} label="Restaurante" value={stats.total_restaurants || 0} tone="orange" testId="admin-stat-restaurants" />
          <AdminStatCard icon={Package} label="Livrate" value={stats.delivered_orders || 0} tone="green" testId="admin-stat-delivered" />
          <AdminStatCard icon={XCircle} label="Anulate" value={stats.cancelled_orders || 0} tone="red" testId="admin-stat-cancelled" />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            onClick={runSimulation}
            disabled={isSimRunning}
            className="gap-2 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(24 95% 53%), hsl(24 95% 45%))', color: 'white' }}
            data-testid="simulate-demo-btn"
          >
            {isSimRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isSimRunning ? "Simulare în curs..." : "Simulare Demo"}
          </Button>
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
            <TabsTrigger value="orders" data-testid="tab-orders">Comenzi ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analize</TabsTrigger>
            <TabsTrigger value="map" data-testid="tab-map">Hartă</TabsTrigger>
            <TabsTrigger value="drivers" data-testid="tab-drivers">Livratori ({drivers.length})</TabsTrigger>
            <TabsTrigger value="program" data-testid="tab-program">Program</TabsTrigger>
            <TabsTrigger value="restaurants" data-testid="tab-restaurants">Restaurante ({restaurants.length})</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Setări</TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="control-surface overflow-hidden" data-testid="admin-orders-control-surface">
              <CardHeader className="border-b bg-slate-50/70 pb-4 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                      Comenzi active în dispecerat
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Prioritizare rapidă pentru pregătire, alocare și urmărire.</p>
                  </div>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100" data-testid="admin-orders-active-count">
                    {activeOrders.length} active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
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
                        <TableRow key={order.id} className="group border-l-4 border-l-transparent transition-colors hover:border-l-indigo-500 hover:bg-slate-50/80 dark:hover:bg-slate-900/60" data-testid={`admin-order-row-${order.id}`}>
                          <TableCell className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-100">{order.order_number}</TableCell>
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
                              <Button size="sm" className="bg-indigo-700 hover:bg-indigo-600" onClick={() => handleAssignOrder(order)} data-testid={`admin-order-assign-button-${order.id}`}>
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" data-testid="analytics-tab">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Hourly Orders Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Comenzi pe Oră
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Distribuția comenzilor pe parcursul zilei</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData.hourly_orders}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 88%)" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(220 15% 88%)', fontSize: '13px' }}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar dataKey="orders" name="Comenzi" fill="hsl(215 75% 22%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Orders by Restaurant Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" style={{ color: 'hsl(24 95% 53%)' }} />
                    Comenzi per Restaurant
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Distribuția comenzilor pe restaurante</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData?.orders_by_restaurant || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 88%)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '13px' }} />
                      <Bar dataKey="count" name="Comenzi" fill="hsl(24 95% 53%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary stats for today */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Sumar Zi Curentă</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                      <p className="text-3xl font-bold text-primary">{stats.total_orders || 0}</p>
                      <p className="text-sm text-muted-foreground mt-1">Total Comenzi</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950/30 dark:border-green-900">
                      <p className="text-3xl font-bold text-green-600">{stats.delivered_orders || 0}</p>
                      <p className="text-sm text-muted-foreground mt-1">Livrate</p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-center dark:bg-yellow-950/30 dark:border-yellow-900">
                      <p className="text-3xl font-bold text-yellow-600">{stats.active_orders || 0}</p>
                      <p className="text-sm text-muted-foreground mt-1">Active</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center dark:bg-red-950/30 dark:border-red-900">
                      <p className="text-3xl font-bold text-red-600">{stats.cancelled_orders || 0}</p>
                      <p className="text-sm text-muted-foreground mt-1">Anulate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Orders by Driver */}
              {analyticsData?.orders_by_driver?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comenzi per Livrator</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.orders_by_driver.map((d) => (
                        <div key={d.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <span className="font-medium text-sm">{d.name}</span>
                          <Badge variant="outline">{d.count} comenzi</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cancelled Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-600">
                    <XCircle className="w-5 h-5" />
                    Comenzi Anulate ({analyticsData?.cancelled_count || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(analyticsData?.cancelled_orders?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nicio comandă anulată</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {analyticsData.cancelled_orders.map((o) => (
                        <div key={`${o.order_number}-${o.cancelled_by || "unknown"}`} className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/30 dark:border-red-900">
                          <div className="flex justify-between text-sm">
                            <span className="font-mono font-bold">{o.order_number}</span>
                            <Badge variant="outline" className="text-xs">{o.cancelled_by || "?"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{o.restaurant_name}</p>
                          <p className="text-sm text-red-700 mt-1 font-medium dark:text-red-100">Motiv: {o.cancellation_reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Hartă Live - Bacău
                  <Badge variant="outline" className="ml-2 text-xs animate-pulse border-green-400 text-green-600 dark:border-green-700 dark:text-green-100">
                    LIVE
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] rounded-lg overflow-hidden border">
                  <MapContainer center={[46.567, 26.913]} zoom={14} className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {drivers.map((driver) => {
                      const pos = driverPositions[driver.id];
                      return (
                        <Marker
                          key={driver.id}
                          position={[pos?.lat || driver.latitude, pos?.lng || driver.longitude]}
                          icon={driver.is_active ? activeDriverIcon : driverIcon}
                        >
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold">{driver.name}</p>
                              <p>{driver.phone}</p>
                              <Badge className={driver.is_active ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-100" : "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100"}>
                                {driver.is_active ? "Activ" : "Inactiv"}
                              </Badge>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
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
                      className={`p-4 rounded-lg border ${driver.is_active ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-muted/50'}`}
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
                        <span>Scor: {driver.ranking_score || 0}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={`mt-2 ${driver.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100'}`}>
                          {driver.is_active ? 'Activ' : 'Inactiv'}
                        </Badge>
                        {driver.ranking_tier && (
                          <Badge variant="outline" data-testid={`driver-tier-${driver.id}`}>
                            {driver.ranking_tier}
                          </Badge>
                        )}
                      </div>
                      {driver.schedule_access?.opens_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Acces calendar: {driver.schedule_access.opens_at_label || driver.schedule_access.opens_at}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Restaurants Tab */}
          <TabsContent value="restaurants">
            <div className="space-y-4">
              <Card className="control-surface overflow-hidden">
                <CardHeader className="border-b bg-slate-50/70 dark:bg-slate-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Store className="h-5 w-5 text-orange-600" />
                        Restaurante operaționale
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">Alege restaurantul pentru performanță, zone și coordonate.</p>
                    </div>
                    <Badge variant="outline" className="border-slate-300 bg-white dark:bg-slate-950" data-testid="restaurants-panel-count">
                      {restaurants.length} restaurante
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {restaurants.map((rest) => {
                      const isSelected = selectedRestaurant?.id === rest.id;
                      const activeForRestaurant = activeOrders.filter((order) => order.restaurant_id === rest.id).length;
                      const totalForRestaurant = orders.filter((order) => order.restaurant_id === rest.id).length;
                      return (
                        <button
                          key={rest.id}
                          type="button"
                          onClick={() => setSelectedRestaurantId(rest.id)}
                          className={`premium-card relative overflow-hidden rounded-lg border p-4 text-left ${isSelected ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/20 dark:ring-indigo-950" : "bg-card hover:border-slate-300 hover:bg-slate-50/70 dark:hover:bg-slate-900/60"}`}
                          data-testid={`restaurant-card-${rest.id}`}
                        >
                          <div className="absolute right-3 top-3 rounded-full border bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/80">
                            {isSelected ? "activ" : "profil"}
                          </div>
                          <div className="flex items-center gap-3 mb-3 pr-14">
                            <div className="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/30">
                              <Store className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold">{rest.name}</p>
                              <p className="text-xs text-muted-foreground">{activeForRestaurant} active · {totalForRestaurant} total</p>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{rest.address}</p>
                          <p className="text-sm font-mono mt-2 font-medium">{rest.phone}</p>
                          {rest.email && <p className="text-xs text-muted-foreground mt-1">{rest.email}</p>}
                          <Badge className={`mt-3 ${isSelected ? "bg-indigo-700 text-white" : ""}`} variant={isSelected ? "default" : "outline"}>
                            {isSelected ? "Selectat" : "Alege pentru zone"}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <RestaurantAnalyticsPanel analytics={restaurantAnalytics} isLoading={restaurantAnalyticsLoading} />

              <RestaurantZonesManager restaurant={selectedRestaurant} />
            </div>
          </TabsContent>

          {/* Program Tab */}
          <TabsContent value="program">
            <AdminScheduleView />
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

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/30 dark:border-yellow-900">
                  <p className="text-sm text-yellow-800 dark:text-yellow-100">
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
            <DialogDescription>
              Alege livratorul disponibil care preia comanda selectată.
            </DialogDescription>
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
            <DialogDescription>
              Completează comanda și selectează restaurantul pentru detectarea zonei corecte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Restaurant *</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setIsRestaurantPickerOpen((open) => !open)}
                  data-testid="new-order-restaurant-select"
                >
                  <span className="truncate">
                    {restaurants.find((restaurant) => restaurant.id === newOrder.restaurant_id)?.name || "Selectează"}
                  </span>
                  <Store className="h-4 w-4 text-muted-foreground" />
                </Button>
                {isRestaurantPickerOpen && (
                  <div className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-lg border bg-card p-2 shadow-sm" data-testid="new-order-restaurant-options">
                    {restaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${newOrder.restaurant_id === restaurant.id ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "hover:bg-muted/60"}`}
                        onClick={() => {
                          setNewOrder({
                            ...newOrder,
                            restaurant_id: restaurant.id,
                            delivery_zone_id: null,
                            delivery_zone_name: "",
                            delivery_sector: "",
                            delivery_zone_level: null,
                            delivery_fee: 0,
                            total_amount: Number(newOrder.subtotal_amount || 0),
                          });
                          setIsRestaurantPickerOpen(false);
                        }}
                        data-testid={`new-order-restaurant-option-${restaurant.id}`}
                      >
                        <span className="block font-medium">{restaurant.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{restaurant.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Sursă</Label>
                <Select value={newOrder.source} onValueChange={(v) => setNewOrder({...newOrder, source: v})}>
                  <SelectTrigger data-testid="new-order-source-select">
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
              <Input value={newOrder.customer_name} onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})} data-testid="new-order-customer-name-input" />
            </div>
            <div>
              <Label>Telefon Client *</Label>
              <Input value={newOrder.customer_phone} onChange={(e) => setNewOrder({...newOrder, customer_phone: e.target.value})} data-testid="new-order-customer-phone-input" />
            </div>
            <div>
              <Label>Adresă Livrare *</Label>
              <Input value={newOrder.customer_address} onChange={(e) => setNewOrder({...newOrder, customer_address: e.target.value})} data-testid="new-order-address-input" />
            </div>
            <div>
              <Label>Locație livrare pe hartă *</Label>
              <OrderLocationPicker value={newOrder} onChange={updateOrderLocation} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitudine</Label>
                <Input value={newOrder.customer_latitude ?? ""} readOnly data-testid="new-order-latitude" />
              </div>
              <div>
                <Label>Longitudine</Label>
                <Input value={newOrder.customer_longitude ?? ""} readOnly data-testid="new-order-longitude" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subtotal produse (RON) *</Label>
                <Input type="number" value={newOrder.subtotal_amount} onChange={(e) => {
                  const subtotal = parseFloat(e.target.value) || 0;
                  setNewOrder({
                    ...newOrder,
                    subtotal_amount: subtotal,
                    total_amount: Number((subtotal + (newOrder.delivery_fee || 0)).toFixed(2)),
                  });
                }} data-testid="new-order-subtotal-input" />
              </div>
              <div>
                <Label>Plată</Label>
                <Select value={newOrder.payment_type} onValueChange={(v) => setNewOrder({...newOrder, payment_type: v})}>
                  <SelectTrigger data-testid="new-order-payment-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Taxă livrare</Label>
                <Input value={newOrder.delivery_fee} readOnly data-testid="new-order-delivery-fee" />
              </div>
              <div>
                <Label>Zonă detectată</Label>
                <Input value={newOrder.delivery_zone_name || ""} readOnly data-testid="new-order-detected-zone" />
              </div>
              <div>
                <Label>Total final</Label>
                <Input value={newOrder.total_amount} readOnly data-testid="new-order-total-amount" />
              </div>
            </div>
            {newOrder.delivery_zone_name && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="new-order-zone-summary">
                <p><strong>Restaurant:</strong> {restaurants.find((rest) => rest.id === newOrder.restaurant_id)?.name || "-"}</p>
                <p><strong>Zonă:</strong> {newOrder.delivery_zone_name || "-"}</p>
                <p><strong>Taxă aplicată:</strong> {newOrder.delivery_fee} lei</p>
              </div>
            )}
            <div>
              <Label>Observații</Label>
              <Textarea value={newOrder.notes} onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})} data-testid="new-order-notes-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOrderDialogOpen(false)} data-testid="new-order-cancel-button">Anulează</Button>
            <Button onClick={createOrder} data-testid="new-order-submit-button">Creează Comandă</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Driver Dialog */}
      <Dialog open={isNewDriverDialogOpen} onOpenChange={setIsNewDriverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Livrator Nou</DialogTitle>
            <DialogDescription>
              Adaugă un livrator nou în platformă și generează contul lui de acces.
            </DialogDescription>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restaurant Nou</DialogTitle>
            <DialogDescription>
              Alege locația restaurantului, apoi vei putea desena zonele de livrare dedicate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label>Nume Restaurant *</Label>
              <Input
                value={newRestaurant.name}
                onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})}
                data-testid="new-restaurant-name-input"
              />
            </div>
            <div>
              <Label>Adresă / locație *</Label>
              <LocationAutocomplete
                value={newRestaurant.address}
                onChange={(address) => setNewRestaurant({...newRestaurant, address})}
                onSelect={(location) => {
                  setNewRestaurant((prev) => ({
                    ...prev,
                    address: location.label,
                    latitude: location.lat,
                    longitude: location.lng,
                    location_source: "nominatim",
                  }));
                }}
                placeholder="Caută restaurantul sau adresa în Bacău"
                testIdPrefix="new-restaurant-location"
              />
            </div>
            <RestaurantLocationPreview
              restaurant={newRestaurant}
              onLocationChange={(location) => setNewRestaurant((prev) => ({ ...prev, ...location }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitudine</Label>
                <Input value={newRestaurant.latitude || ""} readOnly data-testid="new-restaurant-latitude-input" />
              </div>
              <div>
                <Label>Longitudine</Label>
                <Input value={newRestaurant.longitude || ""} readOnly data-testid="new-restaurant-longitude-input" />
              </div>
            </div>
            <div>
              <Label>Telefon *</Label>
              <Input
                value={newRestaurant.phone}
                onChange={(e) => setNewRestaurant({...newRestaurant, phone: e.target.value})}
                data-testid="new-restaurant-phone-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Persoană contact</Label>
                <Input
                  value={newRestaurant.contact_name}
                  onChange={(e) => setNewRestaurant({...newRestaurant, contact_name: e.target.value})}
                  data-testid="new-restaurant-contact-name-input"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={newRestaurant.email}
                  onChange={(e) => setNewRestaurant({...newRestaurant, email: e.target.value})}
                  data-testid="new-restaurant-email-input"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Se va crea automat un cont pentru restaurant cu parola: restaurant123</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewRestaurantDialogOpen(false)} data-testid="new-restaurant-cancel-button">Anulează</Button>
            <Button onClick={createRestaurant} data-testid="new-restaurant-submit-button">Creează Restaurant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulation Dialog */}
      <Dialog open={isSimDialogOpen} onOpenChange={(open) => { if (!isSimRunning) setIsSimDialogOpen(open); else { simAbort.current = true; setIsSimRunning(false); setIsSimDialogOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" style={{ color: 'hsl(24 95% 53%)' }} />
              Simulare Flux Comandă
            </DialogTitle>
            <DialogDescription>
              Urmărește pașii unei comenzi demo de la creare până la livrare.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2" data-testid="simulation-steps">
            {simSteps.map((step, i) => (
              <div key={step.key} className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${
                step.status === "active" ? "bg-blue-50 border border-blue-200 scale-[1.02] dark:bg-blue-950/30 dark:border-blue-900" :
                step.status === "done" ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900" :
                "bg-muted/30 border border-transparent"
              }`}>
                <div className="shrink-0">
                  {step.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  {step.status === "active" && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                  {step.status === "pending" && <Circle className="w-5 h-5 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    step.status === "done" ? "text-green-700 dark:text-green-100" :
                    step.status === "active" ? "text-blue-700 dark:text-blue-100" :
                    "text-muted-foreground"
                  }`}>
                    {step.label}
                  </p>
                </div>
                <span className="text-xs shrink-0">
                  {step.status === "done" && <Badge className="bg-green-100 text-green-700 border-0 dark:bg-green-950/40 dark:text-green-100">OK</Badge>}
                  {step.status === "active" && <Badge className="bg-blue-100 text-blue-700 border-0 animate-pulse dark:bg-blue-950/40 dark:text-blue-100">...</Badge>}
                </span>
              </div>
            ))}
          </div>
          {!isSimRunning && simSteps.some(s => s.status === "done") && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSimDialogOpen(false)}>Închide</Button>
              <Button onClick={runSimulation} className="gap-2" style={{ background: 'hsl(24 95% 53%)', color: 'white' }}>
                <Play className="w-4 h-4" /> Rulează din nou
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
