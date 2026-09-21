/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChangeTypeDialog } from '@/components/creator/mod-form/change-type-dialog'

afterEach(() => cleanup())

function renderDialog(props?: Partial<React.ComponentProps<typeof ChangeTypeDialog>>) {
  const onSave = jest.fn()
  const onOpenChange = jest.fn()
  const view = render(
    <ChangeTypeDialog open onOpenChange={onOpenChange} onSave={onSave} {...props} />,
  )
  return { onSave, onOpenChange, unmount: view.unmount }
}

describe('ChangeTypeDialog (shared: admin + creator)', () => {
  it('blocks save while title is empty', () => {
    renderDialog()
    const btn = screen.getByText('حفظ التغيير').closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('saves with default type edit + trimmed title/description', () => {
    const { onSave } = renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/إضافة دعم/), {
      target: { value: '  عنوان تجريبي  ' },
    })
    fireEvent.change(screen.getByPlaceholderText(/وصف مختصر/), {
      target: { value: ' وصف ' },
    })
    fireEvent.click(screen.getByText('حفظ التغيير'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      type: 'edit',
      title: 'عنوان تجريبي',
      description: 'وصف',
    })
  })

  it('switches change type before save', () => {
    const { onSave } = renderDialog()
    fireEvent.click(screen.getByText('تحديث'))
    fireEvent.change(screen.getByPlaceholderText(/إضافة دعم/), {
      target: { value: 'دعم منصة' },
    })
    fireEvent.click(screen.getByText('حفظ التغيير'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update', title: 'دعم منصة' }),
    )
  })

  it('cancel closes without saving; both buttons lock while saving', () => {
    const first = renderDialog()
    fireEvent.click(screen.getByText('إلغاء'))
    expect(first.onOpenChange).toHaveBeenCalledWith(false)
    expect(first.onSave).not.toHaveBeenCalled()
    first.unmount()

    renderDialog({ saving: true })
    const saveBtn = screen.getByText('جاري الحفظ...').closest('button') as HTMLButtonElement
    const cancelBtn = screen.getByText('إلغاء').closest('button') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
    expect(cancelBtn.disabled).toBe(true)
  })
})
