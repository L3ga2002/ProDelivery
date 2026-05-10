import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { Car, MapPin, Package, Phone, Route, Store, Truck } from "lucide-react";
import { useMemo } from "react";
import {
  createMapMarkerIcon,
  DriverCarIcon,
  DriverScooterIcon,
  getDriverMapStatus,
  RestaurantStorefrontIcon,
} from "./MapMarkerIcons";

const driverStatusMeta = {
  active: {
    label: "Activ",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900",
  },
  delivery: {
    label: "În livrare",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900",
  },
  break: {
    label: "În pauză",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900",
  },
  offline: {
    label: "Offline",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800",
  },
};

const MapLegendIcon = ({ className, children }) => (
  <span className={`delivery-map-legend-icon ${className}`}>{children}</span>
);

const DriverPopup = ({ driver, onAssignDriver }) => {
  const status = getDriverMapStatus(driver);
  const meta = driverStatusMeta[status];
  const vehicleLabel = driver.vehicle_type === "car" ? "Mașină" : "Scuter";

  return (
    <div className="min-w-[230px] text-sm" data-testid={`map-driver-popup-${driver.id}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-slate-950 p-2 text-white">
          {driver.vehicle_type === "car" ? <Car className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-950">{driver.name}</p>
          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
        </div>
      </div>
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Phone className="h-3.5 w-3.5" />
          <span>{driver.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          {driver.vehicle_type === "car" ? <Car className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
          <span>{vehicleLabel}</span>
        </div>
        {driver.current_order_id && (
          <div className="flex items-center gap-2 text-blue-700">
            <Package className="h-3.5 w-3.5" />
            <span>Comandă în curs</span>
          </div>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full bg-indigo-700 hover:bg-indigo-600"
        onClick={() => onAssignDriver?.(driver)}
        data-testid={`map-driver-assign-button-${driver.id}`}
      >
        Alocă comandă
      </Button>
    </div>
  );
};

const RestaurantPopup = ({ restaurant }) => (
  <div className="min-w-[230px] text-sm" data-testid={`map-restaurant-popup-${restaurant.id}`}>
    <div className="mb-3 flex items-start gap-3">
      <div className="rounded-lg bg-orange-600 p-2 text-white">
        <Store className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-950">{restaurant.name}</p>
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">Restaurant</Badge>
      </div>
    </div>
    <div className="space-y-2 rounded-lg bg-orange-50/70 p-3 text-slate-700">
      <p>{restaurant.address}</p>
      {restaurant.phone && <p className="font-mono text-xs">{restaurant.phone}</p>}
      <p className="text-xs text-slate-500">Coordonate: {restaurant.latitude?.toFixed?.(4)}, {restaurant.longitude?.toFixed?.(4)}</p>
    </div>
  </div>
);

export const LiveMapPanel = ({ drivers, restaurants, driverPositions, orders = [], onAssignDriver }) => {
  const mapCenter = useMemo(() => [46.567, 26.913], []);
  const relevantDrivers = useMemo(() => drivers.filter((driver) => (
    driver.current_order_id || driver.is_scheduled_today || driver.is_active
  )), [drivers]);
  const ordersById = useMemo(() => Object.fromEntries(orders.map((order) => [order.id, order])), [orders]);
  const restaurantsById = useMemo(() => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])), [restaurants]);
  const driverMarkers = useMemo(() => relevantDrivers.map((driver) => {
    const pos = driverPositions[driver.id];
    const position = [pos?.lat || driver.latitude, pos?.lng || driver.longitude];
    const status = getDriverMapStatus(driver);
    return {
      driver,
      position,
      status,
      icon: createMapMarkerIcon({ kind: "driver", status, id: driver.id, vehicleType: driver.vehicle_type }),
    };
  }), [driverPositions, relevantDrivers]);
  const restaurantMarkers = useMemo(() => restaurants.map((restaurant) => ({
    restaurant,
    position: [restaurant.latitude, restaurant.longitude],
    icon: createMapMarkerIcon({ kind: "restaurant", id: restaurant.id }),
  })), [restaurants]);

  const activeRoutes = useMemo(() => driverMarkers
    .map(({ driver, position }) => {
      const order = ordersById[driver.current_order_id];
      const restaurant = order ? restaurantsById[order.restaurant_id] : null;
      if (!order || !restaurant || !order.customer_latitude || !order.customer_longitude) return null;
      return {
        id: `${driver.id}-${order.id}`,
        driverToRestaurant: [position, [restaurant.latitude, restaurant.longitude]],
        restaurantToClient: [[restaurant.latitude, restaurant.longitude], [order.customer_latitude, order.customer_longitude]],
      };
    })
    .filter(Boolean), [driverMarkers, ordersById, restaurantsById]);

  const statusCounts = useMemo(() => driverMarkers.reduce((counts, marker) => ({
    ...counts,
    [marker.status]: counts[marker.status] + 1,
  }), { active: 0, delivery: 0, break: 0, offline: 0 }), [driverMarkers]);

  return (
    <Card className="control-surface overflow-hidden" data-testid="admin-live-map-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Hartă Live - Bacău
              <Badge variant="outline" className="ml-2 text-xs animate-pulse border-emerald-400 text-emerald-600 dark:border-emerald-700 dark:text-emerald-100">
                LIVE
              </Badge>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Marker-e 3D pentru livratori și restaurante, fără poligoane de zone pe harta principală.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{statusCounts.active} activi</Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{statusCounts.delivery} în livrare</Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{statusCounts.break} în pauză</Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{statusCounts.offline} offline</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] overflow-hidden rounded-lg border shadow-sm" data-testid="admin-live-map-container">
          <MapContainer center={mapCenter} zoom={14} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {activeRoutes.map((route) => (
              <Polyline
                key={route.id}
                positions={route.driverToRestaurant}
                pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.75, dashArray: "8 10", className: "delivery-route-line" }}
              />
            ))}
            {activeRoutes.map((route) => (
              <Polyline
                key={`${route.id}-client`}
                positions={route.restaurantToClient}
                pathOptions={{ color: "#f97316", weight: 3, opacity: 0.72, dashArray: "4 9", className: "delivery-route-line" }}
              />
            ))}
            {driverMarkers.map(({ driver, icon, position }) => (
              <Marker
                key={driver.id}
                position={position}
                icon={icon}
              >
                <Popup>
                  <DriverPopup driver={driver} onAssignDriver={onAssignDriver} />
                </Popup>
              </Marker>
            ))}
            {restaurantMarkers.map(({ restaurant, icon, position }) => (
              <Marker key={restaurant.id} position={position} icon={icon}>
                <Popup>
                  <RestaurantPopup restaurant={restaurant} />
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm" data-testid="admin-live-map-legend">
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-driver-active"><DriverScooterIcon /></MapLegendIcon>
            <span>Scuter activ</span>
          </div>
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-driver-active"><DriverCarIcon /></MapLegendIcon>
            <span>Mașină activă</span>
          </div>
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-driver-delivery"><DriverScooterIcon /></MapLegendIcon>
            <span>În livrare</span>
          </div>
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-blue-700" />
            <span>Traseu activ</span>
          </div>
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-driver-offline"><DriverScooterIcon /></MapLegendIcon>
            <span>Livrator offline</span>
          </div>
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-restaurant"><RestaurantStorefrontIcon /></MapLegendIcon>
            <span>Restaurant</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};