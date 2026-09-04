import EditGameContent from './edit-game-content'

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditGameContent id={id} />
}
