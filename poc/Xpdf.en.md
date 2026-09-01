---
title: "Xpdf"
date: "2026-01-08"
tags: ["Xpdf", "DoS", "converter"]
---
## Xpdf 3.02 - Crash from a cyclic reference

If we craft a specific PDF, one where the length of an object is a reference to itself, it causes a self reference (re-entry) while references are resolved, and that ends in a crash.

## Impact

SIGSEGV / crash / possible DoS in scenarios where Xpdf runs as a service

## Affected version

**xpdf 3.02**

## POC

### Minimal PDF

```pdf
1 0 obj<<
3 0 obj<</Length 3 0R/>stream
```

> Note: the input above is a minimal fragment that reproduces the bug, it is not a well formed PDF.
### Run

```bash
./pdftotext min.pdf /dev/null
```

### Output

```python
Error (33): Illegal character '>'
(repeated several times)

Program received signal SIGSEGV, Segmentation fault.
0x00007ffff78690a7 in __printf_buffer(...)

Backtrace (crash):

0  __printf_buffer(...)                     libc
1  __vfprintf_internal(...)                libc
2  __fprintf(...)                          libc
3  Lexer::getObj(...)        at Lexer.cc:424
4  Parser::shift(...)        at Parser.cc:226
5  Parser::getObj(...)       at Parser.cc:112
6  Parser::getObj(...)       at Parser.cc:85
7  XRef::fetch(num=3, gen=0) at XRef.cc:823
8  Object::fetch(...)        at Object.cc:106
9  Dict::lookup(...)         at Dict.cc:76
```

## Root cause

`/Length` can be an indirect reference. A malicious PDF can make `/Length` point to the same object that is being parsed, causing re-entry when the reference is resolved and an inconsistent state that ends in SIGSEGV.

## Fix

This fix adds a **re-entry guard in reference resolution** inside `XRef::fetch`, blocking the case where an object tries to resolve itself.  
That way the self reference during indirect resolution is avoided (for example in `/Length`), and the parser no longer enters the inconsistent state that ended in `SIGSEGV`.

In `Xref.h` we add 3 private variables in the `private` section to detect immediate re-entry:

```cpp
 int inFetchNum;
 int inFetchGen;
 GBool inFetch;
```

and we initialize them in the `XRef::XRef(BaseStream *strA)` constructor:

```cpp
inFetch = gFalse;
inFetchNum = -1;
inFetchGen = -1;
```

Then we handle the states from the `XRef::fetch()` function:

```cpp
Object *XRef::fetch(int num, int gen, Object *obj) {
  XRefEntry *e;
  Parser *parser;
  Object obj1, obj2, obj3;

  // Save previous fetch state
  GBool prevInFetch = inFetch;
  int prevNum = inFetchNum;
  int prevGen = inFetchGen;
  GBool pushed = gFalse;

  // check for bogus ref - this can happen in corrupted PDF files
  if (num < 0 || num >= size) {
    goto err;
  }

  // Reject immediate self-recursion (e.g. Length -> same object)
  if (inFetch && inFetchNum == num && inFetchGen == gen) {
    goto err;
  }

  // Mark this fetch as active
  inFetch = gTrue;
  inFetchNum = num;
  inFetchGen = gen;
  pushed = gTrue;

  e = &entries[num];
  switch (e->type) {

  case xrefEntryUncompressed:
    if (e->gen != gen) {
      goto err;
    }
    obj1.initNull();
    parser = new Parser(this,
	       new Lexer(this,
		 str->makeSubStream(start + e->offset, gFalse, 0, &obj1)),
	       gTrue);
    parser->getObj(&obj1);
    parser->getObj(&obj2);
    parser->getObj(&obj3);
    if (!obj1.isInt() || obj1.getInt() != num ||
	!obj2.isInt() || obj2.getInt() != gen ||
	!obj3.isCmd("obj")) {
      obj1.free();
      obj2.free();
      obj3.free();
      delete parser;
      goto err;
    }
    parser->getObj(obj, encrypted ? fileKey : (Guchar *)NULL,
		   encAlgorithm, keyLength, num, gen);
    obj1.free();
    obj2.free();
    obj3.free();
    delete parser;
    break;

  case xrefEntryCompressed:
    if (gen != 0) {
      goto err;
    }
    if (!objStr || objStr->getObjStrNum() != (int)e->offset) {
      if (objStr) {
	delete objStr;
      }
      objStr = new ObjectStream(this, e->offset);
    }
    objStr->getObject(e->gen, num, obj);
    break;

  default:
    goto err;
  }

  goto done;

err:
  obj->initNull();

done:
  if (pushed) {
    inFetch = prevInFetch;
    inFetchNum = prevNum;
    inFetchGen = prevGen;
  }
  return obj;
}

```

### Result of the fix

```python
./pdftotext ./min.pdf /dev/null
Error: May not be a PDF file (continuing anyway)
Error: PDF file is damaged - attempting to reconstruct xref table...
Error: End of file inside dictionary
Error (13): Dictionary key must be a name object
Error (17): Dictionary key must be a name object
Error (19): Dictionary key must be a name object
Error (26): Dictionary key must be a name object
Error (33): Illegal character '>'
Error (33): Illegal character '>'
Error (40): Bad 'Length' attribute in stream
Error (40): Bad 'Length' attribute in stream
Error: Catalog object is wrong type (error)
Error: Couldn't read page catalog
```

The file is still malformed, but after the fix the failure becomes a **controlled error** instead of a SIGSEGV