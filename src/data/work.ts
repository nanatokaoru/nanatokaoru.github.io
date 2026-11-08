import book1Covers from '@/data/book1-covers.json'

export const WORK = {
  title: '奈奈与薰的SM日记',
  author: '甘詰留太',
  publisher: '白泉社',
  tags: ['调教', 'SM', '青梅竹马', '滴蜡', 'K9'],
  synopsis:
    '高中校花奈奈和青梅竹马阿薰，一个无法说出口的愿望，让两人开始了秘密的时光……',
  heroImageUrl: book1Covers[0]?.leftImageUrl ?? '',
} as const
