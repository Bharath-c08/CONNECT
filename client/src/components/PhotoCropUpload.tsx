'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, ZoomIn, ZoomOut, RotateCw, Check, X, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface PhotoCropUploadProps {
  currentPhoto?: string;
  onPhotoSaved?: (newPhotoUrl: string) => void;
  aspectRatio?: '1:1' | '3:4';
  userId?: string;
}

export default function PhotoCropUpload({
  currentPhoto = '',
  onPhotoSaved,
  aspectRatio = '3:4',
  userId
}: PhotoCropUploadProps) {
  const [selectedRatio, setSelectedRatio] = useState<'1:1' | '3:4'>(aspectRatio);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>(currentPhoto);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (currentPhoto) {
      setPreviewDataUrl(currentPhoto);
    }
  }, [currentPhoto]);

  // Handle file selection with validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    // Validation: Type check
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Invalid format. Please select a JPEG or PNG image.');
      return;
    }

    // Validation: Size limit 2MB (2 * 1024 * 1024)
    if (file.size > 2 * 1024 * 1024) {
      setError(`File exceeds maximum size of 2MB (Selected: ${(file.size / (1024 * 1024)).toFixed(2)}MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Render crop preview onto canvas
  useEffect(() => {
    if (!imageSrc || !isModalOpen) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
  }, [imageSrc, zoom, pan, rotation, selectedRatio, isModalOpen]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 360;
    const height = selectedRatio === '1:1' ? 360 : 480;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Center point
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate scale to fit canvas nicely
    const imgRatio = img.width / img.height;
    const targetRatio = width / height;
    let renderW = width;
    let renderH = height;

    if (imgRatio > targetRatio) {
      renderW = height * imgRatio;
    } else {
      renderH = width / imgRatio;
    }

    ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Save cropped photo
  const handleSaveCrop = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError('');

    try {
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92);

      await apiRequest('/users/profile-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo: croppedBase64,
          userId
        })
      });

      setPreviewDataUrl(croppedBase64);
      setIsModalOpen(false);
      setImageSrc(null);
      if (onPhotoSaved) {
        onPhotoSaved(croppedBase64);
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Photo Preview Zone */}
      <div className="flex items-center gap-5">
        <div
          className="relative group rounded-xl overflow-hidden border-2 bg-zinc-900 flex items-center justify-center shrink-0 shadow-lg cursor-pointer"
          style={{
            width: selectedRatio === '1:1' ? '120px' : '105px',
            height: '140px',
            borderColor: previewDataUrl ? 'var(--brand)' : 'var(--border)'
          }}
          onClick={() => fileInputRef.current?.click()}
          title="Click to upload/change passport photo"
        >
          {previewDataUrl ? (
            <img
              src={previewDataUrl}
              alt="Passport Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 p-2 text-center">
              <Camera className="w-8 h-8 opacity-60" />
              <span className="text-[9px] uppercase tracking-wider font-extrabold">NO PHOTO</span>
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-cyan-400">
            <Upload className="w-5 h-5 animate-bounce" />
            <span className="text-[8px] font-bold uppercase tracking-wider">CHANGE PHOTO</span>
          </div>

          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[7px] text-cyan-400 font-bold border border-white/10 uppercase">
            {selectedRatio}
          </div>
        </div>

        {/* Upload Controls & Format Guidelines */}
        <div className="flex flex-col justify-center gap-2 text-[10px]">
          <div>
            <span className="text-white font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span>PASSPORT IDENTIFICATION PHOTO</span>
              {previewDataUrl && <span className="text-emerald-400 text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">VERIFIED</span>}
            </span>
            <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
              Standard format: High-contrast frontal portrait against a neutral backdrop. JPEG or PNG, max 2MB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary h-8 px-3 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Passport Photo</span>
            </button>

            <div className="flex rounded border border-white/10 overflow-hidden text-[9px]">
              <button
                type="button"
                onClick={() => setSelectedRatio('3:4')}
                className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                  selectedRatio === '3:4' ? 'bg-cyan-500/20 text-cyan-400 font-extrabold' : 'bg-zinc-900 text-slate-400'
                }`}
              >
                3:4 Portrait
              </button>
              <button
                type="button"
                onClick={() => setSelectedRatio('1:1')}
                className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                  selectedRatio === '1:1' ? 'bg-cyan-500/20 text-cyan-400 font-extrabold' : 'bg-zinc-900 text-slate-400'
                }`}
              >
                1:1 Square
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[9px] mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Interactive Crop & Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-lg p-5 rounded-2xl border flex flex-col gap-4 shadow-2xl relative"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--brand)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  // PASSPORT_PHOTO_CROPPER [{selectedRatio}]
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Preview Area with Dragging */}
            <div className="flex flex-col items-center justify-center bg-zinc-950 p-4 rounded-xl border border-white/5 relative select-none overflow-hidden">
              <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-2">
                Click & Drag image inside frame to align face centered
              </p>
              <div
                className="relative rounded-lg overflow-hidden border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] cursor-grab active:cursor-grabbing"
                style={{
                  width: selectedRatio === '1:1' ? '260px' : '220px',
                  height: '260px'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas ref={canvasRef} className="w-full h-full block" />
                {/* Rule of thirds alignment grid overlay */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20 opacity-30">
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                </div>
              </div>
            </div>

            {/* Controls Toolbar: Zoom, Rotate, Ratio */}
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="flex items-center gap-2 bg-zinc-900/60 p-2 rounded-lg border border-white/5">
                <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
                <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[9px] text-slate-300 w-8 text-right font-mono">{zoom.toFixed(1)}x</span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-zinc-900/60 p-2 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1.5 cursor-pointer text-[9px] uppercase font-bold"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotate 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setRotation(0);
                  }}
                  className="px-2 py-1 text-[9px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={loading}
                className="btn btn-primary px-5 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Apply & Save Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
