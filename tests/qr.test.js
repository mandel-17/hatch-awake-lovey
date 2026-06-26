import test from "node:test";
import assert from "node:assert/strict";
import { scanUrl, extractCode } from "../public/views/shared.js";

test("scanUrl: origin+code로 ?scan= URL 생성", () => {
  assert.equal(scanUrl("W-OX", "https://kkae.example"), "https://kkae.example/?scan=W-OX");
});

test("extractCode: ?scan= URL에서 코드 추출", () => {
  assert.equal(extractCode("https://kkae.example/?scan=W-OX"), "W-OX");
});

test("scanUrl → extractCode round-trip (시드 코드 전부)", () => {
  const codes = ["W-MEM","W-OX","W-MIX","W-DRAW","W-CROSS","P-LYR","P-INT","A-BODY","A-CURL","A-TONE","PR-CARD"];
  for (const code of codes) {
    assert.equal(extractCode(scanUrl(code, "https://h")), code);
  }
});

test("extractCode: URL이 아니면 원문 그대로(앱 내 코드 입력)", () => {
  assert.equal(extractCode("W-OX"), "W-OX");
});

test("scanUrl: 특수문자 percent-encoding round-trip", () => {
  const u = scanUrl("A B", "https://h");
  assert.equal(u, "https://h/?scan=A%20B");
  assert.equal(extractCode(u), "A B");
});

test("extractCode: scan 파라미터 없는 URL은 원문 그대로", () => {
  assert.equal(extractCode("https://kkae.app/?foo=bar"), "https://kkae.app/?foo=bar");
});
