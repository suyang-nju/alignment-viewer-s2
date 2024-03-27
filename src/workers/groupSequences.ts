import type { TAlignment } from '../lib/alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { groupByField } from '../lib/alignment'

function groupSequences(alignment: TAlignment, groupBy: string) {
  return groupByField(alignment, groupBy)
}

expose(groupSequences)
