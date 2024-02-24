import type { TAlignment } from '../lib/Alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import { setReferenceSequence } from '../lib/Alignment'

function setReference(alignment: TAlignment, referenceSequenceIndex: number) {
  return setReferenceSequence(alignment, referenceSequenceIndex)
}

expose(setReference)
