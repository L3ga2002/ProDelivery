import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export const AvatarUploadCropper = ({ onUpload, isUploading = false, testIdPrefix = "avatar-upload" }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fileName, setFileName] = useState("avatar.webp");
  const imageRef = useRef(null);

  const previewTransform = useMemo(() => ({
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
  }), [offsetX, offsetY, zoom]);

  const loadFile = (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      window.alert("Poza depășește limita de 4 MB.");
      return;
    }
    setFileName(file.name || "avatar.webp");
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const resetCrop = () => {
    setZoom(1.15);
    setOffsetX(0);
    setOffsetY(0);
  };

  const buildCroppedBlob = useCallback(() => new Promise((resolve, reject) => {
    const img = imageRef.current;
    if (!img) {
      reject(new Error("Imaginea nu este încărcată"));
      return;
    }
    const canvas = document.createElement("canvas");
    const size = 640;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, size, size);
    const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const drawWidth = img.naturalWidth * baseScale * zoom;
    const drawHeight = img.naturalHeight * baseScale * zoom;
    const drawX = (size - drawWidth) / 2 + offsetX * (size / 220);
    const drawY = (size - drawHeight) / 2 + offsetY * (size / 220);
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Nu am putut pregăti poza"));
      else resolve(blob);
    }, "image/webp", 0.86);
  }), [offsetX, offsetY, zoom]);

  const submit = async () => {
    const blob = await buildCroppedBlob();
    await onUpload?.(blob, fileName.replace(/\.[^.]+$/, ".webp"));
    setImageSrc(null);
    resetCrop();
  };

  return (
    <div className="space-y-4" data-testid={`${testIdPrefix}-cropper`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="cursor-pointer rounded-lg border border-dashed border-orange-300 bg-orange-50 px-3 py-2 text-center text-sm font-semibold text-orange-800 transition-colors hover:bg-orange-100" data-testid={`${testIdPrefix}-gallery-label`}>
          <ImagePlus className="mr-2 inline h-4 w-4" /> Din galerie
          <Input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadFile(event.target.files?.[0])} data-testid={`${testIdPrefix}-gallery-input`} />
        </Label>
        <Label className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" data-testid={`${testIdPrefix}-camera-label`}>
          <Camera className="mr-2 inline h-4 w-4" /> Selfie
          <Input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => loadFile(event.target.files?.[0])} data-testid={`${testIdPrefix}-camera-input`} />
        </Label>
      </div>

      {imageSrc && (
        <div className="rounded-lg border bg-muted/30 p-3" data-testid={`${testIdPrefix}-editor`}>
          <div className="mx-auto h-[220px] w-[220px] overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-inner" data-testid={`${testIdPrefix}-preview`}>
            <img ref={imageRef} src={imageSrc} alt="Preview avatar" className="h-full w-full object-cover transition-transform duration-150" style={previewTransform} />
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <Label>Zoom</Label>
              <Input type="range" min="1" max="2.4" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} data-testid={`${testIdPrefix}-zoom-slider`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stânga / dreapta</Label>
                <Input type="range" min="-90" max="90" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} data-testid={`${testIdPrefix}-x-slider`} />
              </div>
              <div>
                <Label>Sus / jos</Label>
                <Input type="range" min="-90" max="90" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} data-testid={`${testIdPrefix}-y-slider`} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetCrop} data-testid={`${testIdPrefix}-reset-button`}>
                <RotateCcw className="mr-2 h-4 w-4" /> Resetează crop
              </Button>
              <Button type="button" onClick={submit} disabled={isUploading} className="bg-orange-600 hover:bg-orange-700" data-testid={`${testIdPrefix}-submit-button`}>
                <Upload className="mr-2 h-4 w-4" /> {isUploading ? "Se încarcă..." : "Folosește poza"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};