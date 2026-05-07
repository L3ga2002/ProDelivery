import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { MapPin, Package, Phone, Store, Truck } from "lucide-react";
import { useMemo } from "react";
import {
  createMapMarkerIcon,
  DriverScooterIcon,
  getDriverMapStatus,
  RestaurantStorefrontIcon,
} from "./MapMarkerIcons";

const driverStatusMeta = {
  active: {
    label: "Disponibil",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900",
  },
  busy: {
    label: "Ocupat",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900",
  },
  offline: {
    label: "Offline",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800",
  },
};

const MapLegendIcon = ({ className, children }) => (
  <span className={`delivery-map-legend-icon ${className}`}>{children}</span>
);

const DriverPopup = ({ driver, position }) => {
  const status = getDriverMapStatus(driver);
  const meta = driverStatusMeta[status];

  return (
    <div className="min-w-[230px] text-sm" data-testid={`map-driver-popup-${driver.id}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-slate-950 p-2 text-white">
          <Truck className="h-5 w-5" />
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
          <MapPin className="h-3.5 w-3.5" />
          <span>{position[0].toFixed(4)}, {position[1].toFixed(4)}</span>
        </div>
        {driver.current_order_id && (
          <div className="flex items-center gap-2 text-blue-700">
            <Package className="h-3.5 w-3.5" />
            <span>Comandă în curs</span>
          </div>
        )}
      </div>
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

export const LiveMapPanel = ({ drivers, restaurants, driverPositions }) => {
  const mapCenter = useMemo(() => [46.567, 26.913], []);
  const driverMarkers = useMemo(() => drivers.map((driver) => {
    const pos = driverPositions[driver.id];
    const position = [pos?.lat || driver.latitude, pos?.lng || driver.longitude];
    const status = getDriverMapStatus(driver);
    return {
      driver,
      position,
      status,
      icon: createMapMarkerIcon({ kind: "driver", status, id: driver.id }),
    };
  }), [driverPositions, drivers]);
  const restaurantMarkers = useMemo(() => restaurants.map((restaurant) => ({
    restaurant,
    position: [restaurant.latitude, restaurant.longitude],
    icon: createMapMarkerIcon({ kind: "restaurant", id: restaurant.id }),
  })), [restaurants]);

  const statusCounts = useMemo(() => driverMarkers.reduce((counts, marker) => ({
    ...counts,
    [marker.status]: counts[marker.status] + 1,
  }), { active: 0, busy: 0, offline: 0 }), [driverMarkers]);

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
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{statusCounts.active} disponibili</Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{statusCounts.busy} ocupați</Badge>
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
            {driverMarkers.map(({ driver, icon, position }) => (
              <Marker
                key={driver.id}
                position={position}
                icon={icon}
              >
                <Popup>
                  <DriverPopup driver={driver} position={position} />
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
            <span>Livrator disponibil</span>
          </div>
          <div className="flex items-center gap-2">
            <MapLegendIcon className="delivery-map-legend-driver-busy"><DriverScooterIcon /></MapLegendIcon>
            <span>Livrator ocupat</span>
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