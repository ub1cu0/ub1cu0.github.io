---
title: "Xpdf 3.02"
date: "2026-01-08"
tags: ["imaginaryCTF", "got", "ret2libc"]
---

## Xpdf 3.02 - Crash por referencia cíclica

Si preparamos un PDF específico, en el que ponemos como longitud de un objeto una referencia a sí mismo, provoca una autorreferencia (re-entrada) durante la resolución de referencias, que termina en un crash.

## Impacto

SIGSEGV / crash / Posible DoS en escenarios donde Xpdf se use como servicio

## Versión afectada

**xpdf 3.02**

## POC

### PDF mínimo

```pdf
1 0 obj<<
3 0 obj<</Length 3 0R/>stream
```

> Nota: el siguiente input es un fragmento mínimo que reproduce el fallo; no es un PDF bien formado.
### Lanzamiento

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

`/Length` puede ser una referencia indirecta. Un PDF malicioso puede hacer que `/Length` apunte al mismo objeto que se está parseando, provocando re-entrada al resolver la referencia y un estado inconsistente que termina en SIGSEGV.

## Fix

Este fix introduce un **guard de re-entrada en la resolución de referencias** dentro de `XRef::fetch`, bloqueando el caso en el que un objeto intenta resolverse a sí mismo.  
De esta forma se evita la autorreferencia durante la resolución indirecta (por ejemplo en `/Length`), impidiendo que el parser entre en un estado inconsistente que terminaba en `SIGSEGV`.

En `Xref.h` añadimos 3 variables privadas en el `private` para detectar re-entrada inmediata:

```cpp
 int inFetchNum;
 int inFetchGen;
 GBool inFetch;
```

y las iniciamos en el constructor `XRef::XRef(BaseStream *strA)`:

```cpp
inFetch = gFalse;
inFetchNum = -1;
inFetchGen = -1;
```

Luego manejamos los estados desde la función `XRef::fetch()`:

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

### Resultado del Fix

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

El fichero sigue siendo malformado, pero tras el fix el fallo pasa a ser **error controlado** en lugar de SIGSEGV