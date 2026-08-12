import type { DialogueOption } from '../types/game'

export const dialogueOptions: DialogueOption[] = [
  {
    id: 'jack-leaving-time', npcId: 'jack', question: '你确定 22:45 就离开了吗？',
    response: '……我离开了前厅。二楼还有几张长曝光没拍完，我不想让 Tom 又拿“场地费”压我的尾款，所以没说。23:18 左右，我从侧梯走的。',
    tone: 'evasive', unlockEvidenceId: 'camera-metadata', revealFactIds: ['jack_stayed_after_event', 'jack_went_upstairs'], contradictionIds: ['jack_exit_time_conflict'], followUp: '谎言被拆穿，但滞留不等于盗窃。',
  },
  {
    id: 'jack-camera', npcId: 'jack', question: '把相机里的原片交给我。',
    response: '你会看到一些不该拍的东西。看第 184 张，玻璃上的倒影……时间是 23:09。那时 Tom 可不在楼上。',
    tone: 'tense', unlockEvidenceId: 'memory-card-photo', revealFactIds: ['jack_went_upstairs'], followUp: '相机捕捉到了案发时刻的关键人物。',
  },
  {
    id: 'jack-alice', npcId: 'jack', question: '你和 Alice 在隐瞒什么？',
    response: '店里冷藏柜发霉，她想留下证据，我答应帮她拍。她回来拿耳机时只停了两三分钟，然后往地铁方向跑了。',
    tone: 'defensive', followUp: '两人的秘密解释了私下联系，却没有直接指向失窃物。',
  },
  {
    id: 'alice-return', npcId: 'alice', question: '为什么离店后又返回？',
    response: '耳机落在员工柜里了。我从侧门回去，拿了就走。我知道这样听起来很糟，但我的交通卡能证明 23:11 已经进站。',
    tone: 'tense', unlockEvidenceId: 'transit-record', revealFactIds: ['alice_returned_for_earphones', 'alice_left_before_crime'], followUp: '她承认返回现场，但时间线可以外部验证。',
  },
  {
    id: 'alice-key', npcId: 'alice', question: '办公室备用钥匙还在你手上吗？',
    response: '上周盘点时借过，活动当天傍晚就还了。电子钥匙柜有记录。Tom 知道这件事，还特意问过我两次。',
    tone: 'defensive', unlockEvidenceId: 'key-return-log', revealFactIds: ['alice_returned_spare_key'], followUp: '钥匙嫌疑减弱，但 Tom 对此异常关注。',
  },
  {
    id: 'alice-last-seen', npcId: 'alice', question: '离开前最后看见了什么？',
    response: 'Tom 抱着那本烘焙日志，说要“把账处理干净”。我以为他指的是活动结算。他还让我别管后门，说锁最近不灵。',
    tone: 'calm', followUp: '这是一份指向 Tom 的证词，仍需要物证印证。',
  },
  {
    id: 'tom-alibi', npcId: 'tom', question: '供应商电话谈了什么？',
    response: '临时改下周的豆子订单。信号不太好，我在楼上谈了十几分钟。通话详单？当然可以查，我没有什么需要隐藏。',
    tone: 'calm', unlockEvidenceId: 'supplier-call-record', revealFactIds: ['tom_claimed_supplier_call', 'tom_fake_supplier_call'], contradictionIds: ['tom_supplier_call_conflict'], followUp: '从容的口供与客观记录发生正面冲突。',
  },
  {
    id: 'tom-money', npcId: 'tom', question: '你最近是否急需一笔钱？',
    response: '谁没有资金压力？经营咖啡馆不是慈善。那是我的私事，和店里的失窃没有关系。建议你查查拿不到尾款的摄影师。',
    tone: 'defensive', unlockEvidenceId: 'debt-letter', revealFactIds: ['tom_financial_pressure'], followUp: '催款金额提供了动机，但他试图把焦点转向 Jack。',
  },
  {
    id: 'tom-alarm', npcId: 'tom', question: '还有谁知道办公室警报密码？',
    response: '理论上只有我。可 Alice 常看我操作，Jack 也在店里到处拍。密码并不难猜——周年日期，任何人都可能知道。',
    tone: 'evasive', revealFactIds: ['tom_used_alarm_code'], contradictionIds: ['tom_alarm_statement_conflict'], followUp: '他承认密码来源，却把“任何人都可能”当作解释。',
  },
]

export const openingLines: Record<string, string> = {
  jack: '先说好，我愿意配合。但如果问题是那笔尾款，应该被审的人可不是我。',
  alice: '我知道我回来过会显得很可疑……可我真的只是去拿耳机。',
  tom: '我比任何人都希望尽快找回募款。请问吧，我会把知道的都告诉你。',
}
