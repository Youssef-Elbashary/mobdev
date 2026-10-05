/** Lab 02 registry: every exercise in page order (ids must match meta.ts). */
import type { Exercise } from '../types.ts';
import { ex01, ex02, ex03, ex04, ex05, ex06 } from './part1.ts';
import { ex07, ex08, ex09, ex10, ex11, ex12, ex13 } from './part2.ts';
import { ex14, ex15, ex16, ex17 } from './part3.ts';

export { demos } from './demos.ts';
export { LAB_ID, EXERCISES, BLOCKS, FINAL_ID } from './meta.ts';

export const exercises: Exercise[] = [ex01, ex02, ex03, ex04, ex05, ex06, ex07, ex08, ex09, ex10, ex11, ex12, ex13, ex14, ex15, ex16, ex17];

export const byId = (id: string) => exercises.find((e) => e.id === id);
