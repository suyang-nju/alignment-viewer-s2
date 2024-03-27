import type { TAlignment } from '../lib/alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { setReferenceSequence } from '../lib/alignment'

function setReference(alignment: TAlignment, referenceSequenceIndex: number) {
  return setReferenceSequence(alignment, referenceSequenceIndex)
}

expose(setReference)
