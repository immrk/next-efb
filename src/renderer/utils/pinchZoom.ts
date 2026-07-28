export interface PinchPoint {
  clientX: number
  clientY: number
}

export interface PinchCenter {
  clientX: number
  clientY: number
}

export function getPinchDistance(first: PinchPoint, second: PinchPoint): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

export function getPinchCenter(first: PinchPoint, second: PinchPoint): PinchCenter {
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2
  }
}

export function clampZoom(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculatePinchZoom(options: {
  startZoom: number
  startDistance: number
  currentDistance: number
  minimum: number
  maximum: number
}): number {
  const {
    startZoom,
    startDistance,
    currentDistance,
    minimum,
    maximum
  } = options

  if (startDistance <= 0 || currentDistance <= 0) {
    return clampZoom(startZoom, minimum, maximum)
  }

  return clampZoom(
    startZoom * (currentDistance / startDistance),
    minimum,
    maximum
  )
}
