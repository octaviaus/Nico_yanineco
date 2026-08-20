import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  IllegalPetPhaseTransitionError,
  PET_PHASES,
  PET_PHASE_FACE,
  PET_PHASE_TRANSITIONS,
  canTransitionPetPhase,
  createPetPhaseMachine,
  isPetPhase,
  petPhaseToPose,
  resolvePetPhaseFace,
  transitionPetPhase,
  tryTransitionPetPhase,
  type PetPhase
} from '../src/petPhase.ts'

const ALL_PHASES: PetPhase[] = [...PET_PHASES]

function illegalPairs(): Array<[PetPhase, PetPhase]> {
  const pairs: Array<[PetPhase, PetPhase]> = []
  for (const from of ALL_PHASES) {
    const allowed = new Set<string>(PET_PHASE_TRANSITIONS[from])
    for (const to of ALL_PHASES) {
      if (!allowed.has(to)) pairs.push([from, to])
    }
  }
  return pairs
}

describe('ST-STATE-01 pet phase machine', () => {
  it('enumerates the six R06/contract phases', () => {
    assert.deepEqual(ALL_PHASES, [
      'Idle',
      'Listening',
      'Thinking',
      'Speaking',
      'Inhale',
      'Exhale'
    ])
  })

  it('allows self-transitions and the conversation + puff happy paths', () => {
    const happy: Array<[PetPhase, PetPhase]> = [
      ['Idle', 'Idle'],
      ['Idle', 'Listening'],
      ['Listening', 'Thinking'],
      ['Thinking', 'Exhale'],
      ['Exhale', 'Speaking'],
      ['Speaking', 'Idle'],
      ['Idle', 'Inhale'],
      ['Inhale', 'Exhale'],
      ['Exhale', 'Idle'],
      ['Idle', 'Thinking'],
      ['Thinking', 'Speaking'],
      ['Speaking', 'Listening'],
      ['Speaking', 'Inhale']
    ]
    for (const [from, to] of happy) {
      assert.equal(transitionPetPhase(from, to), to, `${from} → ${to}`)
    }
  })

  it('rejects illegal transitions by throwing (no silent rewrite)', () => {
    const pairs = illegalPairs()
    assert.ok(pairs.length > 0, 'expected some illegal edges')
    assert.ok(
      pairs.some(([from, to]) => from === 'Listening' && to === 'Speaking'),
      'Listening → Speaking must be illegal (skip Thinking)'
    )
    assert.ok(
      pairs.some(([from, to]) => from === 'Exhale' && to === 'Inhale'),
      'Exhale → Inhale must be illegal (wrong puff order)'
    )

    for (const [from, to] of pairs) {
      assert.equal(canTransitionPetPhase(from, to), false, `can ${from} → ${to}`)
      assert.throws(
        () => transitionPetPhase(from, to),
        (err: unknown) => {
          assert.ok(err instanceof IllegalPetPhaseTransitionError)
          assert.equal(err.from, from)
          assert.equal(err.to, to)
          return true
        }
      )
      const result = tryTransitionPetPhase(from, to)
      assert.equal(result.ok, false)
      if (!result.ok) {
        assert.equal(result.from, from)
        assert.equal(result.to, to)
      }
    }
  })

  it('does not mutate the machine on a failed tryTransition', () => {
    const machine = createPetPhaseMachine('Idle')
    machine.transition('Listening')
    const failed = machine.tryTransition('Speaking')
    assert.equal(failed.ok, false)
    assert.equal(machine.phase, 'Listening')
    assert.throws(() => machine.transition('Exhale'))
    assert.equal(machine.phase, 'Listening')
  })

  it('rejects unknown phase values instead of inventing a state', () => {
    const result = tryTransitionPetPhase('Idle', 'Sleeping')
    assert.equal(result.ok, false)
    assert.equal(isPetPhase('Sleeping'), false)
    assert.equal(isPetPhase('Idle'), true)
  })

  it('maps Listening/Thinking to the Idle face combo (contract §2 idle)', () => {
    const idle = PET_PHASE_FACE.Idle
    assert.deepEqual([...idle.eyes], ['open', 'half'])
    assert.deepEqual([...idle.mouth], ['closed'])
    assert.equal(idle.setMouthOpen, false)
    assert.equal(PET_PHASE_FACE.Listening, idle)
    assert.equal(PET_PHASE_FACE.Thinking, idle)
    assert.deepEqual(resolvePetPhaseFace('Listening'), resolvePetPhaseFace('Idle'))
    assert.deepEqual(resolvePetPhaseFace('Thinking'), resolvePetPhaseFace('Idle'))
  })

  it('maps Speaking to mouth open via setMouthOpen', () => {
    const face = PET_PHASE_FACE.Speaking
    assert.deepEqual([...face.mouth], ['open'])
    assert.equal(face.setMouthOpen, true)
    assert.equal(resolvePetPhaseFace('Speaking').mouth, 'open')
  })

  it('maps Inhale to squint/closed eyes and closed mouth', () => {
    const face = PET_PHASE_FACE.Inhale
    assert.ok(face.eyes.includes('closed'))
    assert.ok(face.eyes.every((e) => e === 'closed' || e === 'half'))
    assert.deepEqual([...face.mouth], ['closed'])
    assert.equal(face.setMouthOpen, false)
    assert.equal(resolvePetPhaseFace('Inhale').eyes, 'closed')
  })

  it('maps Exhale to mouth smoke or open', () => {
    const face = PET_PHASE_FACE.Exhale
    assert.ok(face.mouth.includes('smoke'))
    assert.ok(face.mouth.includes('open'))
    assert.equal(face.mouth.length, 2)
    assert.equal(resolvePetPhaseFace('Exhale').mouth, 'smoke')
  })

  it('bridges phases onto existing CharacterPose without new renderer APIs', () => {
    assert.equal(petPhaseToPose('Idle'), 'idle')
    assert.equal(petPhaseToPose('Listening'), 'idle')
    assert.equal(petPhaseToPose('Thinking'), 'idle')
    assert.equal(petPhaseToPose('Speaking'), 'talk')
    assert.equal(petPhaseToPose('Inhale'), 'inhale')
    assert.equal(petPhaseToPose('Exhale'), 'exhale')
  })
})
