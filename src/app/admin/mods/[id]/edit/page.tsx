import ModForm from '@/components/admin/mod-form'

export default async function EditModPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ModForm modId={id} />
}
