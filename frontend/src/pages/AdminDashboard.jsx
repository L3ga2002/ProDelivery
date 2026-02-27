import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom driver icon
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

const getStatusBadge = (status) => {
  const statusConfig = {
    NEW: { label: "Nouă", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    ASSIGNED: { label: "Alocată", className: "bg-blue-100 text-blue-800 border-blue-300" },
    ACCEPTED: { label: "Acceptată", className: "bg-purple-100 text-purple-800 border-purple-300" },
    PICKED_UP: { label: "Ridicată", className: "bg-orange-100 text-orange-800 border-orange-300" },
    DELIVERED: { label: "Livrată", className: "bg-green-100 text-green-800 border-green-300" },
  };
  
  const config = statusConfig[status] || { label: status, className: "" };
  return <Badge className={`${config.className} border`}>{config.label}</Badge>;
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, driversRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders`),
        axios.get(`${API_URL}/api/drivers`),
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
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
      await axios.put(`${API_URL}/api/orders/${selectedOrder.id}/assign`, {
        driver_id: selectedDriver,
      });
      toast.success("Comandă alocată cu succes!");
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Eroare la alocare");
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
          
          <div className="flex items-center gap-4">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card data-testid="stat-active-orders">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Comenzi Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-orders">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Total Comenzi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-active-drivers">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeDrivers.length}</p>
                  <p className="text-xs text-muted-foreground">Livratori Activi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-drivers">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{drivers.length}</p>
                  <p className="text-xs text-muted-foreground">Total Livratori</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <Card className="lg:row-span-2" data-testid="map-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5" />
                Hartă Livratori
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] lg:h-[500px] rounded-lg overflow-hidden border">
                <MapContainer
                  center={[44.4268, 26.1025]}
                  zoom={13}
                  className="h-full w-full"
                >
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
                          <p className="text-muted-foreground">{driver.phone}</p>
                          <Badge className={driver.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {driver.is_active ? "Activ" : "Inactiv"}
                          </Badge>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              
              {/* Driver Legend */}
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${driver.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className={driver.is_active ? 'font-medium' : 'text-muted-foreground'}>
                      {driver.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card data-testid="orders-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5" />
                Comenzi ({activeOrders.length} active)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Nr.</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Sumă</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nu există comenzi active
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeOrders.map((order) => (
                        <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                          <TableCell className="font-mono text-xs">
                            {order.order_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{order.customer_name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {order.customer_address}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{order.total_amount} RON</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {order.payment_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                            {order.status === "NEW" ? (
                              <Button
                                size="sm"
                                onClick={() => handleAssignOrder(order)}
                                data-testid={`assign-button-${order.id}`}
                              >
                                Alocă
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {order.driver_name || "-"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Drivers List */}
          <Card data-testid="drivers-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Livratori
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      driver.is_active ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                    }`}
                    data-testid={`driver-item-${driver.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        driver.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{driver.phone}</p>
                      </div>
                    </div>
                    <Badge className={driver.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {driver.is_active ? 'Activ' : 'Inactiv'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Assign Order Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent data-testid="assign-dialog">
          <DialogHeader>
            <DialogTitle>Alocă Comandă</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-mono text-sm mb-2">{selectedOrder.order_number}</p>
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_address}</p>
                <p className="font-semibold mt-2">{selectedOrder.total_amount} RON ({selectedOrder.payment_type})</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Selectează Livrator</label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger data-testid="driver-select">
                    <SelectValue placeholder="Alege un livrator disponibil" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Niciun livrator disponibil
                      </SelectItem>
                    ) : (
                      availableDrivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} - {driver.phone}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Anulează
            </Button>
            <Button onClick={confirmAssign} disabled={!selectedDriver} data-testid="confirm-assign-button">
              Alocă Comanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
