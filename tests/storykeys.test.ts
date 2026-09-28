import { describe, it, expect } from 'vitest';
import { storyKeyNames } from '@/ui/components/AnswerInput';

describe('手に入れた力の名前', () => {
  it('^ は「累乗」と見せる(^ は授業で習わない記号。先生の要望 2026-09-28)。かっこは 1 つにまとめる', () => {
    expect(storyKeyNames(['^'])).toEqual(['累乗']);
    expect(storyKeyNames(['(', ')'])).toEqual(['かっこ']);
    expect(storyKeyNames(['×'])).toEqual(['×']);
  });
});
