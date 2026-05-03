import { parse } from 'yaml'
import conceptsYaml from '../lessons/concepts.yml?raw'
import type { LessonConcept } from './types'

const conceptsByLevel = parse(conceptsYaml) as Record<string, LessonConcept[]>
const concepts = Object.values(conceptsByLevel).flat()

export function chooseSubjects(
  level: number,
  weaknesses: Array<{ weakness: string; severity: number }>,
) {
  const preferredWeaknesses = weaknesses.map((weakness) =>
    weakness.weakness.toLowerCase(),
  )
  const levelMatched = concepts.filter(
    (concept) => concept.difficulty >= level && concept.difficulty <= level + 2,
  )
  const pool = levelMatched.length > 0 ? levelMatched : concepts

  const ranked = [...pool].sort((a, b) => {
    const weaknessRank =
      weaknessScore(b, preferredWeaknesses) - weaknessScore(a, preferredWeaknesses)
    return weaknessRank || b.importance - a.importance || a.difficulty - b.difficulty
  })
  const count = Math.min(ranked.length, Math.random() > 0.45 ? 2 : 1)

  return ranked.slice(0, count)
}

function weaknessScore(concept: LessonConcept, weaknesses: string[]) {
  const subject = concept.subject.toLowerCase()
  return weaknesses.some(
    (weakness) => subject.includes(weakness) || weakness.includes(subject),
  )
    ? 1
    : 0
}
