export function cleanNpcReply(reply: string) {
  return reply.replace(/```[\s\S]*?```/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^[-*]\s+/gm, '').trim()
}
