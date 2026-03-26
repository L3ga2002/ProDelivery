import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import {
  MapPinned,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Layers,
  MousePointerClick,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ZONE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

function DrawControl({ onPolygonCreated, isDrawing, setIsDrawing }) {
  const map = useMap();
  const drawLayerRef = useRef(null);
  const pointsRef = useRef([]);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);

  const cleanup = useCallback(() => {
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    pointsRef.current = [];
  }, [map]);

  useEffect(() => {
    if (!isDrawing) {
      cleanup();
    }
  }, [isDrawing, cleanup]);

  useMapEvents({
    click(e) {
      if (!isDrawing) return;

      const { lat, lng } = e.latlng;
      pointsRef.current.push([lat, lng]);

      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }).addTo(map);
      markersRef.current.push(marker);

      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
      }
      if (pointsRef.current.length > 1) {
        polylineRef.current = L.polyline(pointsRef.current, {
          color: "#3b82f6",
          weight: 2,
          dashArray: "5,10",
        }).addTo(map);
      }
    },
    dblclick(e) {
      if (!isDrawing) return;
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);

      if (pointsRef.current.length >= 3) {
        const coords = pointsRef.current.map(([lat, lng]) => ({ lat, lng }));
        onPolygonCreated(coords);
      } else {
        toast.error("Minim 3 puncte pentru o zonă");
      }
      cleanup();
      setIsDrawing(false);
    },
  });

  return null;
}

function ZonePolygons({ zones, selectedZoneId, onZoneClick }) {
  return (
    <>
      {zones
        .filter((z) => z.is_active)
        .map((zone) => {
          const positions = zone.polygon.map((p) => [p.lat, p.lng]);
          if (positions.length < 3) return null;
          const isSelected = zone.id === selectedZoneId;
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: isSelected ? 0.35 : 0.15,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{ click: () => onZoneClick && onZoneClick(zone) }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{zone.name}</p>
                  <p>Taxă livrare: {zone.fee} RON</p>
                </div>
              </Popup>
            </Polygon>
          );
        })}
    </>
  );
}

export function DeliveryZonesManager() {
  const [zones, setZones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    color: "#3388ff",
    fee: 5,
    is_active: true,
  });
  const [newPolygon, setNewPolygon] = useState(null);

  const fetchZones = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/zones`);
      setZones(res.data);
    } catch {
      toast.error("Eroare la încărcarea zonelor");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const handlePolygonCreated = (coords) => {
    setNewPolygon(coords);
    setEditForm({
      name: `Zona ${zones.length + 1}`,
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      fee: 5,
      is_active: true,
    });
    setSelectedZone(null);
    setEditDialog(true);
  };

  const handleSaveZone = async () => {
    if (!editForm.name.trim()) {
      toast.error("Numele zonei este obligatoriu");
      return;
    }

    try {
      if (selectedZone) {
        await axios.put(`${API_URL}/api/zones/${selectedZone.id}`, {
          name: editForm.name,
          color: editForm.color,
          fee: editForm.fee,
          is_active: editForm.is_active,
          polygon: newPolygon || selectedZone.polygon,
        });
        toast.success("Zona a fost actualizată");
      } else {
        if (!newPolygon || newPolygon.length < 3) {
          toast.error("Desenează o zonă pe hartă mai întâi");
          return;
        }
        await axios.post(`${API_URL}/api/zones`, {
          name: editForm.name,
          color: editForm.color,
          fee: editForm.fee,
          polygon: newPolygon,
          is_active: editForm.is_active,
          sort_order: zones.length + 1,
        });
        toast.success("Zona a fost creată");
      }
      setEditDialog(false);
      setNewPolygon(null);
      setSelectedZone(null);
      fetchZones();
    } catch {
      toast.error("Eroare la salvarea zonei");
    }
  };

  const handleEditZone = (zone) => {
    setSelectedZone(zone);
    setEditForm({
      name: zone.name,
      color: zone.color,
      fee: zone.fee,
      is_active: zone.is_active,
    });
    setNewPolygon(null);
    setEditDialog(true);
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await axios.delete(`${API_URL}/api/zones/${zoneId}`);
      toast.success("Zona a fost ștearsă");
      if (selectedZone?.id === zoneId) setSelectedZone(null);
      fetchZones();
    } catch {
      toast.error("Eroare la ștergerea zonei");
    }
  };

  const handleZoneClick = (zone) => {
    setSelectedZone(zone);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="delivery-zones-manager">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPinned className="w-5 h-5" />
              Zone de Livrare - Bacău
            </CardTitle>
            <div className="flex gap-2">
              {isDrawing ? (
                <>
                  <Badge
                    variant="outline"
                    className="animate-pulse border-blue-400 text-blue-600 px-3 py-1"
                  >
                    <MousePointerClick className="w-3 h-3 mr-1" />
                    Click pe hartă pentru puncte, dublu-click pentru finalizare
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDrawing(false)}
                    data-testid="cancel-draw-btn"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Anulează
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsDrawing(true)}
                  className="gap-1"
                  data-testid="draw-zone-btn"
                >
                  <Plus className="w-4 h-4" />
                  Zonă Nouă
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Desenează poligoane pe hartă pentru a defini zonele de livrare și
            tarifele asociate
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Map */}
            <div className="lg:col-span-2">
              <div
                className="h-[500px] rounded-lg overflow-hidden border"
                data-testid="zones-map"
              >
                <MapContainer
                  center={[46.567, 26.913]}
                  zoom={14}
                  className="h-full w-full"
                  doubleClickZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ZonePolygons
                    zones={zones}
                    selectedZoneId={selectedZone?.id}
                    onZoneClick={handleZoneClick}
                  />
                  <DrawControl
                    onPolygonCreated={handlePolygonCreated}
                    isDrawing={isDrawing}
                    setIsDrawing={setIsDrawing}
                  />
                </MapContainer>
              </div>
            </div>

            {/* Zone List */}
            <div className="space-y-3" data-testid="zones-list">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Zone ({zones.length})
                </span>
              </div>

              {zones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MapPinned className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Nicio zonă definită</p>
                  <p className="text-xs mt-1">
                    Apasă "Zonă Nouă" și desenează pe hartă
                  </p>
                </div>
              ) : (
                zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedZone?.id === zone.id
                        ? "ring-2 ring-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    } ${!zone.is_active ? "opacity-50" : ""}`}
                    onClick={() => handleZoneClick(zone)}
                    data-testid={`zone-card-${zone.id}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 border"
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="font-semibold text-sm flex-1 truncate">
                        {zone.name}
                      </span>
                      {!zone.is_active && (
                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono"
                        style={{
                          borderColor: zone.color,
                          color: zone.color,
                        }}
                      >
                        {zone.fee} RON
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditZone(zone);
                          }}
                          data-testid={`edit-zone-${zone.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          data-testid={`delete-zone-${zone.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Zone Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedZone ? "Editează Zona" : "Zonă Nouă"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume Zonă *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="ex: Zona 1 - Centru"
                data-testid="zone-name-input"
              />
            </div>
            <div>
              <Label>Taxă Livrare (RON) *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={editForm.fee}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    fee: parseFloat(e.target.value) || 0,
                  })
                }
                data-testid="zone-fee-input"
              />
            </div>
            <div>
              <Label>Culoare</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      editForm.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditForm({ ...editForm, color: c })}
                    data-testid={`color-${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Zonă Activă</Label>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(v) =>
                  setEditForm({ ...editForm, is_active: v })
                }
                data-testid="zone-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialog(false);
                setNewPolygon(null);
              }}
            >
              Anulează
            </Button>
            <Button onClick={handleSaveZone} data-testid="save-zone-btn">
              <Save className="w-4 h-4 mr-1" />
              {selectedZone ? "Salvează" : "Creează Zona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { ZonePolygons };
