import { type EmailTemplateData, generateEmailWrapper } from '../email-base'

describe('generateEmailWrapper', () => {
  const baseData: EmailTemplateData = {
    title: 'Test Title',
    body: '<p>Test body content</p>',
  }

  it('should produce valid HTML with doctype', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('</html>')
  })

  it('should include RTL direction', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('dir="rtl"')
  })

  it('should include the title in the head', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('<title>Test Title</title>')
  })

  it('should include the body content', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('<p>Test body content</p>')
  })

  it('should include the platform header', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('منصة تعريب الألعاب')
  })

  it('should include a footer with unsubscribe notice', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).toContain('تعديل تفضيلاتك من إعدادات حسابك')
  })

  it('should render action button when actionUrl is provided', () => {
    const data: EmailTemplateData = {
      ...baseData,
      actionUrl: 'https://example.com/action',
      actionLabel: 'اضغط هنا',
    }
    const html = generateEmailWrapper(data)
    expect(html).toContain('https://example.com/action')
    expect(html).toContain('اضغط هنا')
  })

  it('should use default label when actionUrl provided without actionLabel', () => {
    const data: EmailTemplateData = {
      ...baseData,
      actionUrl: 'https://example.com/action',
    }
    const html = generateEmailWrapper(data)
    expect(html).toContain('عرض التفاصيل')
  })

  it('should not render action button when actionUrl is absent', () => {
    const html = generateEmailWrapper(baseData)
    expect(html).not.toContain('<a href=')
  })

  it('should escape HTML in title to prevent XSS', () => {
    const data: EmailTemplateData = {
      title: '<script>alert("xss")</script>',
      body: '<p>safe</p>',
    }
    const html = generateEmailWrapper(data)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should escape HTML in actionUrl to prevent XSS', () => {
    const data: EmailTemplateData = {
      ...baseData,
      actionUrl: 'javascript:alert(1)',
    }
    const html = generateEmailWrapper(data)
    expect(html).not.toContain('javascript:alert(1)')
  })
})
