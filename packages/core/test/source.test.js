import { expect, test } from 'bun:test';
import Source from '../src/source';

test('Source works', () => {
  const source = new Source('test\nfoo\nbar');
  expect(source.text).toBe('test\nfoo\nbar');
  expect(source.remain).toBe('test\nfoo\nbar');
  expect(source.offset).toBe(0);
  expect(source.line).toBe(1);
  expect(source.column).toBe(0);

  source.consume(2);
  expect(source.text).toBe('test\nfoo\nbar');
  expect(source.remain).toBe('st\nfoo\nbar');
  expect(source.offset).toBe(2);
  expect(source.line).toBe(1);
  expect(source.column).toBe(2);

  source.consume(3);
  expect(source.text).toBe('test\nfoo\nbar');
  expect(source.remain).toBe('foo\nbar');
  expect(source.offset).toBe(5);
  expect(source.line).toBe(2);
  expect(source.column).toBe(0);

  source.consume(5);
  expect(source.text).toBe('test\nfoo\nbar');
  expect(source.remain).toBe('ar');
  expect(source.offset).toBe(10);
  expect(source.line).toBe(3);
  expect(source.column).toBe(1);
});

test('Source peek', () => {
  const source = new Source('test\nfoo\nbar');
  expect(source.peek()).toBe('t');

  source.consume(2);
  expect(source.peek()).toBe('s');
});

test('Source isStartOfLine', () => {
  const source = new Source('test\nfoo\n  bar');
  expect(source.isStartOfLine(false)).toBeTrue();
  expect(source.isStartOfLine(true)).toBeTrue();

  source.consume(2);
  expect(source.isStartOfLine(false)).toBeFalse();
  expect(source.isStartOfLine(true)).toBeFalse();

  source.consume(3);
  expect(source.isStartOfLine(false)).toBeTrue();
  expect(source.isStartOfLine(true)).toBeTrue();

  source.consume(6);
  expect(source.isStartOfLine(false)).toBeFalse();
  expect(source.isStartOfLine(true)).toBeTrue();
});

test('Source indent', () => {
  const source = new Source('test\nfoo\n  bar');
  expect(source.getIndent()).toBe(0);
  expect(source.isIndent(0)).toBeTrue();

  source.consume(2);
  expect(source.getIndent()).toBe(undefined);
  expect(source.isIndent(0)).toBeFalse();

  source.consume(3);
  expect(source.getIndent()).toBe(0);
  expect(source.isIndent(0)).toBeTrue();

  source.consume(4);
  expect(source.getIndent()).toBe(0);
  expect(source.isIndent(0)).toBeTrue();

  source.consume(1);
  expect(source.getIndent()).toBe(undefined);
  expect(source.isIndent(1)).toBeFalse();

  source.consume(1);
  expect(source.getIndent()).toBe(1);
  expect(source.isIndent(1)).toBeTrue();
});
