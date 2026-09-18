'use client'

import { RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'

interface Area {
  x: number
  y: number
  width: number
  height: number
}

interface ImageCropperProps {
  image: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropComplete: (croppedImage: string, croppedAreaPixels: Area) => void
  aspectRatio?: number
  title?: string
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return canvas.toDataURL('image/jpeg', 0.92)
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

export function ImageCropper({
  image,
  open,
  onOpenChange,
  onCropComplete,
  aspectRatio = 16 / 9,
  title = 'قص الصورة',
}: ImageCropperProps) {
  const { toast } = useToast()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropCompleteCallback = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const cropped = await getCroppedImg(image, croppedAreaPixels)
      onCropComplete(cropped, croppedAreaPixels)
      onOpenChange(false)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
    } catch (e) {
      console.error('Crop failed:', e)
      toast({ title: 'فشل قص الصورة، حاول مرة أخرى', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl" aria-describedby="cropper-description">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="cropper-description">
            اضبط القص بالتكبير والسحب ثم احفظ.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-96 w-full overflow-hidden rounded-lg bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropCompleteCallback}
            objectFit="contain"
            showGrid
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-10 text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => setRotation(v)}
              className="flex-1"
            />
            <span className="min-w-10 text-xs text-muted-foreground">{rotation}°</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? 'جاري الحفظ...' : 'حفظ القص'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
