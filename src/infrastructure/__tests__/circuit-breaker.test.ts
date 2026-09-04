import { CircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker'

describe('CircuitBreaker', () => {
  let circuit: CircuitBreaker
  const onStateChange = jest.fn()

  beforeEach(() => {
    onStateChange.mockClear()
    circuit = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      halfOpenMaxAttempts: 2,
      onStateChange,
    })
  })

  describe('CLOSED state', () => {
    it('should start in CLOSED state', () => {
      expect(circuit.currentState).toBe('CLOSED')
    })

    it('should execute operation successfully', async () => {
      const result = await circuit.execute(async () => 'ok')
      expect(result).toBe('ok')
    })

    it('should increment failure count on error', async () => {
      await expect(
        circuit.execute(async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow('fail')

      expect(circuit.currentState).toBe('CLOSED')
    })

    it('should transition to OPEN after threshold', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      expect(circuit.currentState).toBe('OPEN')
      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN')
    })
  })

  describe('OPEN state', () => {
    it('should reject operations when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await expect(circuit.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError)
    })

    it('should transition to HALF_OPEN after resetTimeoutMs', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      const result = await circuit.execute(async () => 'ok')
      expect(result).toBe('ok')
      expect(circuit.currentState).toBe('HALF_OPEN')
      expect(onStateChange).toHaveBeenCalledWith('OPEN', 'HALF_OPEN')
    })
  })

  describe('HALF_OPEN state', () => {
    it('should transition to CLOSED after successful attempts', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      await circuit.execute(async () => 'ok1')
      await circuit.execute(async () => 'ok2')

      expect(circuit.currentState).toBe('CLOSED')
      expect(onStateChange).toHaveBeenCalledWith('HALF_OPEN', 'CLOSED')
    })

    it('should transition to OPEN on failure', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      await expect(
        circuit.execute(async () => {
          throw new Error('fail again')
        }),
      ).rejects.toThrow()

      expect(circuit.currentState).toBe('OPEN')
    })
  })

  describe('reset', () => {
    it('should reset to CLOSED state', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      circuit.reset()
      expect(circuit.currentState).toBe('CLOSED')
    })
  })

  describe('isOpen', () => {
    it('should return false when CLOSED', () => {
      expect(circuit.isOpen).toBe(false)
    })

    it('should return true when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      expect(circuit.isOpen).toBe(true)
    })
  })
})
