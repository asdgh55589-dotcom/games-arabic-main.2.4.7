/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamGhostMemberModal } from '@/components/creator/team-ghost-member-modal'

describe('TeamGhostMemberModal', () => {
  it('renders all fields', () => {
    render(<TeamGhostMemberModal open={true} onOpenChange={() => {}} onSave={async () => {}} />)
    expect(screen.getByText('إضافة عضو ضيف')).toBeInTheDocument()
  })

  it('shows validation error when name empty', async () => {
    const onSave = jest.fn()
    render(<TeamGhostMemberModal open={true} onOpenChange={() => {}} onSave={onSave} />)
    const btn = screen.getByText('إضافة')
    fireEvent.click(btn)
    expect(screen.getByText('الاسم مطلوب')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows email validation error', async () => {
    const onSave = jest.fn()
    render(<TeamGhostMemberModal open={true} onOpenChange={() => {}} onSave={onSave} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Ghost' } })
    fireEvent.change(inputs[1], { target: { value: 'bad-email' } })
    const btn = screen.getByText('إضافة')
    fireEvent.click(btn)
    expect(screen.getByText('البريد الإلكتروني غير صالح')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with valid data', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    render(<TeamGhostMemberModal open={true} onOpenChange={() => {}} onSave={onSave} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Ghost User' } })
    const btn = screen.getByText('إضافة')
    fireEvent.click(btn)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ghost User', role: 'member' }))
  })

  it('does not render when closed', () => {
    render(<TeamGhostMemberModal open={false} onOpenChange={() => {}} onSave={async () => {}} />)
    expect(screen.queryByText('إضافة عضو ضيف')).not.toBeInTheDocument()
  })
})
