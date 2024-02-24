import type { TAlignment } from '../lib/Alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { groupByField } from '../lib/Alignment'

function groupSequences(alignment: TAlignment, groupBy: string) {
  return groupByField(alignment, groupBy)
}

expose(groupSequences)
