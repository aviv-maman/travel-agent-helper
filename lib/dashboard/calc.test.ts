import { expect, test } from "bun:test";
import { evalLine, formatNumber } from "./calc";

test("basic arithmetic", () => {
  expect(evalLine("1250*1.065")).toBe(1331.25);
  expect(evalLine("(3400+280)/2")).toBe(1840);
  expect(evalLine("2+3*4")).toBe(14);
  expect(evalLine("10 / 4")).toBe(2.5);
});

test("percent shorthand is contextual", () => {
  expect(evalLine("2500 + 8%")).toBe(2700);
  expect(evalLine("3000 - 10%")).toBe(2700);
  expect(evalLine("2500 * 8%")).toBe(200);
  expect(evalLine("8%")).toBeCloseTo(0.08, 10);
});

test("labels and thousands separators", () => {
  expect(evalLine("hotel = 1,250 * 1.065")).toBe(1331.25);
  expect(evalLine("profit: 100 + 20%")).toBe(120);
});

test("non-math lines return null", () => {
  expect(evalLine("call John tomorrow")).toBeNull();
  expect(evalLine("42")).toBeNull(); // plain number, no operator → treated as a note
  expect(evalLine("")).toBeNull();
  expect(evalLine("hotel in Batumi")).toBeNull();
});

test("malformed expressions return null, never throw", () => {
  expect(evalLine("2 +")).toBeNull();
  expect(evalLine("(3+4")).toBeNull();
  expect(evalLine("* 5")).toBeNull();
});

test("formatNumber adds separators and rounds to 2 decimals", () => {
  expect(formatNumber(1331.25)).toBe("1,331.25");
  expect(formatNumber(1840)).toBe("1,840");
  expect(formatNumber(1234567.899)).toBe("1,234,567.9");
});
