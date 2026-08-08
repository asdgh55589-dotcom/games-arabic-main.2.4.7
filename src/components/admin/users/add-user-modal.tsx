'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddUserModalProps {
  onClose: () => void
  onSubmit: (data: { username: string; email: string; password: string; role: string }) => void
}

export function AddUserModal({ onClose, onSubmit }: AddUserModalProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')

  const handleSubmit = () => {
    onSubmit({ username, email, password, role })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <h3 className="text-sm font-bold">إضافة مستخدم جديد</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>اسم المستخدم</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label>البريد الإلكتروني</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>كلمة المرور</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label>الدور</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="member">عضو</option>
            <option value="moderator">مشرف</option>
            <option value="admin">مدير</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSubmit}>إنشاء</Button>
      </div>
    </div>
  )
}
