import { ResendEmailSender } from '../adapters/resend-email-sender'

describe('ResendEmailSender', () => {
  const mockSend = jest.fn()
  const mockResendClient = { emails: { send: mockSend } }
  const testOptions = {
    retryOptions: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0 },
  }

  beforeEach(() => {
    mockSend.mockClear()
  })

  it('should send email successfully', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' } })

    const sender = new ResendEmailSender(mockResendClient as any, undefined, testOptions)
    const result = await sender.send('test@example.com', 'Subject', '<p>Hello</p>')

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('msg-123')
    expect(mockSend).toHaveBeenCalledWith({
      from: expect.any(String),
      to: ['test@example.com'],
      subject: 'Subject',
      html: '<p>Hello</p>',
    })
  })

  it('should not throw on send failure', async () => {
    mockSend.mockRejectedValue(new Error('API error'))

    const sender = new ResendEmailSender(mockResendClient as any, undefined, testOptions)
    const result = await sender.send('test@example.com', 'Subject', '<p>Hello</p>')

    expect(result.success).toBe(false)
    expect(result.error).toBe('API error')
  })

  it('should handle API error response', async () => {
    mockSend.mockResolvedValue({ error: { message: 'Invalid email' } })

    const sender = new ResendEmailSender(mockResendClient as any, undefined, testOptions)
    const result = await sender.send('invalid-email', 'Subject', '<p>Hello</p>')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid email')
  })

  it('should report circuit state', async () => {
    const sender = new ResendEmailSender(mockResendClient as any, undefined, testOptions)
    expect(sender.getCircuitState()).toBe('CLOSED')
  })

  it('should reset circuit', async () => {
    mockSend.mockRejectedValue(new Error('fail'))

    const sender = new ResendEmailSender(mockResendClient as any, undefined, testOptions)

    for (let i = 0; i < 5; i++) {
      await sender.send('test@example.com', 'Subject', '<p>Hello</p>')
    }

    sender.resetCircuit()
    expect(sender.getCircuitState()).toBe('CLOSED')
  })
})
