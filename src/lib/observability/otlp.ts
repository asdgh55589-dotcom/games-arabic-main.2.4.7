import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { logger } from '@/lib/logger'

let loggerProvider: LoggerProvider | null = null
let meterProvider: MeterProvider | null = null

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  const headers: Record<string, string> = {}
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
  }
  return headers
}

export function initOtlp(): void {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return
  try {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT!
    const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)

    const logExporter = new OTLPLogExporter({ url: endpoint, headers })
    loggerProvider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
    })

    const metricExporter = new OTLPMetricExporter({ url: endpoint, headers })
    meterProvider = new MeterProvider({
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 60_000,
        }),
      ],
    })

    logger.info('[otlp] exporters initialized', { endpoint })
  } catch (err) {
    logger.warn('[otlp] init failed (fail-open)', {
      reason: err instanceof Error ? err.message : String(err),
    })
  }
}

export function getLoggerProvider(): LoggerProvider | null {
  return loggerProvider
}

export function getMeterProvider(): MeterProvider | null {
  return meterProvider
}

export async function shutdownOtlp(): Promise<void> {
  try {
    if (loggerProvider) {
      await loggerProvider.shutdown()
      loggerProvider = null
    }
    if (meterProvider) {
      await meterProvider.shutdown()
      meterProvider = null
    }
  } catch {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort operation
    // fail-open: telemetry must never throw
  }
}
