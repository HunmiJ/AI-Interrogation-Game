const presentationPatterns: Record<string, RegExp[]> = {
  'supplier-call-record': [
    /运营商(?:记录|详单)/,
    /(?:通话记录|通话详单).*(?:没有|不存在|无)(?:任何)?(?:呼出|接听|通话)/,
    /22:31.*(?:没有|不存在|无).*(?:通话|呼出|接听)/,
  ],
  'memory-card-photo': [
    /23:09.*(?:照片|原片|相机|倒影|募款箱)/,
    /(?:照片|原片|相机|倒影).*(?:办公室门口|募款箱)/,
  ],
  'alarm-log': [/(?:23:07|一次正确).*(?:警报|密码)/, /警报记录/],
  'camera-metadata': [/(?:23:12|Wi-?Fi).*(?:相机|元数据|连接)/i, /相机(?:定位|连接)元数据/],
}

export function detectPresentedEvidenceIds(message: string, discoveredEvidenceIds: string[]) {
  const discovered = new Set(discoveredEvidenceIds)
  return Object.entries(presentationPatterns)
    .filter(([id, patterns]) => discovered.has(id) && patterns.some((pattern) => pattern.test(message)))
    .map(([id]) => id)
}
