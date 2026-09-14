import { recordRequest } from './red-metrics'

export function trackRoute(
  route: string,
): (durationMs: number, isError: boolean) => void {
  return (durationMs: number, isError: boolean) => {
    recordRequest(route, durationMs, isError)
  }
}
