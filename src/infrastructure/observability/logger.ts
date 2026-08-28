/**
 * NotificationLogger — مسجل الإشعارات المهيكل
 * Structured JSON logger for the notification system.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  userId?: string
  notificationId?: string
  notificationType?: string
  channel?: string
  action?: string
  [key: string]: unknown
}

export class NotificationLogger {
  constructor(private readonly serviceName: string = 'notification-system') {}

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context,
    }

    const output = JSON.stringify(entry)

    switch (level) {
      case 'debug':
        console.debug(output)
        break
      case 'info':
        console.info(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'error':
        console.error(output)
        break
    }
  }
}

export const notificationLogger = new NotificationLogger()
