import assert from "node:assert/strict";
import test from "node:test";
import { parseProductSearch, SearchInputError } from "../lib/product-search";

test("product search validates and normalizes filters with bounded pagination", () => {
  const input = parseProductSearch(new URLSearchParams("q=+Phones+&category=electronics&seller=123&limit=2&offset=4&attributeKey=Brand&attributeValue=Acme"));
  assert.deepEqual(input, { q: "Phones", category: "electronics", seller: 123, limit: 2, offset: 4, attributeKey: "brand", attributeValue: "Acme" });
  assert.equal(parseProductSearch(new URLSearchParams()).limit, 24);
  for (const query of ["seller=-1", "seller=abc", "seller=0", "offset=10001", "offset=1.5", "limit=49", "limit=0", "attributeKey=brand", `q=${"a".repeat(101)}`]) {
    assert.throws(() => parseProductSearch(new URLSearchParams(query)), SearchInputError);
  }
});
